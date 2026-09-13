import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  anexarEvento,
  assinarAoVivo,
  fetchEventosDaSessao,
  fetchPedidosDasSessoes,
  fetchSessoesAoVivo,
  mesclarSessao,
} from './aoVivoData'
import type { EventoAoVivo, PedidoDaSessao, SessaoAoVivo } from './aoVivoResumo'

/**
 * Estado do "Ao vivo": sessões (lista + Realtime), a linha do tempo da
 * sessão escolhida, os pedidos ligados, e um relógio que bate a cada 5 s —
 * é ele que faz "há 12 s" virar "há 17 s" e a bolinha verde apagar quando o
 * navegador para de bater.
 *
 * As mudanças do Realtime entram DIRETO no cache (setQueryData), sem
 * refetch: é o que faz o passo aparecer no painel no mesmo segundo em que
 * aconteceu no checkout. O refetch a cada minuto é rede de segurança para
 * um canal que caiu sem avisar.
 */

const CHAVE_SESSOES = ['ao-vivo', 'sessoes'] as const
const RELOGIO_MS = 5_000
const REFETCH_SESSOES_MS = 60_000
const REFETCH_PEDIDOS_MS = 30_000

export const SEM_PEDIDOS: ReadonlyMap<string, PedidoDaSessao> = new Map()

export function useAoVivo() {
  const queryClient = useQueryClient()
  const [agora, setAgora] = useState(() => new Date())
  const [selecionada, setSelecionada] = useState<string | null>(null)
  const [conectado, setConectado] = useState(false)

  useEffect(() => {
    const relogio = window.setInterval(() => setAgora(new Date()), RELOGIO_MS)
    return () => window.clearInterval(relogio)
  }, [])

  const sessoes = useQuery({
    queryKey: CHAVE_SESSOES,
    queryFn: () => fetchSessoesAoVivo(),
    refetchInterval: REFETCH_SESSOES_MS,
    retry: false,
  })

  const eventos = useQuery({
    queryKey: ['ao-vivo', 'eventos', selecionada],
    enabled: Boolean(selecionada),
    queryFn: () => fetchEventosDaSessao(selecionada ?? ''),
    retry: false,
  })

  const pedidoIds = useMemo(
    () =>
      [
        ...new Set(
          (sessoes.data ?? [])
            .map((s) => s.pedido_id)
            .filter((id): id is string => Boolean(id))
        ),
      ].sort(),
    [sessoes.data]
  )
  const pedidos = useQuery({
    queryKey: ['ao-vivo', 'pedidos', pedidoIds],
    enabled: pedidoIds.length > 0,
    queryFn: () => fetchPedidosDasSessoes(pedidoIds),
    refetchInterval: REFETCH_PEDIDOS_MS,
    retry: false,
  })

  useEffect(
    () =>
      assinarAoVivo({
        sessao: (sessao) =>
          queryClient.setQueryData<SessaoAoVivo[]>(CHAVE_SESSOES, (atual) =>
            mesclarSessao(atual ?? [], sessao)
          ),
        evento: (evento) =>
          queryClient.setQueryData<EventoAoVivo[]>(
            ['ao-vivo', 'eventos', evento.sessao_id],
            // Sem cache ainda (o fetch está a caminho) não há onde anexar; o
            // próprio fetch traz o evento.
            (atual) => (atual ? anexarEvento(atual, evento) : atual)
          ),
        conexao: setConectado,
      }),
    [queryClient]
  )

  return {
    sessoes,
    eventos,
    pedidos: pedidos.data ?? SEM_PEDIDOS,
    agora,
    selecionada,
    setSelecionada,
    conectado,
  }
}
