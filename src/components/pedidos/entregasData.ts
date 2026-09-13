import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { SupabaseClient } from '@supabase/supabase-js'
import { catalogoSupabase } from '../produtos/catalogoSupabase'

/**
 * `pedido_entregas` (itens que a equipe entrega à mão — Correção Aplicada) e
 * `pedido_medicoes` (as três medições do Acompanhamento). Migração
 * correcao_aplicada_fase1. O worker escreve; aqui a equipe lê e muda o
 * status da entrega.
 */

const cliente = catalogoSupabase as unknown as SupabaseClient

export type StatusEntrega = 'aguardando_contato' | 'em_contato' | 'aplicando' | 'concluida' | 'cancelada'

export const STATUS_ENTREGA: readonly { valor: StatusEntrega; label: string }[] = [
  { valor: 'aguardando_contato', label: 'Aguardando contato' },
  { valor: 'em_contato', label: 'Em contato' },
  { valor: 'aplicando', label: 'Aplicando' },
  { valor: 'concluida', label: 'Concluída' },
  { valor: 'cancelada', label: 'Cancelada' },
]

export interface EntregaPendente {
  id: string
  pedido_id: string
  produto_id: string
  entrega: 'correcao_aplicada' | 'correcao_criticos' | 'manual'
  status: StatusEntrega
  observacoes: string | null
  contato_em: string | null
  concluida_em: string | null
  created_at: string
  pedidos: {
    cliente_nome: string
    cliente_email: string
    cliente_whatsapp: string | null
    plano_code: string | null
    analysis_id: string | null
    lead_id: string | null
  } | null
  produtos: { nome: string } | null
}

export const ENTREGAS_QUERY_KEY = ['pedido-entregas'] as const

export function useEntregas() {
  return useQuery({
    queryKey: ENTREGAS_QUERY_KEY,
    queryFn: async (): Promise<EntregaPendente[]> => {
      const { data, error } = await cliente
        .from('pedido_entregas')
        .select(
          'id, pedido_id, produto_id, entrega, status, observacoes, contato_em, concluida_em, created_at, pedidos(cliente_nome, cliente_email, cliente_whatsapp, plano_code, analysis_id, lead_id), produtos(nome)'
        )
        .order('created_at', { ascending: false })
      if (error) throw new Error(error.message)
      return (data ?? []) as unknown as EntregaPendente[]
    },
  })
}

export interface Medicao {
  pedido_id: string
  semana: number
  agendada_para: string
  analysis_id: string | null
  email_enviado_em: string | null
}

/** Medições por pedido: quantas já foram enviadas, de 3. */
export function useMedicoes() {
  return useQuery({
    queryKey: ['pedido-medicoes'],
    queryFn: async (): Promise<Medicao[]> => {
      const { data, error } = await cliente
        .from('pedido_medicoes')
        .select('pedido_id, semana, agendada_para, analysis_id, email_enviado_em')
      if (error) throw new Error(error.message)
      return (data ?? []) as Medicao[]
    },
  })
}

/** "2/3" por pedido — só para quem tem o Acompanhamento. */
export function resumirMedicoes(medicoes: readonly Medicao[]): Map<string, { enviadas: number; total: number }> {
  const mapa = new Map<string, { enviadas: number; total: number }>()
  for (const m of medicoes) {
    const atual = mapa.get(m.pedido_id) ?? { enviadas: 0, total: 0 }
    mapa.set(m.pedido_id, {
      enviadas: atual.enviadas + (m.email_enviado_em ? 1 : 0),
      total: atual.total + 1,
    })
  }
  return mapa
}

/**
 * Marcar `concluida` grava `concluida_em`; `em_contato` grava `contato_em`
 * se ainda não houver. Os passos do plano (`passos_feitos`) são marcados
 * pelo worker quando lê a conclusão — o painel não escreve em `pedidos`.
 */
export async function atualizarEntrega(
  id: string,
  patch: { status?: StatusEntrega; observacoes?: string | null },
  atual: { status: StatusEntrega; contato_em: string | null }
): Promise<void> {
  const agora = new Date().toISOString()
  const campos: Record<string, unknown> = { ...patch }
  if (patch.status === 'concluida') campos.concluida_em = agora
  if (patch.status && patch.status !== 'aguardando_contato' && !atual.contato_em) campos.contato_em = agora
  if (patch.status === 'aguardando_contato') campos.concluida_em = null
  const { error } = await cliente.from('pedido_entregas').update(campos).eq('id', id)
  if (error) throw new Error(error.message)
}

export function useAtualizarEntrega() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (args: Parameters<typeof atualizarEntrega>) => atualizarEntrega(...args),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ENTREGAS_QUERY_KEY })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}
