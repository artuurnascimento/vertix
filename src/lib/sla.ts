/**
 * SLA de suporte — espelha public.sla_hours() do banco.
 *   alta = 4h · média = 24h · baixa = 72h
 * Status calculado no cliente a partir de created_at/resolved_at/prioridade,
 * evitando embutir a lógica no PostgREST (a view support_ticket_sla existe
 * para consumo server-side / health score).
 */

export type SlaStatus = 'no_prazo' | 'em_risco' | 'estourado' | 'cumprido'

const SLA_HORAS: Record<string, number> = {
  alta: 4,
  media: 24,
  baixa: 72,
}

const HORA_MS = 60 * 60 * 1000
/** Entra em "risco" quando resta menos de 25% da janela. */
const RISCO_THRESHOLD = 0.75

export function slaHoras(prioridade: string): number {
  return SLA_HORAS[prioridade] ?? 24
}

export interface SlaInfo {
  status: SlaStatus
  horas: number
  /** Horas restantes até estourar (negativo se já estourou). */
  horasRestantes: number
}

export function computeSla(
  prioridade: string,
  createdAt: string,
  resolvedAt: string | null
): SlaInfo {
  const horas = slaHoras(prioridade)
  const criado = new Date(createdAt).getTime()
  const dueMs = criado + horas * HORA_MS
  const agora = Date.now()

  if (resolvedAt) {
    const resolvido = new Date(resolvedAt).getTime()
    return {
      status: resolvido <= dueMs ? 'cumprido' : 'estourado',
      horas,
      horasRestantes: (dueMs - resolvido) / HORA_MS,
    }
  }

  const horasRestantes = (dueMs - agora) / HORA_MS
  let status: SlaStatus = 'no_prazo'
  if (agora > dueMs) status = 'estourado'
  else if (agora > criado + horas * RISCO_THRESHOLD * HORA_MS) status = 'em_risco'

  return { status, horas, horasRestantes }
}

export const SLA_BADGE: Record<SlaStatus, { label: string; className: string }> = {
  no_prazo: {
    label: 'No prazo',
    className: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300',
  },
  em_risco: {
    label: 'Em risco',
    className: 'border-amber-400/25 bg-amber-400/10 text-amber-300',
  },
  estourado: {
    label: 'SLA estourado',
    className: 'border-red-400/30 bg-red-400/10 text-red-300',
  },
  cumprido: {
    label: 'SLA cumprido',
    className: 'border-white/10 bg-white/5 text-muted',
  },
}

/** Texto curto tipo "3h restantes" / "2h em atraso". */
export function slaTempoLabel(info: SlaInfo): string {
  if (info.status === 'cumprido') return 'dentro do prazo'
  const abs = Math.abs(Math.round(info.horasRestantes))
  if (info.horasRestantes < 0) return `${abs}h em atraso`
  if (abs >= 24) return `${Math.round(abs / 24)}d restantes`
  return `${abs}h restantes`
}
