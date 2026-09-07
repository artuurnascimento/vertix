import { catalogoSupabase } from './catalogoSupabase'

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
  ativo: boolean
}

const COLUNAS =
  'id, nome, slug, descricao, preco_centavos, preco_ancora_centavos, tipo, entrega, ativo, created_at, updated_at'

export async function fetchProdutos(): Promise<Produto[]> {
  const { data, error } = await catalogoSupabase
    .from('produtos')
    .select(COLUNAS)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as Produto[]
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
