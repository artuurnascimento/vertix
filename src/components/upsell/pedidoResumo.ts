/**
 * Monta a lista "o que você comprou" da tela de obrigado.
 *
 * O pedido tem duas fontes possíveis e nenhuma delas é garantida sozinha:
 *
 *   1. O banco, via RPC do pedido — completo, mas ainda não existe no contrato
 *      fechado com o agente do backend (ver checkoutDados.carregarPedido).
 *   2. O que a própria sessão sabe: a configuração do checkout (nome e preço do
 *      produto principal e do order bump) mais o que a tela de upsell acabou de
 *      cobrar, entregue pelo estado de navegação.
 *
 * Quando só a fonte 2 existe, o resumo é marcado como `parcial` e a tela diz
 * isso em voz alta — preferimos admitir que o detalhamento pode estar
 * incompleto a listar um total que não bate com o extrato do cartão.
 */

import type { CheckoutInfo, ProdutoInfo } from './upsellFluxo'

export type TipoItem = 'principal' | 'bump' | 'upsell'

export interface ItemPedido {
  id: string
  nome: string
  precoCentavos: number | null
  tipo: TipoItem
}

export interface PedidoResumo {
  itens: ItemPedido[]
  /** null quando não dá para somar com honestidade (algum preço desconhecido). */
  totalCentavos: number | null
  /** true = o detalhamento veio da sessão, não do banco. */
  parcial: boolean
  email: string | null
}

/** Item cobrado na tela de upsell, passado adiante pelo estado de navegação. */
export interface UpsellAceito {
  produtoId: string
  nome: string
  precoCentavos: number | null
}

/**
 * Status do pedido, devolvido pela edge function `checkout-info`. Campos
 * opcionais porque a tela precisa funcionar com respostas parciais — e porque
 * "não sei" nunca pode ser lido como "sim" (ver temCartaoSalvo).
 */
export interface StatusPedido {
  /**
   * Situação do pagamento: 'aguardando', 'pago', 'recusado' ou 'reembolsado'.
   *
   * A `checkout-info` sempre devolveu este campo — ela inclusive consulta o
   * Mercado Pago quando o pedido está aguardando — mas ele não estava
   * declarado aqui, então a confirmação nunca o leu e anunciava "compra
   * confirmada" para todo mundo, inclusive para quem gerou um Pix e não pagou.
   */
  status?: string | null
  email?: string | null
  total_centavos?: number | null
  itens?: ReadonlyArray<{
    id?: string | null
    nome?: string | null
    preco_centavos?: number | null
    tipo?: string | null
  }> | null
  /** Se o pedido diz que o bump entrou, respeitamos isso em vez de adivinhar. */
  bump_aceito?: boolean | null
  /** Código curto do Plano de Correção, quando o pedido é do Vertix Scan. */
  plano_code?: string | null
  /** false para quem pagou por Pix e para os casos em que o cartão não foi salvo. */
  tem_cartao_salvo?: boolean | null
  /** Id do cartão salvo no Mercado Pago; entra em createCardToken({ cardId }). */
  card_id?: string | null
  /** "4242" — só para o texto da tela ("o cartão final 4242"). */
  ultimos_digitos?: string | null
}

/**
 * Só true quando o pedido AFIRMA ter cartão salvo e traz o id dele. Status
 * ausente (falha de rede, function fora do ar) conta como "sem cartão": o
 * desfecho é a pessoa ir direto para a confirmação, que é seguro. O contrário
 * — otimismo — mostraria uma oferta que não tem como ser cobrada.
 */
export function temCartaoSalvo(
  status: StatusPedido | null | undefined
): status is StatusPedido & { card_id: string } {
  return Boolean(status?.tem_cartao_salvo && status.card_id)
}

const TIPOS: readonly TipoItem[] = ['principal', 'bump', 'upsell']

function normalizarTipo(tipo: string | null | undefined): TipoItem {
  return TIPOS.includes(tipo as TipoItem) ? (tipo as TipoItem) : 'principal'
}

function itemDoProduto(produto: ProdutoInfo, tipo: TipoItem): ItemPedido {
  return {
    id: produto.id,
    nome: produto.nome,
    precoCentavos: Number.isFinite(produto.preco_centavos)
      ? produto.preco_centavos
      : null,
    tipo,
  }
}

/**
 * Soma os itens. Um único preço desconhecido derruba o total para null: um
 * total que ignora item é pior do que total nenhum, porque parece certo.
 */
export function somarTotal(itens: readonly ItemPedido[]): number | null {
  let total = 0
  for (const item of itens) {
    if (item.precoCentavos === null) return null
    total += item.precoCentavos
  }
  return total
}

interface EntradaResumo {
  info: CheckoutInfo | null | undefined
  pedido: StatusPedido | null | undefined
  upsellAceito: UpsellAceito | null | undefined
  /** total_centavos que a edge function devolveu após cobrar o upsell. */
  totalDaCobranca?: number | null
}

/**
 * Resumo final. Quando o banco entrega os itens, ele manda; a sessão só
 * completa o que faltar (o upsell recém-cobrado costuma chegar antes de o
 * pedido ser relido).
 */
export function montarResumo({
  info,
  pedido,
  upsellAceito,
  totalDaCobranca,
}: EntradaResumo): PedidoResumo {
  const doBanco = (pedido?.itens ?? [])
    .filter((linha) => Boolean(linha?.nome))
    .map((linha, indice): ItemPedido => {
      const preco = linha.preco_centavos
      return {
        id: linha.id ?? `item-${indice}`,
        nome: linha.nome as string,
        precoCentavos:
          typeof preco === 'number' && Number.isFinite(preco) ? preco : null,
        tipo: normalizarTipo(linha.tipo),
      }
    })

  const itens = doBanco.length > 0 ? [...doBanco] : montarDaSessao(info, pedido)

  // O upsell entra se ainda não estiver no que veio do banco.
  if (upsellAceito && !itens.some((i) => i.id === upsellAceito.produtoId)) {
    itens.push({
      id: upsellAceito.produtoId,
      nome: upsellAceito.nome,
      precoCentavos: upsellAceito.precoCentavos,
      tipo: 'upsell',
    })
  }

  const totalConhecido =
    typeof pedido?.total_centavos === 'number'
      ? pedido.total_centavos
      : typeof totalDaCobranca === 'number'
        ? totalDaCobranca
        : somarTotal(itens)

  return {
    itens,
    totalCentavos: totalConhecido ?? null,
    parcial: doBanco.length === 0,
    email: pedido?.email ?? null,
  }
}

/**
 * Reconstrução pela configuração do checkout. O order bump só entra quando o
 * pedido confirma que foi aceito — do contrário estaríamos afirmando que a
 * pessoa comprou algo que talvez tenha recusado.
 */
function montarDaSessao(
  info: CheckoutInfo | null | undefined,
  pedido: StatusPedido | null | undefined
): ItemPedido[] {
  const itens: ItemPedido[] = []
  if (info?.produto) itens.push(itemDoProduto(info.produto, 'principal'))
  if (info?.bump && pedido?.bump_aceito) {
    itens.push(itemDoProduto(info.bump, 'bump'))
  }
  return itens
}

const ROTULOS: Record<TipoItem, string> = {
  principal: 'Produto',
  bump: 'Item adicional',
  upsell: 'Adicionado depois',
}

/** O que a tela de confirmação deve afirmar sobre o pagamento. */
export type SituacaoPedido =
  | 'pago'
  | 'aguardando'
  | 'recusado'
  | 'reembolsado'
  /** O servidor não respondeu. Não sabemos, e não podemos fingir que sabemos. */
  | 'desconhecido'

/**
 * Traduz o status do servidor para o que a tela pode AFIRMAR.
 *
 * A regra que importa: só `'pago'` autoriza dizer que a compra está
 * confirmada. Qualquer outra coisa — inclusive silêncio do servidor — cai em
 * um texto que não promete pagamento nenhum.
 *
 * Dizer "compra confirmada" para quem não pagou é a pior falha possível nesta
 * tela: a pessoa fecha o Pix achando que terminou, o produto nunca chega, e o
 * que era uma venda pendente vira uma reclamação de quem tem certeza de que
 * pagou.
 */
export function situacaoDoPedido(
  status: string | null | undefined
): SituacaoPedido {
  const limpo = typeof status === 'string' ? status.trim().toLowerCase() : ''

  // 'aprovado' aparece no vocabulário da resposta de pagamento; 'pago' é o do
  // banco. Os dois querem dizer a mesma coisa e os dois precisam ser aceitos.
  if (limpo === 'pago' || limpo === 'aprovado') return 'pago'
  if (limpo === 'aguardando' || limpo === 'pendente') return 'aguardando'
  if (limpo === 'recusado' || limpo === 'rejeitado') return 'recusado'
  if (limpo === 'reembolsado') return 'reembolsado'
  return 'desconhecido'
}

export function rotuloDoTipo(tipo: TipoItem): string {
  return ROTULOS[tipo]
}

/**
 * O Plano de Correção do Scan tem página própria (scan.vertix.studio/plano/…)
 * e é o único produto com entrega imediata na web; identificamos pelo nome
 * porque o catálogo ainda não marca o produto com um tipo de entrega.
 */
export function ehPlanoDeCorrecao(itens: readonly ItemPedido[]): boolean {
  return itens.some((item) => /plano de corre/i.test(item.nome))
}

// Site público do Scan. A env é só um override; o padrão é o domínio real.
// Repetido aqui (em vez de importar de leadsRaiox/raioxData) de propósito: o
// módulo do painel arrasta um segundo client Supabase para dentro do bundle
// público, e esta tela precisa carregar leve.
const SCAN_BASE = (
  (import.meta.env.VITE_RAIOX_REPORT_URL as string | undefined) ??
  'https://scan.vertix.studio'
).replace(/\/+$/, '')

/**
 * Página do Plano de Correção entregue ao comprador. Sem o código curto não dá
 * para montar o link direto — a tela cai no site do Scan e avisa que o link do
 * plano chega por e-mail.
 */
export function planoScanUrl(code: string | null | undefined): string {
  return code ? `${SCAN_BASE}/plano/${encodeURIComponent(code)}` : SCAN_BASE
}
