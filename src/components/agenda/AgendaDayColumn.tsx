import { Plus } from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'
import AgendaEventBlock from './AgendaEventBlock'
import type { AgendaEvent } from '../dashboard/useAgenda'

const COLUMN_MIN_HEIGHT_CLASS = 'min-h-[360px]'
const COLUMN_STAGGER_S = 0.05

interface AgendaDayColumnProps {
  date: Date
  label: string
  isToday: boolean
  events: AgendaEvent[]
  columnIndex: number
  onOpenEvent: (event: AgendaEvent) => void
  onCreateForDay: (date: Date) => void
}

/** Uma coluna do dia na grade semanal (lg+): cabeçalho + eventos + "+" de criação. */
export default function AgendaDayColumn({
  date,
  label,
  isToday,
  events,
  columnIndex,
  onOpenEvent,
  onCreateForDay,
}: AgendaDayColumnProps) {
  const prefersReducedMotion = useReducedMotion()

  return (
    <motion.li
      role="cell"
      initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.22,
        delay: prefersReducedMotion ? 0 : columnIndex * 0.05,
      }}
      className={`flex flex-col border-white/5 px-3 py-3 first:pl-0 last:pr-0 lg:border-l ${COLUMN_MIN_HEIGHT_CLASS}`}
    >
      <div className="flex flex-col items-center gap-1 pb-3">
        <span className="text-[11px] font-medium uppercase tracking-widest text-muted">
          {label}
        </span>
        <span
          aria-hidden={!isToday}
          className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold tabular-nums ${
            isToday
              ? 'bg-gradient-to-r from-accent to-accent-2 text-white shadow-[0_0_16px_rgba(108,91,242,0.55)]'
              : 'text-ink'
          }`}
        >
          {date.getDate()}
        </span>
      </div>

      {events.length > 0 && (
        <ol className="flex flex-1 flex-col gap-2">
          {events.map((event, index) => (
            <AgendaEventBlock
              key={event.id}
              event={event}
              weekdayLabel={label}
              dayOfMonth={date.getDate()}
              index={index}
              onOpen={onOpenEvent}
            />
          ))}
        </ol>
      )}

      {events.length === 0 && (
        <button
          type="button"
          onClick={() => onCreateForDay(date)}
          aria-label={`Novo evento em ${label.toLowerCase()} ${date.getDate()}`}
          className="flex min-h-11 flex-1 items-center justify-center rounded-lg text-muted/40 transition-colors duration-150 hover:bg-white/5 hover:text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <Plus className="h-4 w-4" aria-hidden />
        </button>
      )}
    </motion.li>
  )
}
