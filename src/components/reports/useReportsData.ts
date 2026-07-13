/**
 * Queries da página Relatórios — todas com prefixo ['reports', ...].
 * Dados sempre reais (sem mock): agregações são computadas no cliente a
 * partir de linhas cruas do Supabase.
 */

import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { Tables } from '../../lib/database.types'

export type ReportProject = Pick<
  Tables<'projects'>,
  'id' | 'status' | 'tipo_servico' | 'created_at'
>

export type ReportProposal = Pick<
  Tables<'proposals'>,
  'id' | 'status' | 'sent_at' | 'accepted_at'
>

export type ReportReceivable = Pick<
  Tables<'receivables'>,
  'id' | 'valor' | 'status' | 'pago_em' | 'project_id' | 'client_id'
> & {
  projects: Pick<Tables<'projects'>, 'tipo_servico'> | null
  clients: Pick<Tables<'clients'>, 'id' | 'nome' | 'empresa'> | null
}

export type ReportStatusHistory = Pick<
  Tables<'project_status_history'>,
  'id' | 'project_id' | 'status' | 'entrou_em'
>

export type ReportExpense = Pick<Tables<'expenses'>, 'id' | 'valor' | 'data'>

export function useReportProjects() {
  return useQuery({
    queryKey: ['reports', 'projects'],
    queryFn: async (): Promise<ReportProject[]> => {
      const { data, error } = await supabase
        .from('projects')
        .select('id, status, tipo_servico, created_at')
      if (error) throw new Error(error.message)
      return data
    },
  })
}

export function useReportProposals() {
  return useQuery({
    queryKey: ['reports', 'proposals'],
    queryFn: async (): Promise<ReportProposal[]> => {
      const { data, error } = await supabase
        .from('proposals')
        .select('id, status, sent_at, accepted_at')
      if (error) throw new Error(error.message)
      return data
    },
  })
}

export function useReportReceivables() {
  return useQuery({
    queryKey: ['reports', 'receivables'],
    queryFn: async (): Promise<ReportReceivable[]> => {
      const { data, error } = await supabase
        .from('receivables')
        .select(
          'id, valor, status, pago_em, project_id, client_id, projects(tipo_servico), clients(id, nome, empresa)'
        )
      if (error) throw new Error(error.message)
      return data as ReportReceivable[]
    },
  })
}

export function useReportStatusHistory() {
  return useQuery({
    queryKey: ['reports', 'status-history'],
    queryFn: async (): Promise<ReportStatusHistory[]> => {
      const { data, error } = await supabase
        .from('project_status_history')
        .select('id, project_id, status, entrou_em')
        .order('entrou_em', { ascending: true })
      if (error) throw new Error(error.message)
      return data
    },
  })
}

export function useReportExpenses() {
  return useQuery({
    queryKey: ['reports', 'expenses'],
    queryFn: async (): Promise<ReportExpense[]> => {
      const { data, error } = await supabase.from('expenses').select('id, valor, data')
      if (error) throw new Error(error.message)
      return data
    },
  })
}
