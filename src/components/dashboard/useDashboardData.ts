/**
 * Queries do Dashboard — todas com prefixo ['dashboard', ...].
 * Outros módulos (Propostas/Financeiro/Briefings) invalidam esse prefixo nas
 * mutações, então os dados daqui se atualizam sozinhos. Nunca usar as keys de
 * outros donos (['projects'], ['clients'], ['receivables'], ['proposals']).
 */

import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { Tables } from '../../lib/database.types'

export type DashboardProject = Pick<
  Tables<'projects'>,
  'id' | 'status' | 'tipo_servico' | 'created_at' | 'updated_at'
>

export type DashboardProposal = Pick<
  Tables<'proposals'>,
  'id' | 'status' | 'valor_total' | 'sent_at' | 'accepted_at' | 'created_at'
>

export type DashboardReceivable = Pick<
  Tables<'receivables'>,
  | 'id'
  | 'descricao'
  | 'valor'
  | 'vencimento'
  | 'status'
  | 'pago_em'
  | 'project_id'
>

export type DashboardBriefing = Pick<
  Tables<'briefings'>,
  'id' | 'status' | 'project_id'
> & {
  projects: Pick<Tables<'projects'>, 'nome'> | null
}

export type DashboardActivityEntry = Tables<'activity_log'> & {
  profiles: Pick<Tables<'profiles'>, 'nome'> | null
  projects: Pick<Tables<'projects'>, 'nome'> | null
}

const ACTIVITY_LIMIT = 6

export function useDashboardProjects() {
  return useQuery({
    queryKey: ['dashboard', 'projects'],
    queryFn: async (): Promise<DashboardProject[]> => {
      const { data, error } = await supabase
        .from('projects')
        .select('id, status, tipo_servico, created_at, updated_at')
      if (error) throw new Error(error.message)
      return data
    },
  })
}

export function useDashboardProposals() {
  return useQuery({
    queryKey: ['dashboard', 'proposals'],
    queryFn: async (): Promise<DashboardProposal[]> => {
      const { data, error } = await supabase
        .from('proposals')
        .select('id, status, valor_total, sent_at, accepted_at, created_at')
      if (error) throw new Error(error.message)
      return data
    },
  })
}

export function useDashboardReceivables() {
  return useQuery({
    queryKey: ['dashboard', 'receivables'],
    queryFn: async (): Promise<DashboardReceivable[]> => {
      const { data, error } = await supabase
        .from('receivables')
        .select('id, descricao, valor, vencimento, status, pago_em, project_id')
      if (error) throw new Error(error.message)
      return data
    },
  })
}

export function useDashboardBriefings() {
  return useQuery({
    queryKey: ['dashboard', 'briefings'],
    queryFn: async (): Promise<DashboardBriefing[]> => {
      const { data, error } = await supabase
        .from('briefings')
        .select('id, status, project_id, projects(nome)')
      if (error) throw new Error(error.message)
      return data as DashboardBriefing[]
    },
  })
}

export function useDashboardActivity() {
  return useQuery({
    queryKey: ['dashboard', 'activity'],
    queryFn: async (): Promise<DashboardActivityEntry[]> => {
      const { data, error } = await supabase
        .from('activity_log')
        .select('*, profiles(nome), projects(nome)')
        .order('created_at', { ascending: false })
        .limit(ACTIVITY_LIMIT)
      if (error) throw new Error(error.message)
      return data
    },
  })
}
