import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import type { ItemDaFila, MotivoDePerda } from './fila'

/**
 * Leitura da view `fila_comercial` e a escrita dos campos comerciais do
 * projeto (migração jornada_fase1_comercial). A view e as colunas novas não
 * estão em database.types.ts; as formas moram em fila.ts.
 */

const cliente = supabase as unknown as SupabaseClient

export const FILA_QUERY_KEY = ['comercial', 'fila'] as const

export function useFilaComercial() {
  return useQuery({
    queryKey: FILA_QUERY_KEY,
    queryFn: async (): Promise<ItemDaFila[]> => {
      const { data, error } = await cliente.from('fila_comercial').select('*')
      if (error) throw new Error(error.message)
      return (data ?? []) as ItemDaFila[]
    },
  })
}

export interface CamposComerciais {
  responsavel_id?: string | null
  proxima_acao?: string | null
  proxima_acao_em?: string | null
  valor_estimado?: number | null
  previsao_fechamento?: string | null
  motivo_perda?: MotivoDePerda | null
  perdido_em?: string | null
}

export async function atualizarComercial(projectId: string, campos: CamposComerciais): Promise<void> {
  const { error } = await cliente.from('projects').update(campos).eq('id', projectId)
  if (error) throw new Error(error.message)
}

/** Tudo o que mostra projeto ou fila precisa saber que mudou. */
const CHAVES_AFETADAS = [['comercial'], ['projects'], ['project'], ['dashboard'], ['reports']] as const

export function useAtualizarComercial() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ projectId, campos }: { projectId: string; campos: CamposComerciais }) =>
      atualizarComercial(projectId, campos),
    onSuccess: () => {
      for (const chave of CHAVES_AFETADAS) queryClient.invalidateQueries({ queryKey: chave })
    },
  })
}
