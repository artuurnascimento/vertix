import type { CSSProperties } from 'react'
import { useReducedMotion } from 'framer-motion'
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
const STATIC_LIST_LIMIT = 6

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
 * Ticker horizontal de atividades recentes — substitui o AtividadesCard.
 * Marquee contínuo (CSS var --duration/--gap do tailwind.config), pausa no
 * hover, e vira lista estática truncada quando prefers-reduced-motion.
 */
export default function ActivityTicker() {
  const { data: entries, isLoading, isError } = useDashboardActivity()
  const prefersReducedMotion = useReducedMotion()

  if (isLoading || isError || !entries || entries.length === 0) {
    return null
  }

  if (prefersReducedMotion) {
    return (
      <div className="flex items-center gap-1 overflow-x-auto border-y border-white/5 py-2.5">
        {entries.slice(0, STATIC_LIST_LIMIT).map((entry) => (
          <TickerItem key={entry.id} entry={entry} />
        ))}
      </div>
    )
  }

  return (
    <div
      className="group/ticker relative overflow-hidden border-y border-white/5 py-2.5"
      style={
        {
          '--duration': '32s',
          '--gap': '0px',
          maskImage:
            'linear-gradient(90deg, transparent, black 6%, black 94%, transparent)',
          WebkitMaskImage:
            'linear-gradient(90deg, transparent, black 6%, black 94%, transparent)',
        } as CSSProperties
      }
      role="marquee"
      aria-label="Atividades recentes em rolagem contínua"
    >
      <div className="flex w-max max-w-full animate-marquee group-hover/ticker:[animation-play-state:paused]">
        <div className="flex shrink-0">
          {entries.map((entry) => (
            <TickerItem key={entry.id} entry={entry} />
          ))}
        </div>
        {/* Cópia duplicada — mesmo conteúdo, aria-hidden — fecha o loop do marquee sem salto. */}
        <div className="flex shrink-0" aria-hidden="true">
          {entries.map((entry) => (
            <TickerItem key={`dup-${entry.id}`} entry={entry} />
          ))}
        </div>
      </div>
    </div>
  )
}
