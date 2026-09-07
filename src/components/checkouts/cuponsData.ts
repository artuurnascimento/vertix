import { catalogoSupabase } from '../produtos/catalogoSupabase'

/**
 * Cupons de desconto (public.cupons).
 *
 * Duas regras vêm do próprio banco e valem para esta tela:
 *  • `codigo` é guardado SEMPRE em maiúsculas (check constraint);
 *  • `valor` muda de unidade conforme o tipo — pontos percentuais (1 a 100)
 *    no percentual, CENTAVOS no fixo.
 *
 * `usos` é incrementado só quando o pagamento é aprovado (função
 * cupom_registrar_uso). O painel apenas lê esse número.
 */

export const CUPOM_TIPOS = ['percentual', 'fixo'] as const
export type CupomTipo = (typeof CUPOM_TIPOS)[number]

export const CUPOM_TIPO_LABEL: Record<CupomTipo, string> = {
  percentual: 'Percentual (%)',
  fixo: 'Valor fixo (R$)',
}

export interface Cupom {
  id: string
  codigo: string
  tipo: CupomTipo
  valor: number
  validade: string | null
  limite_uso: number | null
  usos: number
  produto_id: string | null
  ativo: boolean
  created_at: string
}

export type CupomPayload = Omit<Cupom, 'id' | 'usos' | 'created_at'>

const COLUNAS =
  'id, codigo, tipo, valor, validade, limite_uso, usos, produto_id, ativo, created_at'

export async function fetchCupons(): Promise<Cupom[]> {
  const { data, error } = await catalogoSupabase
    .from('cupons')
    .select(COLUNAS)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as Cupom[]
}

export async function criarCupom(payload: CupomPayload): Promise<void> {
  const { error } = await catalogoSupabase.from('cupons').insert(payload)
  if (error) throw error
}

export async function atualizarCupom(
  id: string,
  payload: CupomPayload
): Promise<void> {
  const { error } = await catalogoSupabase.from('cupons').update(payload).eq('id', id)
  if (error) throw error
}

export async function excluirCupom(id: string): Promise<void> {
  const { error } = await catalogoSupabase.from('cupons').delete().eq('id', id)
  if (error) throw error
}

/** Cupom que não vale mais: desativado, vencido ou com o limite estourado. */
export function cupomEsgotado(cupom: Cupom, agora = new Date()): boolean {
  if (!cupom.ativo) return true
  if (cupom.validade !== null && new Date(cupom.validade) <= agora) return true
  return cupom.limite_uso !== null && cupom.usos >= cupom.limite_uso
}
