/**
 * Utilitários de formatação e metadados de domínio (status / tipo de serviço).
 * Centralizado aqui para reuso no CRM (Fase 3) e no Kanban (Fase 5).
 */

interface RelativeDivision {
  amount: number
  unit: Intl.RelativeTimeFormatUnit
}

const SECONDS_IN_MINUTE = 60
const MINUTES_IN_HOUR = 60
const HOURS_IN_DAY = 24
const DAYS_IN_WEEK = 7
const WEEKS_IN_MONTH = 4.34524
const MONTHS_IN_YEAR = 12

const RELATIVE_DIVISIONS: readonly RelativeDivision[] = [
  { amount: SECONDS_IN_MINUTE, unit: 'second' },
  { amount: MINUTES_IN_HOUR, unit: 'minute' },
  { amount: HOURS_IN_DAY, unit: 'hour' },
  { amount: DAYS_IN_WEEK, unit: 'day' },
  { amount: WEEKS_IN_MONTH, unit: 'week' },
  { amount: MONTHS_IN_YEAR, unit: 'month' },
  { amount: Number.POSITIVE_INFINITY, unit: 'year' },
]

const relativeFormatter = new Intl.RelativeTimeFormat('pt-BR', {
  numeric: 'auto',
})

/** "há 2 dias", "há 3 semanas", "agora" — sem lib externa. */
export function formatRelativeTime(isoDate: string, now = new Date()): string {
  let duration = (new Date(isoDate).getTime() - now.getTime()) / 1000

  for (const division of RELATIVE_DIVISIONS) {
    if (Math.abs(duration) < division.amount) {
      return relativeFormatter.format(Math.round(duration), division.unit)
    }
    duration /= division.amount
  }
  return ''
}

const monthYearFormatter = new Intl.DateTimeFormat('pt-BR', {
  month: 'long',
  year: 'numeric',
})

/** "julho de 2026" — usado em "cliente desde …". */
export function formatMonthYear(isoDate: string): string {
  return monthYearFormatter.format(new Date(isoDate))
}

// ---------------------------------------------------------------------------
// Status de projeto (mesma ordem das colunas do Kanban da Fase 5)
// ---------------------------------------------------------------------------

export interface StatusMeta {
  label: string
  badgeClass: string
  /** Cor do ponto indicador (Kanban / listas). */
  dotClass: string
}

export const PROJECT_STATUS_ORDER = [
  'lead',
  'briefing_enviado',
  'briefing_recebido',
  'em_desenvolvimento',
  'revisao',
  'entregue',
] as const

export type ProjectStatus = (typeof PROJECT_STATUS_ORDER)[number]

export const PROJECT_STATUS: Record<ProjectStatus, StatusMeta> = {
  lead: {
    label: 'Lead',
    badgeClass: 'border-white/10 bg-white/5 text-muted',
    dotClass: 'bg-muted',
  },
  briefing_enviado: {
    label: 'Briefing enviado',
    badgeClass: 'border-sky-400/20 bg-sky-400/10 text-sky-300',
    dotClass: 'bg-sky-400',
  },
  briefing_recebido: {
    label: 'Briefing recebido',
    badgeClass: 'border-accent/25 bg-accent/10 text-accent',
    dotClass: 'bg-accent',
  },
  em_desenvolvimento: {
    label: 'Em desenvolvimento',
    badgeClass: 'border-amber-400/20 bg-amber-400/10 text-amber-300',
    dotClass: 'bg-amber-400',
  },
  revisao: {
    label: 'Revisão',
    badgeClass: 'border-orange-400/25 bg-orange-400/10 text-orange-300',
    dotClass: 'bg-orange-400',
  },
  entregue: {
    label: 'Entregue',
    badgeClass: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300',
    dotClass: 'bg-emerald-400',
  },
}

const UNKNOWN_STATUS: StatusMeta = {
  label: 'Desconhecido',
  badgeClass: 'border-white/10 bg-white/5 text-muted',
  dotClass: 'bg-muted',
}

export function getProjectStatusMeta(status: string): StatusMeta {
  return PROJECT_STATUS[status as ProjectStatus] ?? UNKNOWN_STATUS
}

/** Projeto "ativo" = ainda não entregue. */
export function isActiveStatus(status: string): boolean {
  return status !== 'entregue'
}

// ---------------------------------------------------------------------------
// Tipo de serviço
// ---------------------------------------------------------------------------

export interface TipoServicoMeta {
  label: string
  badgeClass: string
}

export const TIPO_SERVICO: Record<string, TipoServicoMeta> = {
  ecommerce: {
    label: 'E-commerce',
    badgeClass: 'border-accent/25 bg-accent/10 text-accent',
  },
  sistema: {
    label: 'Sistema',
    badgeClass: 'border-teal-400/20 bg-teal-400/10 text-teal-300',
  },
  site: {
    label: 'Site',
    badgeClass: 'border-indigo-400/25 bg-indigo-400/10 text-indigo-300',
  },
}

const UNKNOWN_TIPO: TipoServicoMeta = {
  label: 'Serviço',
  badgeClass: 'border-white/10 bg-white/5 text-muted',
}

export function getTipoServicoMeta(tipo: string): TipoServicoMeta {
  return TIPO_SERVICO[tipo] ?? UNKNOWN_TIPO
}
