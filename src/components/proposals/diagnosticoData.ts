import { useQuery } from '@tanstack/react-query'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import { VALOR_HORA_KEY } from '../settings/settingsSchema'
import { normalizarProblemas } from './diagnostico'
import type { ProblemaDoDiagnostico } from './diagnostico'

/**
 * O diagnóstico do Scan ligado a um projeto, para montar a proposta.
 *
 * Caminho: projeto → cliente → lead do Scan (leads.client_id, gravado por
 * converter_lead_em_cliente) → análise. Pega a análise mais recente que tem
 * problemas: a profunda (deep_result) quando existe, senão os problemas
 * grátis do light_result — vale menos, mas é o que há para o lead que ainda
 * não comprou o Raio-X completo.
 *
 * `leads` e `analyses` não têm o jsonb tipado em database.types.ts; o
 * cliente é o untyped e a normalização fica em diagnostico.ts.
 */

const cliente = supabase as unknown as SupabaseClient

export interface DiagnosticoDoProjeto {
  analysisId: string
  dominio: string
  score: number | null
  problemas: ProblemaDoDiagnostico[]
  fonte: 'deep' | 'light'
  /** Valor da hora de settings; 0 quando não configurado. */
  valorHora: number
}

interface LeadComAnalise {
  analysis_id: string | null
  created_at: string
  analyses: {
    id: string
    domain: string | null
    score: number | string | null
    deep_result: { problems?: unknown } | null
    light_result: { free_problems?: unknown } | null
  } | null
}

function problemasDaAnalise(analise: NonNullable<LeadComAnalise['analyses']>): {
  problemas: ProblemaDoDiagnostico[]
  fonte: 'deep' | 'light'
} | null {
  const profundos = normalizarProblemas(analise.deep_result?.problems)
  if (profundos.length > 0) return { problemas: profundos, fonte: 'deep' }
  const leves = normalizarProblemas(analise.light_result?.free_problems)
  if (leves.length > 0) return { problemas: leves, fonte: 'light' }
  return null
}

export async function buscarDiagnosticoDoProjeto(projectId: string): Promise<DiagnosticoDoProjeto | null> {
  const projeto = await cliente.from('projects').select('client_id').eq('id', projectId).maybeSingle()
  if (projeto.error) throw new Error(projeto.error.message)
  const clientId = (projeto.data as { client_id: string | null } | null)?.client_id
  if (!clientId) return null

  const [leads, valorHora] = await Promise.all([
    cliente
      .from('leads')
      .select('analysis_id, created_at, analyses(id, domain, score, deep_result, light_result)')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(5),
    cliente.from('settings').select('valor').eq('chave', VALOR_HORA_KEY).maybeSingle(),
  ])
  if (leads.error) throw new Error(leads.error.message)
  if (valorHora.error) throw new Error(valorHora.error.message)

  const hora = Number(((valorHora.data as { valor: string } | null)?.valor ?? '').replace(',', '.'))
  // O cliente untyped infere `analyses` como lista; é um-para-um (FK em leads).
  for (const lead of (leads.data ?? []) as unknown as LeadComAnalise[]) {
    const analise = lead.analyses
    if (!analise) continue
    const achado = problemasDaAnalise(analise)
    if (!achado) continue
    const score = analise.score === null ? null : Number(analise.score)
    return {
      analysisId: analise.id,
      dominio: analise.domain ?? '',
      score: score !== null && Number.isFinite(score) ? score : null,
      problemas: achado.problemas,
      fonte: achado.fonte,
      valorHora: Number.isFinite(hora) && hora > 0 ? hora : 0,
    }
  }
  return null
}

export function useDiagnosticoDoProjeto(projectId: string | null | undefined) {
  return useQuery({
    queryKey: ['proposals', 'diagnostico', projectId],
    enabled: Boolean(projectId),
    queryFn: () => buscarDiagnosticoDoProjeto(projectId as string),
  })
}
