import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import type { EsforcoDaRegra } from '../proposals/diagnostico'

/**
 * Tabela `esforco_por_regra` (migração esforco_por_regra): horas padrão por
 * regra do Scan, editadas em Configurações e lidas pelo formulário de
 * proposta. A tabela não está em database.types.ts; a forma mora em
 * proposals/diagnostico.ts.
 */

const cliente = supabase as unknown as SupabaseClient

export const ESFORCO_QUERY_KEY = ['esforco-por-regra'] as const

/** Muda raramente: não vale refetch a cada abertura do modal de proposta. */
const ESFORCO_STALE_TIME_MS = 5 * 60 * 1000

interface LinhaDeEsforco {
  regra: string
  titulo: string
  horas: number | string
  ativo: boolean
}

export function useEsforcoPorRegra(enabled = true) {
  return useQuery({
    queryKey: ESFORCO_QUERY_KEY,
    enabled,
    staleTime: ESFORCO_STALE_TIME_MS,
    queryFn: async (): Promise<EsforcoDaRegra[]> => {
      const { data, error } = await cliente
        .from('esforco_por_regra')
        .select('regra, titulo, horas, ativo')
        .order('regra')
      if (error) throw new Error(error.message)
      // numeric chega como string pelo PostgREST.
      return ((data ?? []) as LinhaDeEsforco[]).map((l) => ({
        regra: l.regra,
        titulo: l.titulo,
        horas: Number(l.horas) || 0,
        ativo: l.ativo === true,
      }))
    },
  })
}

/** "1,5" | "1.5" | "" → horas com uma casa; vazio ou fora de 0–999 vira null. */
export function horasDoTexto(texto: string): number | null {
  const limpo = texto.trim().replace(',', '.')
  if (limpo === '') return null
  const n = Number(limpo)
  if (!Number.isFinite(n) || n < 0 || n > 999) return null
  return Math.round(n * 10) / 10
}

export interface AtualizacaoDeEsforco {
  regra: string
  horas?: number
  ativo?: boolean
}

export async function atualizarEsforco({ regra, ...campos }: AtualizacaoDeEsforco): Promise<void> {
  const { error } = await cliente
    .from('esforco_por_regra')
    .update({ ...campos, updated_at: new Date().toISOString() })
    .eq('regra', regra)
  if (error) throw new Error(error.message)
}

export function useAtualizarEsforco() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: atualizarEsforco,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ESFORCO_QUERY_KEY }),
  })
}
