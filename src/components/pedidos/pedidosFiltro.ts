import type { Pedido, PedidoItem } from './pedidosData'

/**
 * Filtro da tela de Pedidos por produto e por tipo de serviço.
 *
 * São duas perguntas diferentes, e o banco só respondia uma:
 *
 * - **produto**: "quanto vendemos do Plano de Correção?" — sai de
 *   `pedidos.itens`, que é snapshot e já guarda `produto_id` e `nome`.
 * - **tipo de serviço**: "quanto faturamos com tema sob medida?" — precisa de
 *   `produtos.categoria`, coluna nova. `produtos.tipo` não serve: ele diz o
 *   papel na oferta (principal, bump, upsell), não o que a coisa é.
 *
 * A categoria vem do CATÁLOGO, não do snapshot, de propósito. O snapshot
 * congela preço e nome, que é o que precisa ficar imutável para o recibo bater
 * com o que foi cobrado. Categoria é classificação gerencial: renomear "tema"
 * para "tema sob medida" tem que reclassificar o histórico inteiro, e não criar
 * duas categorias que somam separado.
 *
 * O preço disso é que produto apagado do catálogo perde a categoria e cai em
 * `SEM_CATEGORIA` — visível na tela, não sumido do total.
 */

/** Rótulo de quem não tem categoria: produto antigo, ou ainda não classificado. */
export const SEM_CATEGORIA = 'Sem categoria'

/** Valor do filtro que não filtra nada. */
export const TODOS = ''

/** `produto_id` → categoria, montado a partir do catálogo. */
export type CategoriasPorProduto = Record<string, string | null>

/** Categoria de um item, já resolvida para exibição. */
export function categoriaDoItem(
  item: PedidoItem,
  categorias: CategoriasPorProduto,
): string {
  if (!item.produto_id) return SEM_CATEGORIA
  const categoria = categorias[item.produto_id]
  return categoria?.trim() ? categoria.trim() : SEM_CATEGORIA
}

/**
 * Itens que valem para o filtro: só os PAGOS.
 *
 * Item reservado pelo upsell e ainda não cobrado (`pago: false`) não é venda
 * daquele produto — contá-lo faria o filtro mostrar faturamento que não houve.
 */
function itensQueContam(pedido: Pedido): PedidoItem[] {
  return pedido.itens.filter((item) => item.pago)
}

/** Nomes de produto presentes nos pedidos, em ordem alfabética e sem repetir. */
export function produtosDosPedidos(pedidos: readonly Pedido[]): string[] {
  const nomes = new Set<string>()
  for (const pedido of pedidos) {
    for (const item of itensQueContam(pedido)) {
      const nome = item.nome.trim()
      if (nome) nomes.add(nome)
    }
  }
  return [...nomes].sort((a, b) => a.localeCompare(b, 'pt-BR'))
}

/**
 * Categorias presentes nos pedidos, alfabéticas, com "Sem categoria" no fim.
 *
 * No fim de propósito: é balde de resto, não um serviço da Vertix, e a ordem
 * alfabética o colocaria no topo com um destaque que ele não merece.
 */
export function categoriasDosPedidos(
  pedidos: readonly Pedido[],
  categorias: CategoriasPorProduto,
): string[] {
  const nomes = new Set<string>()
  for (const pedido of pedidos) {
    for (const item of itensQueContam(pedido)) {
      nomes.add(categoriaDoItem(item, categorias))
    }
  }
  const semResto = [...nomes]
    .filter((n) => n !== SEM_CATEGORIA)
    .sort((a, b) => a.localeCompare(b, 'pt-BR'))
  return nomes.has(SEM_CATEGORIA) ? [...semResto, SEM_CATEGORIA] : semResto
}

export interface FiltroPedidos {
  /** Nome do produto, ou TODOS. */
  produto: string
  /** Categoria de serviço, ou TODOS. */
  categoria: string
}

/**
 * Os pedidos que casam com o filtro.
 *
 * Um pedido entra se QUALQUER item pago dele casar — pedido é a unidade da
 * tela, e esconder um pedido misto (plano + consultoria) ao filtrar por um dos
 * dois faria sumir uma venda que existiu.
 *
 * Os dois filtros se somam: produto E categoria, não produto OU categoria.
 */
export function filtrarPedidos(
  pedidos: readonly Pedido[],
  filtro: FiltroPedidos,
  categorias: CategoriasPorProduto,
): Pedido[] {
  if (filtro.produto === TODOS && filtro.categoria === TODOS) return [...pedidos]

  return pedidos.filter((pedido) =>
    itensQueContam(pedido).some((item) => {
      const casaProduto =
        filtro.produto === TODOS || item.nome.trim() === filtro.produto
      const casaCategoria =
        filtro.categoria === TODOS ||
        categoriaDoItem(item, categorias) === filtro.categoria
      return casaProduto && casaCategoria
    }),
  )
}
