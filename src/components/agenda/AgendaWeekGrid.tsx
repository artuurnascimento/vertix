import AgendaDayColumn from './AgendaDayColumn'
import { isSameDay } from '../dashboard/useAgenda'
import type { AgendaEvent } from '../dashboard/useAgenda'

interface AgendaWeekGridProps {
  days: { date: Date; label: string }[]
  today: Date
  eventsByDay: Map<string, AgendaEvent[]>
  dayKeyOf: (date: Date) => string
  onOpenEvent: (event: AgendaEvent) => void
  onCreateForDay: (date: Date) => void
  weekRangeLabel: string
}

/** Grade semanal 7 colunas (lg+) — visível apenas em telas grandes. */
export default function AgendaWeekGrid({
  days,
  today,
  eventsByDay,
  dayKeyOf,
  onOpenEvent,
  onCreateForDay,
  weekRangeLabel,
}: AgendaWeekGridProps) {
  return (
    <ul
      role="table"
      aria-label={`Agenda semanal, ${weekRangeLabel}`}
      className="hidden grid-cols-7 rounded-2xl border border-white/5 bg-surface-1 lg:grid"
    >
      {days.map(({ date, label }, index) => {
        const key = dayKeyOf(date)
        return (
          <AgendaDayColumn
            key={key}
            date={date}
            label={label}
            isToday={isSameDay(date, today)}
            events={eventsByDay.get(key) ?? []}
            columnIndex={index}
            onOpenEvent={onOpenEvent}
            onCreateForDay={onCreateForDay}
          />
        )
      })}
    </ul>
  )
}
