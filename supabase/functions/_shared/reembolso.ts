/**
 * Mecânica de reembolso no Mercado Pago, compartilhada pelas duas funções que
 * devolvem dinheiro pelo painel: `checkout-reembolsar` (tabela `pedidos`) e
 * `scan-reembolsar` (tabela `raiox_compras`).
 *
 * POR QUE ISTO É UM MÓDULO E NÃO CÓPIA COLADA
 *   Os dois fluxos diferem só no BANCO — tabelas, RPCs e vocabulário de status
 *   diferentes, mais a descoberta do pagamento que só o Scan precisa. O que
 *   fazem no GATEWAY é idêntico até a vírgula, e é a parte cara de errar: a
 *   chave de idempotência, o header de contingência, a distinção entre
 *   "recusou" e "não sei", a reconciliação por GET do pagamento. Duas cópias
 *   dessas regras divergiriam no primeiro conserto feito só de um lado.
 *
 * O que NÃO mora aqui, de propósito: reserva, conclusão e liberação. Elas são
 * decisões sobre o estado do banco de cada fluxo, e escondê-las atrás de uma
 * abstração comum tornaria ilegível o que cada tabela faz com o próprio
 * recebível.
 *
 * NUNCA loga MP_ACCESS_TOKEN, JWT do chamador, dado de cartão nem documento do
 * cliente.
 *
 * Referências (documentação oficial do Mercado Pago):
 *   POST /v1/payments/{payment_id}/refunds — corpo vazio = reembolso total;
 *   resposta 201 { id, payment_id, amount, status }. O header
 *   `X-Render-In-Process-Refunds: true` faz o reembolso em contingência voltar
 *   como 201 com status 'in_process' em vez de 400.
 *   https://www.mercadopago.com.br/developers/pt/docs/checkout-api-payments/payment-management/cancellations-and-refunds/refund-pix
 *   GET /v1/payments/{id} — status do pagamento e lista de `refunds`:
 *   https://www.mercadopago.com.br/developers/pt/reference/payments/_payments_id/get
 *   GET /v1/payments/search — busca de pagamentos por filtros, entre eles
 *   `external_reference` (o CLI oficial expõe o mesmo filtro como
 *   `mpcli payments search --external-reference`), com resposta paginada
 *   { paging: { total, limit, offset }, results: [...] }:
 *   https://www.mercadopago.com.br/developers/pt/docs/mp-cli/commands
 *   https://www.mercadopago.com.br/developers/pt/reference/payments/_payments_search/get
 *   `X-Idempotency-Key` em operações de reembolso:
 *   https://www.mercadopago.com.br/developers/pt/docs/qr-code/migrate-dynamic-qr-model-to-orders
 */

const MP_API = 'https://api.mercadopago.com'

/**
 * Teto de espera pelo Mercado Pago. Generoso de propósito, ao contrário do
 * timeout do worker em _shared/entrega.ts: aqui não há alternativa recuperável
 * do outro lado, e desistir cedo produz exatamente o estado perigoso — um
 * reembolso que talvez tenha acontecido, sem resposta para gravar.
 */
export const MP_TIMEOUT_MS = 20_000

/** Reembolso criado (ou já existente) no Mercado Pago. */
export interface RefundMp {
  id: string | null
  /** Centavos confirmados pelo MP, quando ele informa o valor. */
  valor_centavos: number | null
  /** 'approved' | 'in_process' — ver o cabeçalho sobre contingência. */
  status: string | null
}

/**
 * Reais (como o MP devolve em `amount`) → centavos, ou null quando não dá para
 * ler um valor.
 *
 * `Math.round` e não `Math.trunc`: 238.14 * 100 dá 23813.999... em ponto
 * flutuante, e truncar produziria um centavo a menos no registro do que voltou
 * para o cliente.
 *
 * `null`, `undefined` e `''` são recusados ANTES de chegar ao `Number`, que os
 * converteria em 0. Zero aqui não seria "não sei quanto": seria o sistema
 * AFIRMANDO que voltaram R$ 0,00, e essa afirmação é gravada — enquanto null
 * deixa o banco cair no valor da própria venda (o `coalesce` das RPCs de
 * conclusão).
 */
export function reaisParaCentavos(valor: unknown): number | null {
  if (valor === null || valor === undefined || valor === '') return null
  const numero = typeof valor === 'number' ? valor : Number(valor)
  if (!Number.isFinite(numero)) return null
  return Math.round(numero * 100)
}

/**
 * O pagamento está reembolsado no Mercado Pago, independentemente do que a
 * nossa chamada respondeu?
 *
 * É a pergunta que transforma um erro do gateway em sucesso reconciliado. Só
 * `refunded` conta: 'charged_back' é contestação do titular — dinheiro que
 * saiu por outro caminho, com outra disputa em andamento —, e tratá-lo como
 * reembolso pedido por nós esconderia um chargeback dentro de um fluxo de
 * atendimento.
 *
 * Devolve null quando não deu para saber. Null NÃO é "não reembolsou": quem
 * chama trata a dúvida como dúvida.
 */
export async function pagamentoJaReembolsado(
  rotulo: string,
  mpToken: string,
  paymentId: string
): Promise<{ reembolsado: boolean; refund: RefundMp } | null> {
  let res: Response
  try {
    res = await fetch(`${MP_API}/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${mpToken}` },
      signal: AbortSignal.timeout(MP_TIMEOUT_MS),
    })
  } catch (erro) {
    console.error(`[${rotulo}] Consulta do pagamento falhou:`, erro)
    return null
  }
  if (!res.ok) {
    console.error(`[${rotulo}] Consulta do pagamento recusada:`, res.status)
    return null
  }

  const corpo = (await res.json().catch(() => null)) as Record<
    string,
    unknown
  > | null
  if (!corpo) return null

  if (corpo.status !== 'refunded') {
    return {
      reembolsado: false,
      refund: { id: null, valor_centavos: null, status: null },
    }
  }

  // O pagamento reembolsado traz a lista de reembolsos. Pegamos o primeiro
  // porque só existe reembolso total aqui; a ausência da lista não invalida o
  // fato de o pagamento estar `refunded`.
  const lista = Array.isArray(corpo.refunds)
    ? (corpo.refunds as Array<Record<string, unknown>>)
    : []
  const primeiro = lista[0]

  return {
    reembolsado: true,
    refund: {
      id: primeiro?.id != null ? String(primeiro.id) : null,
      valor_centavos:
        reaisParaCentavos(primeiro?.amount) ??
        reaisParaCentavos(corpo.transaction_amount_refunded),
      status: primeiro?.status != null ? String(primeiro.status) : 'approved',
    },
  }
}

/**
 * POST /v1/payments/{id}/refunds — reembolso TOTAL (corpo vazio).
 *
 * Devolve o reembolso quando o MP confirma, `null` quando ele recusa de forma
 * definitiva, e LANÇA quando não foi possível saber (rede, timeout, 5xx) —
 * porque essas três situações exigem tratamentos diferentes de quem chama, e
 * colapsar "recusou" com "não sei" é o que produziria um reembolso duplicado.
 *
 * `chaveIdempotencia` tem de ser DETERMINÍSTICA e exclusiva desta operação:
 * sempre a mesma string para a mesma venda (é o que faz o MP devolver o
 * reembolso existente numa rechamada) e diferente da usada na COBRANÇA (mesma
 * chave com corpo diferente é recusada pelo MP).
 */
export async function reembolsarNoMp(
  rotulo: string,
  mpToken: string,
  paymentId: string,
  chaveIdempotencia: string
): Promise<RefundMp | null> {
  let res: Response
  try {
    res = await fetch(`${MP_API}/v1/payments/${paymentId}/refunds`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${mpToken}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': chaveIdempotencia,
        // Reembolso em contingência volta como 201 'in_process' em vez de 400.
        // Sem este header, uma contingência (que É um reembolso a caminho)
        // chegaria aqui como erro, e o dinheiro estaria voltando com o sistema
        // achando que a operação falhou.
        'X-Render-In-Process-Refunds': 'true',
      },
      // Corpo vazio = reembolso total. Mandar `amount` faria dele parcial.
      body: '{}',
      signal: AbortSignal.timeout(MP_TIMEOUT_MS),
    })
  } catch (erro) {
    // Rede ou timeout: NÃO se sabe se o reembolso aconteceu.
    console.error(`[${rotulo}] MP indisponível. Pagamento:`, paymentId, erro)
    throw new Error('mp_indisponivel')
  }

  const corpo = (await res.json().catch(() => ({}))) as Record<string, unknown>

  if (!res.ok) {
    // O corpo do erro do MP não carrega access token nem dado de cartão.
    console.error(
      `[${rotulo}] MP recusou o reembolso:`,
      res.status,
      'pagamento:',
      paymentId,
      JSON.stringify(corpo).slice(0, 500)
    )
    // 5xx é falha do lado deles, não recusa: pode ter reembolsado assim mesmo.
    if (res.status >= 500) throw new Error('mp_indisponivel')
    return null
  }

  return {
    id: corpo.id != null ? String(corpo.id) : null,
    valor_centavos: reaisParaCentavos(corpo.amount),
    status: corpo.status != null ? String(corpo.status) : null,
  }
}

// ---------------------------------------------------------------------------
// Descoberta do pagamento pelas vendas que não guardaram o id
// ---------------------------------------------------------------------------

/** Um pagamento devolvido pela busca, já reduzido ao que decide o reembolso. */
export interface PagamentoEncontrado {
  id: string
  status: string
  valor_centavos: number | null
}

export type BuscaPagamento =
  | { resultado: 'encontrado'; pagamento: PagamentoEncontrado }
  /** A referência não tem NENHUM pagamento que tenha cobrado o cliente. */
  | { resultado: 'nao_encontrado' }
  /** Mais de um candidato válido — ver o comentário da função. */
  | { resultado: 'ambiguo'; candidatos: PagamentoEncontrado[] }
  /** Não deu para perguntar ao MP. Dúvida, não ausência. */
  | { resultado: 'indisponivel' }

/**
 * Status de pagamento que significam "o cliente foi cobrado".
 *
 * 'refunded' entra junto com 'approved' de propósito: um pagamento já
 * estornado (pelo painel do MP, por contestação, ou por uma tentativa nossa
 * que não conseguiu gravar) continua sendo O pagamento daquela venda, e achá-lo
 * é o que permite reconciliar o estado em vez de dizer "não existe pagamento".
 *
 * Todo o resto fica de fora: 'pending', 'in_process', 'rejected' e 'cancelled'
 * nunca tiraram dinheiro de ninguém. O caso concreto é o Pix que expira e o
 * cliente paga de novo — as duas tentativas dividem o mesmo
 * `external_reference`, e só uma cobrou.
 */
const STATUS_COBRADO = new Set(['approved', 'refunded'])

/**
 * Acha no Mercado Pago o pagamento de uma cobrança cujo id nunca foi gravado.
 *
 * O elo é o `external_reference`: quem monta a cobrança grava ali o id do
 * recebível (process-payment) e quem confirma o pagamento lê dali para achar a
 * parcela (payment-webhook). A busca faz o caminho de volta.
 *
 * TRÊS FILTROS, E NENHUM É OPCIONAL — reembolsar o pagamento errado é dinheiro
 * na conta errada:
 *   1. `external_reference` idêntico ao pedido. A busca do MP é por filtro, e
 *      um filtro que o servidor ignorasse traria a conta inteira;
 *   2. status que significa cobrança (ver STATUS_COBRADO);
 *   3. valor igual ao que a venda cobrou, ao centavo.
 *
 * DOIS CANDIDATOS NÃO SÃO UM EMPATE A DESEMPATAR. Dois pagamentos aprovados,
 * na mesma referência e do mesmo valor, querem dizer que o cliente foi cobrado
 * duas vezes — e aí decidir qual estornar (ou estornar os dois) é julgamento
 * de gente, não desempate por data. A função devolve 'ambiguo' com os ids, e
 * quem chama recusa e manda resolver à mão.
 */
export async function buscarPagamentoPorReferencia(
  rotulo: string,
  mpToken: string,
  externalReference: string,
  valorCentavos: number
): Promise<BuscaPagamento> {
  const url =
    `${MP_API}/v1/payments/search?external_reference=` +
    `${encodeURIComponent(externalReference)}&sort=date_created&criteria=desc`

  let res: Response
  try {
    res = await fetch(url, {
      headers: { Authorization: `Bearer ${mpToken}` },
      signal: AbortSignal.timeout(MP_TIMEOUT_MS),
    })
  } catch (erro) {
    console.error(`[${rotulo}] Busca de pagamento falhou:`, erro)
    return { resultado: 'indisponivel' }
  }
  if (!res.ok) {
    console.error(`[${rotulo}] Busca de pagamento recusada:`, res.status)
    return { resultado: 'indisponivel' }
  }

  const corpo = (await res.json().catch(() => null)) as Record<
    string,
    unknown
  > | null
  if (!corpo || !Array.isArray(corpo.results)) {
    console.error(`[${rotulo}] Busca de pagamento devolveu corpo inesperado.`)
    return { resultado: 'indisponivel' }
  }

  const candidatos = (corpo.results as Array<Record<string, unknown>>)
    .filter((p) => String(p.external_reference ?? '') === externalReference)
    .filter((p) => STATUS_COBRADO.has(String(p.status ?? '')))
    .map((p) => ({
      id: p.id != null ? String(p.id) : '',
      status: String(p.status ?? ''),
      valor_centavos: reaisParaCentavos(p.transaction_amount),
    }))
    .filter((p) => p.id !== '' && p.valor_centavos === valorCentavos)

  if (candidatos.length === 0) return { resultado: 'nao_encontrado' }
  if (candidatos.length > 1) {
    console.error(
      `[${rotulo}] AMBIGUIDADE — a referência ${externalReference} tem ` +
        `${candidatos.length} pagamentos que cobraram o valor da venda ` +
        `(${candidatos.map((c) => `${c.id}:${c.status}`).join(', ')}). ` +
        'Nenhum reembolso foi tentado: resolver no painel do Mercado Pago.'
    )
    return { resultado: 'ambiguo', candidatos }
  }

  return { resultado: 'encontrado', pagamento: candidatos[0] }
}

// ---------------------------------------------------------------------------
// Autenticação do painel
// ---------------------------------------------------------------------------

export type Autenticacao =
  | { ok: true; usuarioId: string }
  | { ok: false; erro: string; status: number }

/**
 * O chamador é gente do painel?
 *
 * `verify_jwt` da plataforma já barrou quem não tem token — nenhuma das duas
 * functions de reembolso aparece em `config.toml`, e isso é deliberado: sem
 * entrada, `verify_jwt` fica no padrão `true` e a plataforma recusa antes de o
 * nosso código rodar. Aqui o JWT é resolvido para saber QUEM é (o reembolso é
 * gravado com autor) e conferido contra `profiles`: um JWT válido pode ser de
 * qualquer conta do projeto Supabase, inclusive de alguém que nunca foi da
 * equipe. Mesmo critério da create-payment-link, a outra function do painel
 * que mexe em dinheiro.
 */
export async function autenticarPainel(
  rotulo: string,
  req: Request,
  supabaseUrl: string,
  serviceRoleKey: string
): Promise<Autenticacao> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return { ok: false, erro: 'nao_autenticado', status: 401 }
  }
  const jwt = authHeader.slice('Bearer '.length)

  const usuarioRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: serviceRoleKey, Authorization: `Bearer ${jwt}` },
  })
  if (!usuarioRes.ok) {
    return { ok: false, erro: 'nao_autenticado', status: 401 }
  }
  const usuario = (await usuarioRes.json()) as { id?: string }
  if (!usuario.id) {
    return { ok: false, erro: 'nao_autenticado', status: 401 }
  }

  const perfilRes = await fetch(
    `${supabaseUrl}/rest/v1/profiles?id=eq.${usuario.id}&select=id`,
    {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    }
  )
  if (!perfilRes.ok) {
    console.error(`[${rotulo}] Falha ao checar profile:`, perfilRes.status)
    return { ok: false, erro: 'falha_ao_validar_permissao', status: 502 }
  }
  const perfis = (await perfilRes.json()) as Array<{ id: string }>
  if (perfis.length === 0) {
    return { ok: false, erro: 'acesso_negado', status: 403 }
  }

  return { ok: true, usuarioId: usuario.id }
}
