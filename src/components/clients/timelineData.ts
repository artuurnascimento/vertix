import { useQuery } from '@tanstack/react-query'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import { normalizarEventos } from './timeline'
import type { EventoDaLinha } from './timeline'

/**
 * Leitura da view `client_timeline` (migração client_timeline). A view não
 * está em database.types.ts; a forma e a normalização moram em timeline.ts.
 */

const cliente = supabase as unknown as SupabaseClient

/** Vencimentos e atividades novas aparecem no próximo foco; não precisa ser ao vivo. */
const LINHA_STALE_TIME_MS = 60 * 1000

export function useLinhaDoTempo(clientId: string | undefined) {
  return useQuery({
    queryKey: ['client', clientId, 'linha-do-tempo'],
    enabled: Boolean(clientId),
    staleTime: LINHA_STALE_TIME_MS,
    queryFn: async (): Promise<EventoDaLinha[]> => {
      const { data, error } = await cliente
        .from('client_timeline')
        .select('quando, tipo, titulo, detalhe, link, ref_id')
        .eq('client_id', clientId)
        .order('quando', { ascending: false })
      if (error) throw new Error(error.message)
      return normalizarEventos(data)
    },
  })
}
