import { Plus } from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'
import AgendaEventBlock from './AgendaEventBlock'
import { isSameDay } from '../dashboard/useAgenda'
import type { AgendaEvent } from '../dashboard/useAgenda'

interface AgendaWeekListProps {
  days: { date: Date; label: string }[]
  today: Date
  eventsByDay: Map<string, AgendaEvent[]>
  dayKeyOf: (date: Date) => string
  onOpenEvent: (event: AgendaEvent) => void
  onCreateForDay: (date: Date) => void
  weekRangeLabel: string
}

/** Lista vertical dos 7 dias (<lg) — dias vazios colapsados numa linha fina com "+". */
export default function AgendaWeekList({
  days,
  today,
  eventsByDay,
  dayKeyOf,
  onOpenEvent,
  onCreateForDay,
  weekRangeLabel,
}: AgendaWeekListProps) {
  const prefersReducedMotion = useReducedMotion()

  return (
    <ul
      aria-label={`Agenda semanal, ${weekRangeLabel}`}
      className="flex flex-col gap-2 lg:hidden"
    >
      {days.map(({ date, label }, index) => {
        const key = dayKeyOf(date)
        const dayEvents = eventsByDay.get(key) ?? []
        const isToday = isSameDay(date, today)
        const hasEvents = dayEvents.length > 0

        return (
          <motion.li
            key={key}
            initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.2,
              delay: prefersReducedMotion ? 0 : index * 0.04,
            }}
            className="rounded-2xl border border-white/5 bg-surface-1"
          >
            <div className="flex items-center gap-3 px-4 py-3">
              <span
                aria-hidden={!isToday}
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold tabular-nums ${
                  isToday
                    ? 'bg-gradient-to-r from-accent to-accent-2 text-white shadow-[0_0_16px_rgba(108,91,242,0.55)]'
                    : 'text-ink'
                }`}
              >
                {date.getDate()}
              </span>
              <span className="text-[11px] font-medium uppercase tracking-widest text-muted">
                {label}
              </span>
            </div>

            {hasEvents && (
              <ol className="flex flex-col gap-2 px-4 pb-4">
                {dayEvents.map((event, eventIndex) => (
                  <AgendaEventBlock
                    key={event.id}
                    event={event}
                    weekdayLabel={label}
                    dayOfMonth={date.getDate()}
                    index={eventIndex}
                    onOpen={onOpenEvent}
                  />
                ))}
              </ol>
            )}

            {!hasEvents && (
              <button
                type="button"
                onClick={() => onCreateForDay(date)}
                aria-label={`Novo evento em ${label.toLowerCase()} ${date.getDate()}`}
                className="flex min-h-11 w-full items-center justify-center gap-1.5 border-t border-white/5 px-4 py-2 text-xs text-muted/60 transition-colors duration-150 hover:bg-white/5 hover:text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden />
                Adicionar evento
              </button>
            )}
          </motion.li>
        )
      })}
    </ul>
  )
}
