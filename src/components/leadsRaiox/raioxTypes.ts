/**
 * Tipos do contrato Raio-X (raiox-vertix/CONTRACT.md, seção "Banco").
 * Espelham as tabelas `analyses` e `leads` do Supabase do raiox — apenas os
 * campos que o painel usa (LightResult resumido, sem DeepResult).
 */

export const LEAD_STATUSES = [
  'novo',
  'contatado',
  'reuniao',
  'cliente',
] as const

export type LeadStatus = (typeof LEAD_STATUSES)[number]

export type AnalysisStatus =
  | 'queued_light'
  | 'light_running'
  | 'light_done'
  | 'queued_deep'
  | 'deep_running'
  | 'deep_done'
  | 'failed'

export interface LightProblem {
  title: string
  why: string
  category: string
}

/** Resumo do `analyses.light_result` — só o que o painel precisa. */
export interface LightResultResumo {
  problems_total?: number
  free_problems?: LightProblem[]
  categories?: Record<string, number>
}

export interface Analysis {
  id: string
  url: string
  domain: string
  status: AnalysisStatus
  score: number | null
  light_result: LightResultResumo | null
  created_at: string
}

export interface Lead {
  id: string
  analysis_id: string
  name: string
  whatsapp: string
  status: LeadStatus
  created_at: string
}

/** Lead com a análise correspondente embutida (join no select). */
export interface LeadComAnalise extends Lead {
  analyses: Analysis | null
}
