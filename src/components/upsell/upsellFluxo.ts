/**
 * Regras puras do fluxo pós-compra (upsell → downsell → obrigado).
 *
 * Toda a decisão de "o que mostrar agora" e "o que fazer quando a pessoa
 * recusa" mora aqui, fora do React: é o que permite testar o fluxo sem montar
 * componente, e é o que impede a página de virar uma árvore de `if` no JSX.
 *
 * Contrato consumido (construído por outro agente):
 *   supabase.rpc('get_checkout_info', { p_slug })
 *     → { checkout, produto, bump, prova, garantia, cronometro_ate }
 *   POST /functions/v1/checkout-upsell
 *     body { pedido_id, produto_id, card_token } → { ok, total_centavos, erro? }
 *
 * O corpo leva um TOKEN gerado no navegador pelo SDK do Mercado Pago, nunca o
 * CVV: código de segurança no nosso servidor colocaria a Vertix no escopo do
 * PCI-DSS sem ganho algum. Um corpo com `cvv` é recusado pelo backend com o
 * código `cvv_nao_aceito` — ver CODIGO_BUG_CVV mais abaixo.
 */

// ---------------------------------------------------------------------------
// Tipos do contrato
// ---------------------------------------------------------------------------

export interface ProdutoInfo {
  id: string
  nome: string
  preco_centavos: number
}

/**
 * Configuração do checkout. Só os campos que as telas pós-compra usam — o
 * resto do payload (prova, garantia, cronômetro) é da tela de checkout, que
 * pertence a outro agente.
 *
 * Os `*_preco_centavos` são opcionais porque ainda não está definido se o
 * preço da oferta vem embutido na configuração ou no produto; `precoDaOferta`
 * aceita as duas formas para que a tela não quebre em nenhuma delas.
 */
export interface CheckoutConfig {
  upsell_produto_id?: string | null
  upsell_titulo?: string | null
  upsell_texto?: string | null
  upsell_preco_centavos?: number | null
  downsell_produto_id?: string | null
  downsell_titulo?: string | null
  downsell_texto?: string | null
  downsell_preco_centavos?: number | null
}

export interface CheckoutInfo {
  checkout: CheckoutConfig
  produto: ProdutoInfo | null
  bump: ProdutoInfo | null
  /**
   * Produtos das ofertas. O backend pode entregá-los em campo próprio
   * (`upsell_produto`) ou dentro de uma lista (`produtos`); resolvemos as duas
   * porque o preço é obrigatório na tela e não pode depender do formato.
   */
  upsell_produto?: ProdutoInfo | null
  downsell_produto?: ProdutoInfo | null
  produtos?: ProdutoInfo[] | null
}

/** Resposta da edge function checkout-upsell. */
export interface RespostaUpsell {
  ok?: boolean
  total_centavos?: number | null
  erro?: string | null
}

// ---------------------------------------------------------------------------
// Etapas
// ---------------------------------------------------------------------------

/**
 * `fim` não é uma tela: é o sinal de "leve para /obrigado". Modelar a saída
 * como etapa (em vez de chamar navigate() no meio da regra) deixa o fluxo
 * testável e garante que só existe UM caminho para a confirmação.
 */
export type EtapaOferta = 'upsell' | 'downsell' | 'fim'

export interface Oferta {
  etapa: 'upsell' | 'downsell'
  produtoId: string
  titulo: string
  texto: string | null
  /**
   * Nome do produto no catálogo. Separado do `titulo` de propósito: o título é
   * copy de venda ("Leve também o acompanhamento"), e é o NOME que precisa
   * aparecer no resumo do pedido e bater com o extrato do cartão.
   */
  nomeProduto: string | null
  /** null quando o backend ainda não expôs o preço da oferta. */
  precoCentavos: number | null
}

const TITULO_PADRAO: Record<'upsell' | 'downsell', string> = {
  upsell: 'Uma última oportunidade',
  downsell: 'Que tal esta opção?',
}

function produtoDaEtapa(
  info: CheckoutInfo,
  etapa: 'upsell' | 'downsell',
  produtoId: string
): ProdutoInfo | null {
  const direto =
    etapa === 'upsell' ? info.upsell_produto : info.downsell_produto
  if (direto) return direto

  const candidatos = [
    ...(info.produtos ?? []),
    info.produto,
    info.bump,
  ].filter((p): p is ProdutoInfo => Boolean(p))

  return candidatos.find((p) => p.id === produtoId) ?? null
}

/**
 * Preço da oferta. Prefere o produto (fonte da verdade do catálogo) e cai na
 * configuração do checkout quando o backend só expõe o preço por lá. Devolve
 * null em vez de 0 quando não há preço: a tela precisa saber a diferença entre
 * "de graça" e "não sei o preço" — no segundo caso ela omite o valor em vez de
 * anunciar R$ 0,00.
 */
export function precoDaOferta(
  info: CheckoutInfo,
  etapa: 'upsell' | 'downsell',
  produto: ProdutoInfo | null
): number | null {
  if (produto && Number.isFinite(produto.preco_centavos)) {
    return produto.preco_centavos
  }
  const naConfig =
    etapa === 'upsell'
      ? info.checkout.upsell_preco_centavos
      : info.checkout.downsell_preco_centavos
  return typeof naConfig === 'number' && Number.isFinite(naConfig)
    ? naConfig
    : null
}

/**
 * A oferta da etapa atual, ou null quando ela não está configurada — é esse
 * null que faz a página pular direto para a confirmação em vez de mostrar um
 * card vazio.
 */
export function resolverOferta(
  info: CheckoutInfo | null | undefined,
  etapa: EtapaOferta
): Oferta | null {
  if (!info || etapa === 'fim') return null

  const { checkout } = info
  const produtoId =
    etapa === 'upsell'
      ? checkout.upsell_produto_id
      : checkout.downsell_produto_id
  if (!produtoId) return null

  const titulo =
    (etapa === 'upsell' ? checkout.upsell_titulo : checkout.downsell_titulo) ??
    TITULO_PADRAO[etapa]
  const texto =
    (etapa === 'upsell' ? checkout.upsell_texto : checkout.downsell_texto) ??
    null
  const produto = produtoDaEtapa(info, etapa, produtoId)

  return {
    etapa,
    produtoId,
    titulo,
    texto,
    nomeProduto: produto?.nome ?? null,
    precoCentavos: precoDaOferta(info, etapa, produto),
  }
}

/**
 * Para onde ir quando a pessoa recusa. O downsell aparece UMA vez só: recusou
 * o upsell e existe downsell → downsell; qualquer outra recusa → confirmação.
 * Insistir uma terceira vez é o que transforma uma oferta em emboscada.
 */
export function proximaEtapaAoRecusar(
  etapa: EtapaOferta,
  info: CheckoutInfo | null | undefined
): EtapaOferta {
  if (etapa !== 'upsell') return 'fim'
  return resolverOferta(info, 'downsell') ? 'downsell' : 'fim'
}

// ---------------------------------------------------------------------------
// Resposta da cobrança
// ---------------------------------------------------------------------------

/**
 * Recusa do backend a um corpo que contenha `cvv`.
 *
 * Este código é o OPOSTO dos demais desta seção: ele não pede nada à pessoa —
 * denuncia um bug NOSSO, um envio que nunca deveria ter saído do navegador com
 * o código de segurança dentro. Fica listado aqui para ser reconhecido e
 * DESVIADO do caminho do CVV: a tela trata como erro genérico (ver
 * MENSAGENS_ERRO) e registra no console para quem estiver depurando.
 */
export const CODIGO_BUG_CVV = 'cvv_nao_aceito'

/**
 * Códigos que significam "o código de segurança digitado não serviu" — a única
 * falha desta tela que a pessoa corrige sozinha, redigitando no campo seguro
 * do Mercado Pago. Várias grafias porque o erro pode vir do SDK (tokenização)
 * ou do gateway (autorização).
 */
const CODIGOS_CVV = new Set([
  'cvv_invalido',
  'security_code_required',
  'cc_rejected_bad_filled_security_code',
])

/**
 * true quando a falha foi no código de segurança e vale pedir para redigitar.
 * `cvv_nao_aceito` NUNCA cai aqui, mesmo contendo "cvv" no nome.
 */
export function precisaCvv(resposta: RespostaUpsell | null | undefined): boolean {
  if (!resposta || resposta.ok) return false
  const codigo = (resposta.erro ?? '').trim()
  if (codigo === CODIGO_BUG_CVV) return false
  return CODIGOS_CVV.has(codigo)
}

/**
 * true quando a resposta denuncia erro de programação nosso, não do comprador.
 * A página usa isso para deixar rastro no console — a pessoa vê apenas a
 * mensagem genérica, que é o que ela pode fazer a respeito.
 */
export function ehBugDeContrato(
  resposta: RespostaUpsell | null | undefined
): boolean {
  return (resposta?.erro ?? '').trim() === CODIGO_BUG_CVV
}

const MENSAGENS_ERRO: Record<string, string> = {
  ja_comprado: 'Esta oferta já está no seu pedido — nada foi cobrado de novo.',
  pedido_nao_encontrado:
    'Não encontramos este pedido. Sua compra anterior segue confirmada.',
  produto_indisponivel: 'Esta oferta não está mais disponível.',
  cartao_recusado:
    'O banco recusou esta cobrança extra. Sua compra anterior segue confirmada e nada foi cobrado agora.',
  cartao_expirado:
    'O cartão usado na compra expirou. Sua compra anterior segue confirmada.',
  saldo_insuficiente:
    'Limite insuficiente para a cobrança extra. Sua compra anterior segue confirmada e nada foi cobrado agora.',
  cvv_invalido: 'Código de segurança incorreto. Confira os dígitos do verso do cartão.',
  sem_cartao_salvo:
    'Não há cartão salvo neste pedido para uma cobrança de um toque.',
  token_falhou:
    'Não conseguimos validar o cartão agora. Sua compra anterior segue confirmada e nada foi cobrado — tente de novo em instantes.',
  sdk_indisponivel:
    'Não foi possível carregar o formulário seguro do cartão. Recarregue a página; sua compra anterior segue confirmada.',
  // Bug nosso (corpo com CVV recusado pelo backend). A pessoa não tem o que
  // corrigir, então recebe o texto neutro de sempre — sem jargão nem culpa.
  [CODIGO_BUG_CVV]:
    'Não foi possível concluir esta cobrança extra por um problema nosso. Sua compra anterior segue confirmada e nada foi cobrado agora.',
}

/**
 * Mensagem de erro da cobrança extra. Toda variação termina dizendo que a
 * compra anterior está de pé e que não houve cobrança dupla: é exatamente o
 * medo de quem vê um erro numa tela de pagamento logo depois de pagar.
 */
export function mensagemErroUpsell(
  resposta: RespostaUpsell | null | undefined
): string {
  const codigo = (resposta?.erro ?? '').trim()
  return (
    MENSAGENS_ERRO[codigo] ??
    'Não foi possível concluir esta cobrança extra. Sua compra anterior segue confirmada e nada foi cobrado agora — você pode tentar de novo ou seguir para o pedido.'
  )
}

// ---------------------------------------------------------------------------
// Formatação
// ---------------------------------------------------------------------------

const BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

/** Centavos → "R$ 19,70". Null/NaN vira "—" em vez de "R$ NaN". */
export function formatarCentavos(centavos: number | null | undefined): string {
  if (typeof centavos !== 'number' || !Number.isFinite(centavos)) return '—'
  return BRL.format(centavos / 100)
}
