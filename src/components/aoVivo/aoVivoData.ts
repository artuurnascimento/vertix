import { supabase } from '../../lib/supabase'
import type { EventoAoVivo, PedidoDaSessao, SessaoAoVivo } from './aoVivoResumo'

/**
 * Leitura do "Ao vivo": as sessões das últimas 24 h, a linha do tempo de uma
 * sessão, o status dos pedidos ligados a elas — e o canal Realtime que
 * empurra cada mudança para o painel sem recarregar nada.
 *
 * Tudo passa pela RLS (equipe lê; ninguém escreve por aqui). Quem escreve é
 * o navegador do visitante, pela RPC checkout_rastrear.
 */

/** Teto de sessões na lista. Um dia forte de tráfego cabe; um ataque não. */
export const LIMITE_SESSOES = 300
/** Janela carregada: últimas 24 h, para a venda da madrugada não sumir às 8h. */
export const JANELA_MS = 24 * 60 * 60 * 1000

export async function fetchSessoesAoVivo(agora: Date = new Date()): Promise<SessaoAoVivo[]> {
  const desde = new Date(agora.getTime() - JANELA_MS).toISOString()
  const { data, error } = await supabase
    .from('checkout_sessoes')
    .select('*')
    .gte('iniciado_em', desde)
    .order('ultimo_evento_em', { ascending: false })
    .limit(LIMITE_SESSOES)
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function fetchEventosDaSessao(sessaoId: string): Promise<EventoAoVivo[]> {
  const { data, error } = await supabase
    .from('checkout_eventos')
    .select('*')
    .eq('sessao_id', sessaoId)
    .order('id', { ascending: true })
    .limit(600)
  if (error) throw new Error(error.message)
  return data ?? []
}

/** Status e total dos pedidos ligados às sessões, para "comprou" ser verdade do banco. */
export async function fetchPedidosDasSessoes(
  ids: readonly string[]
): Promise<Map<string, PedidoDaSessao>> {
  if (ids.length === 0) return new Map()
  const { data, error } = await supabase
    .from('pedidos')
    .select('id, status, total_centavos')
    .in('id', [...ids])
  if (error) throw new Error(error.message)
  return new Map(
    (data ?? []).map((p) => [p.id, { status: p.status, total_centavos: p.total_centavos }])
  )
}

export interface OuvintesAoVivo {
  sessao: (sessao: SessaoAoVivo) => void
  evento: (evento: EventoAoVivo) => void
  /** true quando o canal está inscrito; false ao cair (o painel avisa). */
  conexao: (ligada: boolean) => void
}

/** Abre o canal. Devolve a função que o fecha. */
export function assinarAoVivo(ouvintes: OuvintesAoVivo): () => void {
  const canal = supabase
    .channel('checkout-ao-vivo')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'checkout_sessoes' },
      (payload) => {
        const nova = payload.new as Partial<SessaoAoVivo>
        if (nova && typeof nova.id === 'string') ouvintes.sessao(nova as SessaoAoVivo)
      }
    )
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'checkout_eventos' },
      (payload) => {
        const novo = payload.new as Partial<EventoAoVivo>
        if (novo && typeof novo.sessao_id === 'string') ouvintes.evento(novo as EventoAoVivo)
      }
    )
    .subscribe((status) => {
      ouvintes.conexao(status === 'SUBSCRIBED')
    })

  return () => {
    void supabase.removeChannel(canal)
  }
}

// ---------------------------------------------------------------------------
// Como as mudanças entram no cache (puras, testadas em aoVivoResumo.test.ts)
// ---------------------------------------------------------------------------

/** Substitui a sessão pelo id ou põe a nova no topo. */
export function mesclarSessao(
  lista: readonly SessaoAoVivo[],
  sessao: SessaoAoVivo
): SessaoAoVivo[] {
  const indice = lista.findIndex((s) => s.id === sessao.id)
  if (indice === -1) return [sessao, ...lista].slice(0, LIMITE_SESSOES)
  return lista.map((s) => (s.id === sessao.id ? sessao : s))
}

/** Anexa o evento se ainda não estiver lá (o fetch e o Realtime se cruzam). */
export function anexarEvento(
  lista: readonly EventoAoVivo[],
  evento: EventoAoVivo
): EventoAoVivo[] {
  if (lista.some((e) => e.id === evento.id)) return [...lista]
  return [...lista, evento]
}
