import { Link } from 'react-router-dom'
import {
  ArrowRightLeft,
  Check,
  MessageSquare,
  Receipt,
  Send,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { formatRelativeTime } from '../../lib/format'
import { useDashboardActivity } from './useDashboardData'
import type { DashboardActivityEntry } from './useDashboardData'

interface ActivityVisual {
  icon: LucideIcon
  dotClass: string
}

/** Vocabulário visual por tipo de activity_log — um dot colorido por tipo. */
const ACTIVITY_VISUALS: Record<string, ActivityVisual> = {
  status_change: { icon: ArrowRightLeft, dotClass: 'bg-accent' },
  briefing_submitted: { icon: Check, dotClass: 'bg-emerald-400' },
  nota: { icon: MessageSquare, dotClass: 'bg-cyan-300' },
  proposta: { icon: Send, dotClass: 'bg-sky-400' },
  financeiro: { icon: Receipt, dotClass: 'bg-amber-400' },
}

const DEFAULT_VISUAL: ActivityVisual = ACTIVITY_VISUALS.nota
const LIST_LIMIT = 8

function getActivityVisual(tipo: string): ActivityVisual {
  return ACTIVITY_VISUALS[tipo] ?? DEFAULT_VISUAL
}

function getAuthorLabel(entry: DashboardActivityEntry): string {
  if (entry.user_id === null) return 'Automático'
  return entry.profiles?.nome ?? 'Equipe'
}

function TickerItem({ entry }: { entry: DashboardActivityEntry }) {
  const visual = getActivityVisual(entry.tipo)
  return (
    <Link
      to={`/admin/projetos/${entry.project_id}`}
      className="group inline-flex shrink-0 items-center gap-2.5 whitespace-nowrap px-5 text-sm transition-colors duration-150 hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <span
        aria-hidden
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${visual.dotClass}`}
        style={{ boxShadow: '0 0 6px currentColor' }}
      />
      <span className="text-ink/80 group-hover:text-accent">
        {entry.descricao}
      </span>
      <span className="text-muted/70">
        {getAuthorLabel(entry)}
        {entry.projects?.nome ? ` · ${entry.projects.nome}` : ''}
      </span>
      <span className="text-muted/50">{formatRelativeTime(entry.created_at)}</span>
    </Link>
  )
}

/**
 * Faixa estática de atividades recentes — SEM marquee, a pedido do usuário
 * ("quero fixo"). Excedente acessível por scroll horizontal manual.
 */
export default function ActivityTicker() {
  const { data: entries, isLoading, isError } = useDashboardActivity()

  if (isLoading || isError || !entries || entries.length === 0) {
    return null
  }

  return (
    <div
      aria-label="Atividades recentes"
      className="flex items-center gap-1 overflow-x-auto border-y border-white/5 py-2.5"
    >
      {entries.slice(0, LIST_LIMIT).map((entry) => (
        <TickerItem key={entry.id} entry={entry} />
      ))}
    </div>
  )
}
