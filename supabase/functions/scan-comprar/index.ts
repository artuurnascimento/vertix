/**
 * scan-comprar
 *
 * Venda automática do Plano de Correção do Vertix Scan. Chamada pelo WORKER do
 * Scan (servidor a servidor), nunca pelo navegador — por isso não usa withCors.
 *
 * Recebe os dados do comprador e cria, de uma vez, o que antes era digitado à
 * mão no Financeiro: cliente (origem 'scan'), projeto, recebível pendente e a
 * linha em raiox_compras que amarra os três à análise. Devolve o link do nosso
 * próprio checkout (/pagar/:payment_token) — o Mercado Pago só processa.
 *
 * Autenticação: header `x-vertix-token` comparado em tempo constante com a env
 * SCAN_INBOUND_TOKEN. Sem a env, responde 503 (endpoint desativado), no mesmo
 * espírito do apps-proxy quando um app não está configurado.
 *
 * SCAN_INBOUND_TOKEN é deliberadamente SEPARADA de SCAN_SERVICE_TOKEN, que o
 * apps-proxy usa no sentido contrário (painel → worker). Fossem a mesma, quem
 * tivesse o token de saída poderia criar cliente, projeto e cobrança aqui
 * dentro. Direções opostas, segredos opostos.
 *
 * Idempotência POR LEAD: o lead que já tem compra viva recebe de volta a MESMA
 * compra e o MESMO payment_url. Dois cliques no botão não geram dois clientes.
 * A checagem por leitura cobre o caso normal; o empate real (dois POSTs
 * simultâneos) é barrado pelo índice único parcial
 * raiox_compras_lead_ativa_key, e o segundo insert cai no mesmo caminho de "já
 * existe".
 *
 * Por que por lead, e não por análise: o Scan reaproveita a análise por
 * domínio, então duas PESSOAS podem estar no mesmo analysis_id — o dono e uma
 * agência. Idempotência por análise devolvia à segunda pessoa a compra da
 * primeira, com o payment_url (e o token que pré-preenche o checkout com nome,
 * e-mail e WhatsApp) de quem chegou antes. O worker resolve o lead pelo
 * report_code, que é único por lead, e manda o `lead_id` aqui.
 *
 * Uma pessoa que passou pelo portão duas vezes tem dois leads na mesma
 * análise. Para ela também não abrir duas cobranças, a compra viva da análise
 * cujo cliente tem o MESMO e-mail do comprador conta como "já existe".
 *
 * Tudo isso (compra viva, cliente, projeto, recebível, compra) acontece numa
 * transação só, dentro da função SQL scan_abrir_compra: falhou no meio, o
 * Postgres desfaz e nada aparece pela metade no Financeiro nem no CRM. Daqui
 * sai UMA chamada ao banco — antes eram cinco ou seis em série, ~1 s a mais
 * entre o clique em "comprar" e o checkout começar a abrir.
 *
 * NUNCA loga o valor de SCAN_INBOUND_TOKEN nem a service role key.
 */

/**
 * Corpo aceito do worker. `compra_id` e `plano_code` NÃO entram aqui de
 * propósito: quem cria a linha de raiox_compras e sorteia o plano_code é esta
 * function (via scan_abrir_compra), que é quem tem o recebível e o índice
 * de unicidade.
 * Se o worker mandar esses campos, eles são ignorados — corpo vindo de fora não
 * dita chave. Não acrescente-os a esta interface sem mudar esse contrato.
 */
interface RequestBody {
  analysis_id?: string
  /** Quem compra (public.leads.id). Obrigatório: é a chave da idempotência. */
  lead_id?: string
  nome?: string
  email?: string
  whatsapp?: string
  dominio?: string
  valor_centavos?: number
}



/** Domínio público oficial dos links de pagamento enviados a clientes. */
const PAGAR_PUBLIC_BASE = 'https://pay.vertix.studio'

/**
 * Slug do checkout do Plano de Correção em pay.vertix.studio/c/<slug>.
 *
 * O funil do Scan manda a pessoa para /c/<slug>?a=<analysis_id>: a página
 * repassa esse `a` para a checkout-pagar, que grava em `pedidos.analysis_id`.
 * É esse vínculo que permite ao worker saber de qual loja é o plano na hora de
 * gerá-lo — sem ele o pedido nasce órfão e a entrega não tem o que fazer.
 */
const CHECKOUT_PLANO_SLUG = 'plano-correcao'

/**
 * URL do checkout novo para uma análise.
 *
 * O `t` é o payment_token do recebível, e serve para o checkout devolver ao
 * comprador o nome, o e-mail e o WhatsApp que ele já digitou no portão da
 * análise (RPC get_checkout_prefill) — assim sobra para ele só o CPF e o
 * cartão.
 *
 * Vai o TOKEN, e não o analysis_id, porque o id da análise também está no link
 * do relatório, que o lojista encaminha para sócio e agência; o token só
 * existe nesta URL. Sem token, o checkout abre com o formulário vazio, que é
 * o comportamento de antes.
 */
function urlDoCheckout(
  analysisId: string,
  paymentToken: string | null
): string {
  const base = `${PAGAR_PUBLIC_BASE}/c/${CHECKOUT_PLANO_SLUG}?a=${encodeURIComponent(analysisId)}`
  return paymentToken ? `${base}&t=${encodeURIComponent(paymentToken)}` : base
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Validação de e-mail deliberadamente frouxa: só garante forma mínima, porque
// o e-mail vira o identificador do cliente e o destino do recibo.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Teto de sanidade para o valor. O worker é confiável (tem o token), mas um bug
// dele não pode virar uma cobrança de seis dígitos na cara de um cliente.
const VALOR_MAXIMO_CENTAVOS = 5_000_000

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** Comparação em tempo constante — não vaza o segredo por timing. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

Deno.serve(async (req) => {
  const scanToken = Deno.env.get('SCAN_INBOUND_TOKEN')
  if (!scanToken) {
    console.error('[scan-comprar] SCAN_INBOUND_TOKEN não configurado.')
    return jsonResponse({ error: 'endpoint_desativado' }, 503)
  }
  if (!safeEqual(req.headers.get('x-vertix-token') ?? '', scanToken)) {
    return jsonResponse({ error: 'nao_autorizado' }, 401)
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'method_not_allowed' }, 405)
  }

  let body: RequestBody
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'payload_invalido' }, 400)
  }

  // ------------------------------------------------------------------------
  // Validação da entrada
  // ------------------------------------------------------------------------

  // Tipados como string depois da validação, para o `string | undefined` do
  // corpo não vazar para urlDoCheckout.
  const analysisIdBruto = body.analysis_id
  if (!analysisIdBruto || !UUID_RE.test(analysisIdBruto)) {
    return jsonResponse({ error: 'analysis_id_invalido' }, 400)
  }
  const analysisId: string = analysisIdBruto

  const leadIdBruto = body.lead_id
  if (!leadIdBruto || !UUID_RE.test(leadIdBruto)) {
    return jsonResponse({ error: 'lead_id_invalido' }, 400)
  }
  const leadId: string = leadIdBruto

  const nome = (body.nome ?? '').trim()
  if (!nome) {
    return jsonResponse({ error: 'nome_obrigatorio' }, 400)
  }

  const email = (body.email ?? '').trim().toLowerCase()
  if (!EMAIL_RE.test(email)) {
    return jsonResponse({ error: 'email_invalido' }, 400)
  }

  const whatsapp = (body.whatsapp ?? '').trim()
  if (!whatsapp) {
    return jsonResponse({ error: 'whatsapp_obrigatorio' }, 400)
  }

  const dominio = (body.dominio ?? '').trim()
  if (!dominio) {
    return jsonResponse({ error: 'dominio_obrigatorio' }, 400)
  }

  const valorCentavos = body.valor_centavos
  if (
    typeof valorCentavos !== 'number' ||
    !Number.isInteger(valorCentavos) ||
    valorCentavos <= 0 ||
    valorCentavos > VALOR_MAXIMO_CENTAVOS
  ) {
    return jsonResponse({ error: 'valor_centavos_invalido' }, 400)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('[scan-comprar] Env do Supabase ausente.')
    return jsonResponse({ error: 'env_supabase_ausente' }, 500)
  }

  // ------------------------------------------------------------------------
  // Uma ida ao banco: scan_abrir_compra faz consulta de compra viva, cliente
  // (reaproveitado por e-mail ou criado), projeto, recebível e compra numa
  // transação só — e desfaz tudo sozinha se algo falhar. Antes eram cinco ou
  // seis chamadas PostgREST em série daqui (sa-east-1) até o Postgres
  // (us-east-1): ~1 s a mais para quem tinha acabado de clicar em comprar.
  // Ver supabase/migrations/20260914110000_scan_abrir_compra.sql.
  // ------------------------------------------------------------------------

  const linkPrefixo = urlDoCheckout(analysisId, null) + '&t='

  const res = await fetch(`${supabaseUrl}/rest/v1/rpc/scan_abrir_compra`, {
    method: 'POST',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      p_analysis_id: analysisId,
      p_lead_id: leadId,
      p_nome: nome,
      p_email: email,
      p_whatsapp: whatsapp,
      p_dominio: dominio,
      p_valor_centavos: valorCentavos,
      p_link_prefixo: linkPrefixo,
    }),
  })

  if (!res.ok) {
    const detalhe = await res.text()
    console.error('[scan-comprar] scan_abrir_compra falhou:', res.status, detalhe)
    return jsonResponse({ error: 'falha_ao_registrar_compra' }, 502)
  }

  const compra = (await res.json()) as {
    compra_id: string
    receivable_id: string | null
    plano_code: string | null
    payment_token: string | null
    existente: boolean
  }

  return jsonResponse({
    compra_id: compra.compra_id,
    receivable_id: compra.receivable_id,
    plano_code: compra.plano_code,
    // Mesmo token da primeira vez quando a compra já existia: quem clica de
    // novo cai no mesmo checkout, com o formulário preenchido igual.
    payment_url: urlDoCheckout(analysisId, compra.payment_token),
  })
})
