import { motion } from 'framer-motion'
import { ArrowRightLeft, Check, FileText, Sparkles } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { formatRelativeTime } from '../../lib/format'
import type { PortalAtividade } from './portalData'

/**
 * Linha do tempo pública do portal — mesma linguagem visual do
 * ActivityTimeline do admin, mas sem autores nem dados internos
 * (o cliente não vê a equipe). Shape próprio: recebe as atividades
 * já filtradas pela RPC.
 */

interface TimelineVisual {
  icon: LucideIcon
  wrapClass: string
  iconClass: string
}

const TIMELINE_VISUALS: Record<string, TimelineVisual> = {
  status_change: {
    icon: ArrowRightLeft,
    wrapClass: 'border-accent/25 bg-accent/10',
    iconClass: 'text-accent',
  },
  briefing_submitted: {
    icon: Check,
    wrapClass: 'border-emerald-400/25 bg-emerald-400/10',
    iconClass: 'text-emerald-300',
  },
  proposta_enviada: {
    icon: FileText,
    wrapClass: 'border-sky-400/20 bg-sky-400/10',
    iconClass: 'text-sky-300',
  },
  proposta_aceita: {
    icon: Check,
    wrapClass: 'border-emerald-400/25 bg-emerald-400/10',
    iconClass: 'text-emerald-300',
  },
  proposta_recusada: {
    icon: FileText,
    wrapClass: 'border-white/10 bg-white/5',
    iconClass: 'text-muted',
  },
}

const DEFAULT_VISUAL: TimelineVisual = {
  icon: Sparkles,
  wrapClass: 'border-white/10 bg-white/5',
  iconClass: 'text-muted',
}

const STAGGER_STEP_S = 0.04
const STAGGER_MAX_S = 0.4

function getTimelineVisual(tipo: string): TimelineVisual {
  return TIMELINE_VISUALS[tipo] ?? DEFAULT_VISUAL
}

interface PortalTimelineProps {
  atividades: readonly PortalAtividade[]
}

export default function PortalTimeline({ atividades }: PortalTimelineProps) {
  if (atividades.length === 0) {
    return (
      <p className="text-sm font-light text-muted">
        As novidades do projeto aparecerão aqui.
      </p>
    )
  }

  return (
    <ol className="flex flex-col">
      {atividades.map((atividade, index) => {
        const visual = getTimelineVisual(atividade.tipo)
        const Icon = visual.icon
        const isLast = index === atividades.length - 1
        return (
          <motion.li
            key={`${atividade.created_at}-${index}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.25,
              delay: Math.min(index * STAGGER_STEP_S, STAGGER_MAX_S),
            }}
            className="relative flex gap-4 pb-6 last:pb-0"
          >
            {!isLast && (
              <span
                aria-hidden
                className="absolute left-4 top-9 h-[calc(100%-2.25rem)] w-px -translate-x-1/2 bg-white/5"
              />
            )}
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${visual.wrapClass}`}
            >
              <Icon aria-hidden className={`h-3.5 w-3.5 ${visual.iconClass}`} />
            </span>
            <div className="min-w-0 pt-1">
              <p className="text-sm leading-relaxed text-ink">
                {atividade.descricao}
              </p>
              <p className="mt-1 text-xs font-light text-muted">
                {formatRelativeTime(atividade.created_at)}
              </p>
            </div>
          </motion.li>
        )
      })}
    </ol>
  )
}
