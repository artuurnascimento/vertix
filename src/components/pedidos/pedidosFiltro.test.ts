import { describe, expect, it } from 'vitest'
import type { Pedido, PedidoItem } from './pedidosData'
import {
  SEM_CATEGORIA,
  TODOS,
  categoriaDoItem,
  categoriasDosPedidos,
  filtrarPedidos,
  produtosDosPedidos,
  type CategoriasPorProduto,
} from './pedidosFiltro'

/**
 * O que estes testes protegem é um número que vira decisão de negócio.
 *
 * "Quanto faturamos com tema sob medida?" é a pergunta que decide onde a
 * Vertix investe. Um filtro que conta item não pago, ou que esconde um pedido
 * misto, responde errado — e errado com cara de exato, que é o pior tipo.
 */

const item = (p: Partial<PedidoItem> = {}): PedidoItem => ({
  produto_id: 'prod-plano',
  nome: 'Plano de Correção',
  tipo: 'principal',
  preco_centavos: 19700,
  pago: true,
  entrega: 'plano_scan',
  receivable_id: null,
  ...p,
})

const pedido = (itens: PedidoItem[], id = 'ped-1'): Pedido =>
  ({
    id,
    criado_em: '2026-09-08T12:00:00.000Z',
    cliente_nome: 'Artur',
    cliente_email: 'artur@vertix.studio',
    cliente_whatsapp: null,
    itens,
    subtotal_centavos: 19700,
    desconto_centavos: 0,
    desconto_metodo_centavos: 0,
    total_centavos: 19700,
    status: 'pago',
  }) as Pedido

const CATEGORIAS: CategoriasPorProduto = {
  'prod-plano': 'Plano',
  'prod-tema': 'Tema sob medida',
  'prod-sem': null,
}

describe('categoriaDoItem', () => {
  it('resolve pela categoria do catálogo', () => {
    expect(categoriaDoItem(item({ produto_id: 'prod-tema' }), CATEGORIAS)).toBe(
      'Tema sob medida',
    )
  })

  it('produto sem categoria, sem id, ou apagado do catálogo cai no balde', () => {
    // Produto apagado perde a classificação, mas a venda não pode sumir do
    // total — ela aparece como "Sem categoria", visível na tela.
    expect(categoriaDoItem(item({ produto_id: 'prod-sem' }), CATEGORIAS)).toBe(SEM_CATEGORIA)
    expect(categoriaDoItem(item({ produto_id: null }), CATEGORIAS)).toBe(SEM_CATEGORIA)
    expect(categoriaDoItem(item({ produto_id: 'apagado' }), CATEGORIAS)).toBe(SEM_CATEGORIA)
  })

  it('categoria só com espaço conta como ausente', () => {
    expect(categoriaDoItem(item({ produto_id: 'x' }), { x: '   ' })).toBe(SEM_CATEGORIA)
  })
})

describe('as opções que a tela oferece', () => {
  const pedidos = [
    pedido([item(), item({ produto_id: 'prod-tema', nome: 'Tema Shopify' })]),
    pedido([item({ produto_id: 'prod-sem', nome: 'Consultoria' })], 'ped-2'),
  ]

  it('lista os produtos sem repetir e em ordem alfabética', () => {
    expect(produtosDosPedidos(pedidos)).toEqual([
      'Consultoria',
      'Plano de Correção',
      'Tema Shopify',
    ])
  })

  it('põe "Sem categoria" no fim, não em ordem alfabética', () => {
    // É balde de resto, não um serviço da Vertix: no topo teria um destaque
    // que não merece.
    expect(categoriasDosPedidos(pedidos, CATEGORIAS)).toEqual([
      'Plano',
      'Tema sob medida',
      SEM_CATEGORIA,
    ])
  })

  it('item não pago não vira opção', () => {
    const so = [pedido([item({ nome: 'Upsell reservado', pago: false })])]
    expect(produtosDosPedidos(so)).toEqual([])
  })
})

describe('filtrarPedidos', () => {
  const soPlano = pedido([item()], 'so-plano')
  const soTema = pedido([item({ produto_id: 'prod-tema', nome: 'Tema Shopify' })], 'so-tema')
  const misto = pedido(
    [item(), item({ produto_id: 'prod-tema', nome: 'Tema Shopify' })],
    'misto',
  )
  const pedidos = [soPlano, soTema, misto]

  it('sem filtro devolve tudo', () => {
    const r = filtrarPedidos(pedidos, { produto: TODOS, categoria: TODOS }, CATEGORIAS)
    expect(r).toHaveLength(3)
  })

  it('não muta a lista original', () => {
    const original = [...pedidos]
    filtrarPedidos(pedidos, { produto: 'Tema Shopify', categoria: TODOS }, CATEGORIAS)
    expect(pedidos).toEqual(original)
  })

  it('pedido misto aparece ao filtrar por qualquer um dos seus produtos', () => {
    // Esconder o misto faria sumir uma venda que existiu.
    const porTema = filtrarPedidos(
      pedidos,
      { produto: 'Tema Shopify', categoria: TODOS },
      CATEGORIAS,
    )
    expect(porTema.map((p) => p.id)).toEqual(['so-tema', 'misto'])

    const porPlano = filtrarPedidos(
      pedidos,
      { produto: 'Plano de Correção', categoria: TODOS },
      CATEGORIAS,
    )
    expect(porPlano.map((p) => p.id)).toEqual(['so-plano', 'misto'])
  })

  it('filtra por tipo de serviço', () => {
    const r = filtrarPedidos(
      pedidos,
      { produto: TODOS, categoria: 'Tema sob medida' },
      CATEGORIAS,
    )
    expect(r.map((p) => p.id)).toEqual(['so-tema', 'misto'])
  })

  it('os dois filtros se somam: produto E categoria', () => {
    // Produto do Plano com categoria de Tema não existe — resultado vazio, e
    // não a união dos dois, que mostraria vendas que não casam com o pedido.
    const r = filtrarPedidos(
      pedidos,
      { produto: 'Plano de Correção', categoria: 'Tema sob medida' },
      CATEGORIAS,
    )
    expect(r).toEqual([])
  })

  it('item não pago não faz o pedido entrar no filtro', () => {
    // Upsell reservado e não cobrado não é venda daquele produto: contá-lo
    // mostraria faturamento que não houve.
    const reservado = pedido(
      [item({ produto_id: 'prod-tema', nome: 'Tema Shopify', pago: false })],
      'reservado',
    )
    const r = filtrarPedidos(
      [reservado],
      { produto: 'Tema Shopify', categoria: TODOS },
      CATEGORIAS,
    )
    expect(r).toEqual([])
  })
})
