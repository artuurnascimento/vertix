import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useFilaComercial } from '../comercial/comercialData'
import { hojeLocal } from '../comercial/fila'
import { montarPrioridades } from './prioridades'
import type { CartaoDePrioridade, NudgeParaRanking, ProjetoParaRanking } from './prioridades'
import { useDashboardBriefings, useDashboardProposals, useDashboardReceivables } from './useDashboardData'

/**
 * As fontes do ranking único (prioridades.ts): recebíveis, propostas e
 * briefings vêm dos hooks do dashboard; nudges abertos e o índice
 * projeto → cliente são lidos aqui; a fila comercial vem da view
 * fila_comercial. Tudo cacheado pelo TanStack Query, então abrir a aba
 * "Prioridades" não custa mais do que antes.
 */

/** Mesma chave do NudgesPanel: resolver aqui some de lá, e vice-versa. */
export const NUDGES_QUERY_KEY = ['nudges'] as const

export function useNudgesAbertos() {
  return useQuery({
    queryKey: NUDGES_QUERY_KEY,
    queryFn: async (): Promise<NudgeParaRanking[]> => {
      const { data, error } = await supabase
        .from('nudges')
        .select('id, tipo, severidade, titulo, descricao, link, project_id, client_id, created_at')
        .eq('resolvido', false)
        .order('created_at', { ascending: false })
      if (error) throw new Error(error.message)
      return data
    },
  })
}

export function useProjetosParaRanking() {
  return useQuery({
    queryKey: ['dashboard', 'projetos-clientes'],
    queryFn: async (): Promise<ProjetoParaRanking[]> => {
      const { data, error } = await supabase.from('projects').select('id, nome, client_id, clients(nome)')
      if (error) throw new Error(error.message)
      return data.map((p) => ({
        id: p.id,
        nome: p.nome,
        client_id: p.client_id,
        cliente: (p.clients as { nome: string } | null)?.nome ?? null,
      }))
    },
  })
}

export function usePrioridades(): { cartoes: CartaoDePrioridade[]; isLoading: boolean; isError: boolean } {
  const recebiveis = useDashboardReceivables()
  const propostas = useDashboardProposals()
  const briefings = useDashboardBriefings()
  const nudges = useNudgesAbertos()
  const fila = useFilaComercial()
  const projetos = useProjetosParaRanking()

  const fontes = [recebiveis, propostas, briefings, nudges, fila, projetos]
  const isLoading = fontes.some((f) => f.isLoading)
  const isError = fontes.some((f) => f.isError)
  const cartoes =
    isLoading || isError
      ? []
      : montarPrioridades({
          hoje: hojeLocal(),
          recebiveis: recebiveis.data ?? [],
          propostas: propostas.data ?? [],
          briefings: briefings.data ?? [],
          nudges: nudges.data ?? [],
          fila: fila.data ?? [],
          projetos: projetos.data ?? [],
        })
  return { cartoes, isLoading, isError }
}

export function useResolverNudge() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (nudgeId: string) => {
      const { error } = await supabase
        .from('nudges')
        .update({ resolvido: true, resolved_at: new Date().toISOString() })
        .eq('id', nudgeId)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: NUDGES_QUERY_KEY }),
  })
}
