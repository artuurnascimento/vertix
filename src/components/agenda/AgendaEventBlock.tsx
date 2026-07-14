import { motion, useReducedMotion } from 'framer-motion'
import { formatEventTime } from '../dashboard/useAgenda'
import type { AgendaCor, AgendaEvent } from '../dashboard/useAgenda'
import { eventAriaLabel } from './agendaWeekView'

/** Blocos de cor do evento — mesma paleta usada no card do dashboard. */
const EVENT_COLOR_CLASSES: Record<
  AgendaCor,
  { border: string; bg: string; text: string }
> = {
  accent: { border: 'border-l-accent', bg: 'bg-accent/10', text: 'text-accent' },
  sky: { border: 'border-l-sky-400', bg: 'bg-sky-400/10', text: 'text-sky-300' },
  emerald: {
    border: 'border-l-emerald-400',
    bg: 'bg-emerald-400/10',
    text: 'text-emerald-300',
  },
  amber: {
    border: 'border-l-amber-400',
    bg: 'bg-amber-400/10',
    text: 'text-amber-300',
  },
}

function colorMeta(cor: string) {
  return EVENT_COLOR_CLASSES[cor as AgendaCor] ?? EVENT_COLOR_CLASSES.accent
}

interface AgendaEventBlockProps {
  event: AgendaEvent
  weekdayLabel: string
  dayOfMonth: number
  index: number
  onOpen: (event: AgendaEvent) => void
}

/** Bloco clicável de evento — borda esquerda colorida, horário, título e projeto. */
export default function AgendaEventBlock({
  event,
  weekdayLabel,
  dayOfMonth,
  index,
  onOpen,
}: AgendaEventBlockProps) {
  const prefersReducedMotion = useReducedMotion()
  const colors = colorMeta(event.cor)
  const startLabel = formatEventTime(event.inicio)
  const endLabel = formatEventTime(event.fim)

  return (
    <motion.li
      initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, delay: prefersReducedMotion ? 0 : index * 0.03 }}
    >
      <button
        type="button"
        onClick={() => onOpen(event)}
        aria-label={eventAriaLabel(
          weekdayLabel,
          dayOfMonth,
          startLabel,
          endLabel,
          event.titulo
        )}
        className={`min-h-11 w-full rounded-lg border-l-[3px] ${colors.border} ${colors.bg} px-3 py-2 text-left transition-colors duration-150 hover:brightness-125 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent`}
      >
        <span
          className={`text-[11px] font-medium tabular-nums tracking-wide ${colors.text}`}
        >
          {startLabel}–{endLabel}
        </span>
        <p className="mt-0.5 truncate text-sm font-medium text-ink">
          {event.titulo}
        </p>
        {event.projects?.nome && (
          <p className="mt-0.5 truncate text-xs font-light text-muted">
            {event.projects.nome}
          </p>
        )}
      </button>
    </motion.li>
  )
}
