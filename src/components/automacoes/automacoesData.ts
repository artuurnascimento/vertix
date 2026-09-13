import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import { normalizarEntregasPendentes } from './automacoes'
import type { EntregaPendente, LinhaDeJobRun, LinhaDeJobStatus } from './automacoes'

/**
 * Fontes do painel Automações: `job_status` e `entregas_pendentes` (migração
 * automacoes — fora de database.types.ts, daí o cliente untyped), `job_runs`
 * (trilha do cron) e a edge function `reprocessar-entrega`.
 */

const cliente = supabase as unknown as SupabaseClient

/** O painel é de plantão: atualiza sozinho a cada minuto enquanto está aberto. */
const ATUALIZAR_A_CADA_MS = 60 * 1000
const RUNS_LIDOS = 300

export const ENTREGAS_PENDENTES_KEY = ['automacoes', 'entregas-pendentes'] as const

export function useJobStatus() {
  return useQuery({
    queryKey: ['automacoes', 'job-status'],
    refetchInterval: ATUALIZAR_A_CADA_MS,
    queryFn: async (): Promise<LinhaDeJobStatus[]> => {
      const { data, error } = await cliente.from('job_status').select('*')
      if (error) throw new Error(error.message)
      return (data ?? []) as LinhaDeJobStatus[]
    },
  })
}

export function useJobRuns() {
  return useQuery({
    queryKey: ['automacoes', 'job-runs'],
    refetchInterval: ATUALIZAR_A_CADA_MS,
    queryFn: async (): Promise<LinhaDeJobRun[]> => {
      const { data, error } = await supabase
        .from('job_runs')
        .select('id, job, status, itens, detalhe, created_at')
        .order('created_at', { ascending: false })
        .limit(RUNS_LIDOS)
      if (error) throw new Error(error.message)
      return data
    },
  })
}

export function useEntregasPendentes() {
  return useQuery({
    queryKey: ENTREGAS_PENDENTES_KEY,
    refetchInterval: ATUALIZAR_A_CADA_MS,
    queryFn: async (): Promise<EntregaPendente[]> => {
      const { data, error } = await cliente.from('entregas_pendentes').select('*')
      if (error) throw new Error(error.message)
      return normalizarEntregasPendentes(data)
    },
  })
}

export interface ResultadoDoReprocessamento {
  estado: 'processando' | 'ja_entregue' | 'em_andamento' | string
}

export async function reprocessarEntrega(entrega: Pick<EntregaPendente, 'tipo' | 'id'>): Promise<ResultadoDoReprocessamento> {
  const { data, error } = await supabase.functions.invoke<{ ok?: boolean; estado?: string; error?: string }>(
    'reprocessar-entrega',
    { body: { tipo: entrega.tipo, id: entrega.id } }
  )
  if (error) {
    // A função devolve JSON com `error` mesmo nos 4xx; o SDK só traz a mensagem genérica.
    const corpo = await (error as { context?: Response }).context?.json?.().catch(() => null)
    throw new Error((corpo as { error?: string } | null)?.error ?? error.message)
  }
  if (!data?.ok) throw new Error(data?.error ?? 'O worker não aceitou o reprocessamento.')
  return { estado: data.estado ?? 'processando' }
}

export function useReprocessarEntrega() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: reprocessarEntrega,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ENTREGAS_PENDENTES_KEY }),
  })
}
