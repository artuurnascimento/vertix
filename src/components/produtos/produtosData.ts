import { catalogoSupabase, ehColunaAusente } from './catalogoSupabase'

/**
 * Leitura e escrita de public.produtos — o catálogo que alimenta os
 * checkouts (produto principal, order bump, upsell e downsell).
 *
 * Preço SEMPRE em centavos aqui e no banco; a conversão para reais acontece
 * só na borda da tela, em precos.ts.
 */

export const PRODUTO_TIPOS = ['principal', 'bump', 'upsell', 'downsell'] as const
export type ProdutoTipo = (typeof PRODUTO_TIPOS)[number]

export const PRODUTO_ENTREGAS = ['plano_scan', 'manual'] as const
export type ProdutoEntrega = (typeof PRODUTO_ENTREGAS)[number]

export const PRODUTO_TIPO_LABEL: Record<ProdutoTipo, string> = {
  principal: 'Principal',
  bump: 'Order bump',
  upsell: 'Upsell',
  downsell: 'Downsell',
}

export const PRODUTO_TIPO_BADGE: Record<ProdutoTipo, string> = {
  principal: 'border-accent/25 bg-accent/10 text-accent',
  bump: 'border-amber-400/20 bg-amber-400/10 text-amber-300',
  upsell: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300',
  downsell: 'border-sky-400/20 bg-sky-400/10 text-sky-300',
}

export const PRODUTO_ENTREGA_LABEL: Record<ProdutoEntrega, string> = {
  plano_scan: 'Plano de Correção (Scan)',
  manual: 'Entrega manual',
}

export interface Produto {
  id: string
  nome: string
  slug: string
  descricao: string | null
  preco_centavos: number
  preco_ancora_centavos: number | null
  tipo: ProdutoTipo
  entrega: ProdutoEntrega
  /**
   * Tipo de serviço da Vertix: tema, app, sistema, consultoria, plano.
   * Texto livre — a linha de serviços muda, e uma lista fechada no código
   * pediria deploy a cada serviço novo. É por aqui que a tela de Pedidos
   * responde "quanto faturamos com tema sob medida".
   *
   * Diferente de `tipo`, que é o papel na oferta: o mesmo Plano de Correção
   * é 'principal' num checkout e pode ser 'bump' em outro.
   *
   * `null` em produto ainda não classificado — e em toda base onde a
   * migração `produtos_categoria` não rodou.
   */
  categoria: string | null
  ativo: boolean
  created_at: string
  updated_at: string
}

/** Campos gravados pelo formulário (id e datas ficam com o banco). */
export interface ProdutoPayload {
  nome: string
  slug: string
  descricao: string | null
  preco_centavos: number
  preco_ancora_centavos: number | null
  tipo: ProdutoTipo
  entrega: ProdutoEntrega
  categoria: string | null
  ativo: boolean
}

const COLUNAS_BASE =
  'id, nome, slug, descricao, preco_centavos, preco_ancora_centavos, tipo, entrega, ativo, created_at, updated_at'

const COLUNAS = `${COLUNAS_BASE}, categoria`

/**
 * O catálogo, mais novo primeiro.
 *
 * `categoria` é pedida na primeira tentativa e abandonada na segunda: a
 * migração que a criou pode não ter rodado nesta base, e o catálogo não pode
 * sumir da tela por causa de uma coluna de classificação gerencial. Quando ela
 * falta, todo produto volta com `categoria: null` — que é exatamente o que a
 * tela mostraria de qualquer forma antes de alguém classificar.
 */
export async function fetchProdutos(): Promise<Produto[]> {
  const consultar = async (colunas: string) => {
    const { data, error } = await catalogoSupabase
      .from('produtos')
      .select(colunas)
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []) as unknown as Produto[]
  }

  try {
    return await consultar(COLUNAS)
  } catch (erro) {
    if (!ehColunaAusente(erro)) throw erro
    const semCategoria = await consultar(COLUNAS_BASE)
    return semCategoria.map((p) => ({ ...p, categoria: null }))
  }
}

/**
 * As categorias que já existem no catálogo, em ordem alfabética e sem repetir.
 *
 * Alimenta o `datalist` do formulário. O ponto é reaproveitar: sem sugestão,
 * "Tema" e "tema sob medida" viram duas categorias que somam separado no
 * relatório de Pedidos, e ninguém percebe até o número não bater.
 */
export function categoriasDoCatalogo(produtos: readonly Produto[]): string[] {
  const nomes = new Set<string>()
  for (const produto of produtos) {
    const categoria = produto.categoria?.trim()
    if (categoria) nomes.add(categoria)
  }
  return [...nomes].sort((a, b) => a.localeCompare(b, 'pt-BR'))
}

export async function criarProduto(payload: ProdutoPayload): Promise<void> {
  const { error } = await catalogoSupabase.from('produtos').insert(payload)
  if (error) throw error
}

export async function atualizarProduto(
  id: string,
  payload: ProdutoPayload
): Promise<void> {
  const { error } = await catalogoSupabase
    .from('produtos')
    .update(payload)
    .eq('id', id)
  if (error) throw error
}

export async function excluirProduto(id: string): Promise<void> {
  const { error } = await catalogoSupabase.from('produtos').delete().eq('id', id)
  if (error) throw error
}
