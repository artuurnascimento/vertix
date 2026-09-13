import {
  classificarVisitante,
  comprou,
  localDaSessao,
  presencaDaSessao,
  type PedidoDaSessao,
  type SessaoAoVivo,
} from '../aoVivoResumo'

/**
 * O que o mapa e a lista "Sessões por local" precisam das sessões — puro,
 * testado em locais.test.ts. Só gente entra (bot e suspeito ficam de fora,
 * como em todo o Ao vivo) e só quem tem coordenada aparece no mapa.
 */

export type TipoDeMarcador = 'agora' | 'pedido' | 'passado'

/** Para onde os arcos do mapa convergem. Ajuste se a sede mudar. */
export const SEDE_VERTIX = { lat: -16.6869, lng: -49.2648, nome: 'Vertix · Goiânia' }

export interface Marcador {
  id: string
  lat: number
  lng: number
  tipo: TipoDeMarcador
  /** 0..1, fase do pulso — para os marcadores não pulsarem em uníssono. */
  semente: number
  /** "Maria · Curitiba · PR", para o tooltip. */
  rotulo: string
}

export interface LocalResumo {
  chave: string
  rotulo: string
  pais: string | null
  total: number
  agora: number
  compraram: number
  lat: number
  lng: number
  /** Sessões deste lugar, para destacar os marcadores ao passar o mouse. */
  ids: string[]
}

function temCoordenada(
  s: SessaoAoVivo
): s is SessaoAoVivo & { latitude: number; longitude: number } {
  return (
    typeof s.latitude === 'number' &&
    typeof s.longitude === 'number' &&
    Number.isFinite(s.latitude) &&
    Number.isFinite(s.longitude)
  )
}

/** Hash barato e determinístico do id → 0..1 (fase do pulso). */
export function sementeDoId(id: string): number {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return ((h >>> 0) % 1000) / 1000
}

/** Marcadores do mapa: pedido (comprou) ganha do "agora", que ganha do passado. */
export function marcadoresDasSessoes(
  sessoes: readonly SessaoAoVivo[],
  pedidos: ReadonlyMap<string, PedidoDaSessao>,
  agora: Date
): Marcador[] {
  return sessoes
    .filter((s) => classificarVisitante(s) === 'pessoa' && temCoordenada(s))
    .map((s) => {
      const tipo: TipoDeMarcador = comprou(s, pedidos)
        ? 'pedido'
        : presencaDaSessao(s, agora).estado === 'agora'
          ? 'agora'
          : 'passado'
      const quem = s.nome ?? s.email ?? 'Visitante'
      return {
        id: s.id,
        lat: s.latitude as number,
        lng: s.longitude as number,
        tipo,
        semente: sementeDoId(s.id),
        rotulo: `${quem} · ${localDaSessao(s)}`,
      }
    })
}

/**
 * "Sessões por local": uma linha por cidade·UF (ou país), mais visitas
 * primeiro. A coordenada é a média das sessões do lugar.
 */
export function agruparPorLocal(
  sessoes: readonly SessaoAoVivo[],
  pedidos: ReadonlyMap<string, PedidoDaSessao>,
  agora: Date
): LocalResumo[] {
  const grupos = new Map<
    string,
    LocalResumo & { somaLat: number; somaLng: number; comCoord: number }
  >()
  for (const s of sessoes) {
    if (classificarVisitante(s) !== 'pessoa') continue
    if (!s.cidade && !s.estado && !s.pais) continue
    const rotulo = localDaSessao(s)
    const chave = `${s.pais ?? ''}|${rotulo}`
    const atual = grupos.get(chave) ?? {
      chave,
      rotulo,
      pais: s.pais,
      total: 0,
      agora: 0,
      compraram: 0,
      lat: 0,
      lng: 0,
      ids: [],
      somaLat: 0,
      somaLng: 0,
      comCoord: 0,
    }
    const coord = temCoordenada(s)
    grupos.set(chave, {
      ...atual,
      total: atual.total + 1,
      agora: atual.agora + (presencaDaSessao(s, agora).estado === 'agora' ? 1 : 0),
      compraram: atual.compraram + (comprou(s, pedidos) ? 1 : 0),
      ids: [...atual.ids, s.id],
      somaLat: atual.somaLat + (coord ? s.latitude : 0),
      somaLng: atual.somaLng + (coord ? s.longitude : 0),
      comCoord: atual.comCoord + (coord ? 1 : 0),
    })
  }
  return [...grupos.values()]
    .map(({ somaLat, somaLng, comCoord, ...local }) => ({
      ...local,
      lat: comCoord > 0 ? somaLat / comCoord : 0,
      lng: comCoord > 0 ? somaLng / comCoord : 0,
    }))
    .sort(
      (a, b) => b.total - a.total || b.agora - a.agora || a.rotulo.localeCompare(b.rotulo)
    )
}
