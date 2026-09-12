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
 * Criação parcial: se algo falha no meio, esta função DESFAZ o que criou
 * (recebível → projeto → cliente, e o cliente só quando foi criado agora) e
 * responde erro. O motivo de preferir desfazer a registrar pela metade: essas
 * linhas aparecem no Financeiro e no CRM da equipe, e um cliente fantasma sem
 * cobrança é ruído que alguém vai ter de limpar à mão; o comprador, por outro
 * lado, só precisa clicar de novo. O rollback é "melhor esforço" — se ele
 * próprio falhar, o log diz exatamente quais ids ficaram órfãos.
 *
 * NUNCA loga o valor de SCAN_INBOUND_TOKEN nem a service role key.
 */

/**
 * Corpo aceito do worker. `compra_id` e `plano_code` NÃO entram aqui de
 * propósito: quem cria a linha de raiox_compras e sorteia o plano_code é esta
 * function, que é quem tem o recebível, o rollback e o índice de unicidade.
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

interface CompraRecord {
  id: string
  receivable_id: string | null
  plano_code: string | null
  status: string
  lead_id?: string | null
  /** Embed do PostgREST pela FK client_id → clients. */
  clients?: { email: string | null } | null
}

interface ReceivableRecord {
  id: string
  payment_token: string
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

/** Projeto do Plano de Correção: o Scan analisa loja, logo e-commerce. */
const TIPO_SERVICO = 'ecommerce'

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

/**
 * Código do plano: 12 caracteres base64url, mesmo formato do report_code do
 * Scan. 9 bytes aleatórios dão exatamente 12 chars sem padding (72 bits).
 */
function gerarPlanoCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(9))
  return btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '')
}

/**
 * Centavos → string decimal para a coluna numeric(12,2). Feito com aritmética
 * inteira de propósito: dividir por 100 em float e serializar já produziu
 * centavo a menos em sistema de cobrança.
 */
function centavosParaReais(centavos: number): string {
  const reais = Math.trunc(centavos / 100)
  const resto = centavos % 100
  return `${reais}.${String(resto).padStart(2, '0')}`
}

/** Data de hoje em YYYY-MM-DD (UTC, igual ao resto das functions). */
function hojeISO(): string {
  return new Date().toISOString().slice(0, 10)
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

  // Tipados como string depois da validação: as funções internas (closures)
  // não enxergam o estreitamento do `if`, e `string | undefined` vazava para
  // urlDoCheckout.
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

  const restBase = `${supabaseUrl}/rest/v1`
  const authHeaders = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
  }
  const writeHeaders = {
    ...authHeaders,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  }

  // ------------------------------------------------------------------------
  // Helpers de acesso ao banco (PostgREST com service role — ignora RLS)
  // ------------------------------------------------------------------------

  /** Monta a resposta final a partir de uma compra já existente/criada. */
  async function responderCompra(compra: CompraRecord): Promise<Response> {
    let paymentUrl: string | null = null

    if (compra.receivable_id) {
      const res = await fetch(
        `${restBase}/receivables?id=eq.${compra.receivable_id}` +
          '&select=id,payment_token',
        { headers: authHeaders }
      )
      if (res.ok) {
        const linhas = (await res.json()) as ReceivableRecord[]
        if (linhas[0]) {
          // Mesmo token da primeira vez: quem clica de novo cai no mesmo
          // checkout, com o formulário preenchido igual.
          paymentUrl = urlDoCheckout(analysisId, linhas[0].payment_token)
        }
      } else {
        console.error(
          '[scan-comprar] Falha ao buscar recebível da compra:',
          res.status
        )
      }
    }

    return jsonResponse({
      compra_id: compra.id,
      receivable_id: compra.receivable_id,
      plano_code: compra.plano_code,
      payment_url: paymentUrl,
    })
  }

  /**
   * Busca a compra VIVA deste lead, se houver — ou, na mesma análise, a de um
   * cliente com o mesmo e-mail (a mesma pessoa que passou pelo portão duas
   * vezes). O filtro de status é o mesmo do índice único parcial
   * raiox_compras_lead_ativa_key — cancelada ou reembolsada não conta, e o
   * lead pode comprar de novo.
   *
   * O que NÃO entra: a compra viva de OUTRO lead com OUTRO e-mail na mesma
   * análise. É outra pessoa, e ela recebe a compra dela.
   */
  async function buscarCompraExistente(): Promise<CompraRecord | null> {
    const res = await fetch(
      `${restBase}/raiox_compras?analysis_id=eq.${analysisId}` +
        '&status=in.(aguardando_pagamento,pago)' +
        '&select=id,receivable_id,plano_code,status,lead_id,clients(email)' +
        '&order=created_at.desc&limit=20',
      { headers: authHeaders }
    )
    if (!res.ok) {
      console.error('[scan-comprar] Falha ao consultar compras:', res.status)
      return null
    }
    const linhas = (await res.json()) as CompraRecord[]
    const doLead = linhas.find((c) => c.lead_id === leadId)
    if (doLead) return doLead
    const mesmaPessoa = linhas.find(
      (c) => c.clients?.email?.trim().toLowerCase() === email
    )
    return mesmaPessoa ?? null
  }

  // ------------------------------------------------------------------------
  // 1. Idempotência: lead que já comprou recebe a mesma compra de volta
  // ------------------------------------------------------------------------

  const existente = await buscarCompraExistente()
  if (existente) {
    return responderCompra(existente)
  }

  // ------------------------------------------------------------------------
  // Rollback do que for criado daqui para baixo
  // ------------------------------------------------------------------------

  let clienteCriadoId: string | null = null
  let projetoCriadoId: string | null = null
  let recebivelCriadoId: string | null = null

  async function apagar(tabela: string, id: string): Promise<void> {
    const res = await fetch(`${restBase}/${tabela}?id=eq.${id}`, {
      method: 'DELETE',
      headers: { ...authHeaders, Prefer: 'return=minimal' },
    })
    if (!res.ok) {
      console.error(
        `[scan-comprar] ROLLBACK INCOMPLETO — ${tabela} ${id} não foi apagado`,
        res.status
      )
    }
  }

  /** Desfaz na ordem inversa da criação. Cliente reaproveitado não é tocado. */
  async function desfazer(): Promise<void> {
    if (recebivelCriadoId) await apagar('receivables', recebivelCriadoId)
    if (projetoCriadoId) await apagar('projects', projetoCriadoId)
    if (clienteCriadoId) await apagar('clients', clienteCriadoId)
  }

  async function falhar(
    motivo: string,
    status: number,
    detalhe?: string
  ): Promise<Response> {
    if (detalhe) console.error(`[scan-comprar] ${motivo}:`, detalhe)
    await desfazer()
    return jsonResponse({ error: motivo }, status)
  }

  // ------------------------------------------------------------------------
  // 2. Cliente — reaproveita por e-mail, senão cria com origem 'scan'
  // ------------------------------------------------------------------------
  // O casamento é por e-mail exato em minúsculas. Cliente antigo cadastrado
  // com maiúsculas não casa e vira um segundo cadastro — preferível a unir
  // duas pessoas diferentes por engano num registro financeiro.

  let clientId: string

  const clienteRes = await fetch(
    `${restBase}/clients?email=eq.${encodeURIComponent(email)}` +
      '&select=id&limit=1',
    { headers: authHeaders }
  )
  if (!clienteRes.ok) {
    return falhar('falha_ao_buscar_cliente', 502, String(clienteRes.status))
  }
  const clientesExistentes = (await clienteRes.json()) as Array<{ id: string }>

  if (clientesExistentes[0]) {
    clientId = clientesExistentes[0].id
  } else {
    const novoClienteRes = await fetch(`${restBase}/clients`, {
      method: 'POST',
      headers: writeHeaders,
      body: JSON.stringify({
        nome,
        email,
        telefone: whatsapp,
        origem: 'scan',
      }),
    })
    if (!novoClienteRes.ok) {
      return falhar(
        'falha_ao_criar_cliente',
        502,
        `${novoClienteRes.status} ${await novoClienteRes.text()}`
      )
    }
    const criados = (await novoClienteRes.json()) as Array<{ id: string }>
    if (!criados[0]) {
      return falhar('falha_ao_criar_cliente', 502, 'resposta sem linha')
    }
    clientId = criados[0].id
    clienteCriadoId = clientId
  }

  // ------------------------------------------------------------------------
  // 3. Projeto
  // ------------------------------------------------------------------------

  const projetoRes = await fetch(`${restBase}/projects`, {
    method: 'POST',
    headers: writeHeaders,
    body: JSON.stringify({
      client_id: clientId,
      nome: `Plano de Correção — ${dominio}`,
      tipo_servico: TIPO_SERVICO,
      origem: 'scan',
    }),
  })
  if (!projetoRes.ok) {
    return falhar(
      'falha_ao_criar_projeto',
      502,
      `${projetoRes.status} ${await projetoRes.text()}`
    )
  }
  const projetos = (await projetoRes.json()) as Array<{ id: string }>
  if (!projetos[0]) {
    return falhar('falha_ao_criar_projeto', 502, 'resposta sem linha')
  }
  projetoCriadoId = projetos[0].id
  const projectId = projetos[0].id

  // ------------------------------------------------------------------------
  // 4. Recebível — vence hoje, pendente até o webhook do Mercado Pago
  // ------------------------------------------------------------------------
  // O payment_token é gerado AQUI em vez de deixar o default do banco para que
  // `payment_link` já entre preenchido no MESMO insert. Assim a linha nasce
  // completa: a equipe vê o link no Financeiro sem precisar clicar em "Gerar
  // link", e não existe janela em que a cobrança esteja no banco sem link.
  // (O e-mail automático "nova cobrança" não se aplica aqui — a migration
  // 20260907160000 exclui origem 'scan' do trigger notify_client_parcela_criada,
  // porque o comprador está olhando o checkout neste exato instante.)

  const paymentToken = crypto.randomUUID()
  // O recebível continua sendo criado (o painel e a contabilidade contam com
  // ele), mas quem cobra agora é o checkout próprio: a página de /pagar é o
  // fluxo antigo, com o Brick do Mercado Pago e sem os selos, o desconto no
  // Pix e o cartão em Secure Fields que o checkout novo já tem no ar.
  const paymentUrl = urlDoCheckout(analysisId, paymentToken)

  const recebivelRes = await fetch(`${restBase}/receivables`, {
    method: 'POST',
    headers: writeHeaders,
    body: JSON.stringify({
      project_id: projectId,
      client_id: clientId,
      descricao: `Plano de Correção — ${dominio}`,
      valor: centavosParaReais(valorCentavos),
      vencimento: hojeISO(),
      status: 'pendente',
      origem: 'scan',
      payment_token: paymentToken,
      payment_link: paymentUrl,
    }),
  })
  if (!recebivelRes.ok) {
    return falhar(
      'falha_ao_criar_recebivel',
      502,
      `${recebivelRes.status} ${await recebivelRes.text()}`
    )
  }
  const recebiveis = (await recebivelRes.json()) as ReceivableRecord[]
  const recebivel = recebiveis[0]
  if (!recebivel) {
    return falhar('falha_ao_criar_recebivel', 502, 'resposta sem linha')
  }
  recebivelCriadoId = recebivel.id

  // ------------------------------------------------------------------------
  // 5. Compra — amarra análise, lead, cliente, projeto e recebível
  // ------------------------------------------------------------------------
  // O lead veio no corpo, validado: é ele que o índice único vigia e é a ele
  // que o worker volta na hora de entregar (plataforma, faturamento, e-mail).

  const compraRes = await fetch(`${restBase}/raiox_compras`, {
    method: 'POST',
    headers: writeHeaders,
    body: JSON.stringify({
      analysis_id: analysisId,
      lead_id: leadId,
      client_id: clientId,
      project_id: projectId,
      receivable_id: recebivel.id,
      valor_centavos: valorCentavos,
      status: 'aguardando_pagamento',
      plano_code: gerarPlanoCode(),
    }),
  })

  if (!compraRes.ok) {
    const detalhe = await compraRes.text()

    // 23505 = violação de unicidade. Na prática só o índice parcial por
    // lead_id: outra requisição simultânea do MESMO lead ganhou a corrida.
    // Desfaz o que esta criou e devolve a compra da outra — o comprador vê um
    // link só.
    if (compraRes.status === 409 && detalhe.includes('23505')) {
      await desfazer()
      const vencedora = await buscarCompraExistente()
      if (vencedora) {
        return responderCompra(vencedora)
      }
      return jsonResponse({ error: 'falha_ao_registrar_compra' }, 502)
    }

    return falhar(
      'falha_ao_registrar_compra',
      502,
      `${compraRes.status} ${detalhe}`
    )
  }

  const compras = (await compraRes.json()) as CompraRecord[]
  const compra = compras[0]
  if (!compra) {
    return falhar('falha_ao_registrar_compra', 502, 'resposta sem linha')
  }

  return jsonResponse({
    compra_id: compra.id,
    receivable_id: recebivel.id,
    plano_code: compra.plano_code,
    payment_url: paymentUrl,
  })
})
