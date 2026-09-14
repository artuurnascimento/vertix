import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { inicioDoPeriodo, mesclar, type Filtros, type LinhaDeLog } from './logs'

/**
 * Dados da página Logs: a lista filtrada (o servidor filtra; a busca de
 * texto também vai para ele) e o resumo das últimas 24 h. O Realtime põe
 * cada linha nova/atualizada direto no cache da lista — a página Logs vê o
 * erro nascer, como o Ao vivo.
 */

const LIMITE = 300
// Prefixos distintos de propósito: o Realtime mescla linhas em toda lista
// (`exact: false`), e o resumo não é uma lista de linhas.
export const CHAVE_LOGS = ['logs-lista'] as const
export const CHAVE_RESUMO = ['logs-resumo-24h'] as const

/** PostgREST usa vírgula, parênteses e ponto como sintaxe no `or`. */
function termoSeguro(busca: string): string {
  return busca.replace(/[,()%*.]/g, ' ').trim()
}

export async function buscarLogs(f: Filtros, agora: Date): Promise<LinhaDeLog[]> {
  let q = supabase.from('logs_sistema').select('*').order('ultima_em', { ascending: false }).limit(LIMITE)
  if (f.niveis.length) q = q.in('nivel', f.niveis)
  if (f.origem) q = q.eq('origem', f.origem)
  if (f.fonte) q = q.eq('fonte', f.fonte)
  const desde = inicioDoPeriodo(f.periodo, agora)
  if (desde) q = q.gte('ultima_em', desde.toISOString())
  const termo = termoSeguro(f.busca)
  if (termo) {
    q = q.or(`mensagem.ilike.*${termo}*,evento.ilike.*${termo}*,fonte.ilike.*${termo}*,requisicao_id.eq.${termo},sessao_id.eq.${termo}`)
  }
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return data ?? []
}

export function useLogs(filtros: Filtros) {
  const chave = [...CHAVE_LOGS, filtros] as const
  return useQuery({
    queryKey: chave,
    queryFn: () => buscarLogs(filtros, new Date()),
    staleTime: 15_000,
    refetchInterval: 60_000,
  })
}

export type LinhaLeve = Pick<LinhaDeLog, 'nivel' | 'fonte' | 'ocorrencias'>

export async function buscarResumo24h(agora: Date): Promise<LinhaLeve[]> {
  const desde = new Date(agora.getTime() - 24 * 60 * 60_000).toISOString()
  const { data, error } = await supabase
    .from('logs_sistema')
    .select('nivel, fonte, ocorrencias')
    .gte('ultima_em', desde)
    .limit(2000)
  if (error) throw new Error(error.message)
  return data ?? []
}

export function useResumo24h() {
  return useQuery({
    queryKey: CHAVE_RESUMO,
    queryFn: () => buscarResumo24h(new Date()),
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
}

/** Assina o Realtime e devolve quem fecha. `aoReceber` recebe a linha. */
export function assinarLogs(aoReceber: (linha: LinhaDeLog) => void, aoConectar: (ligado: boolean) => void): () => void {
  const canal = supabase
    .channel('logs-sistema')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'logs_sistema' }, (payload) => {
      const nova = payload.new as Partial<LinhaDeLog>
      if (nova && typeof nova.id === 'number') aoReceber(nova as LinhaDeLog)
    })
    .subscribe((status) => aoConectar(status === 'SUBSCRIBED'))
  return () => {
    void supabase.removeChannel(canal)
  }
}

/**
 * Liga o Realtime ao cache: toda lista de logs em memória recebe a linha
 * (cada uma reaplica os próprios filtros na tela), e o resumo é invalidado.
 */
export function useLogsAoVivo(aoConectar: (ligado: boolean) => void): void {
  const queryClient = useQueryClient()
  useEffect(() => {
    return assinarLogs((linha) => {
      queryClient.setQueriesData<LinhaDeLog[]>({ queryKey: CHAVE_LOGS, exact: false }, (atual) => {
        if (!Array.isArray(atual)) return atual
        return mesclar(atual, linha)
      })
      void queryClient.invalidateQueries({ queryKey: CHAVE_RESUMO })
    }, aoConectar)
  }, [queryClient, aoConectar])
}
