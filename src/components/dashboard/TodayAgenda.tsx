import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CalendarDays } from 'lucide-react'
import {
  useAgendaWeek,
  segundaDaSemana,
  isSameDay,
  formatEventTime,
} from './useAgenda'
import type { AgendaEvent } from './useAgenda'
import AgendaEventModal from './AgendaEventModal'
import { CardErrorState, CardSkeleton } from './CardStates'

export default function TodayAgenda() {
  const today = new Date()
  const { data, isLoading, isError } = useAgendaWeek(segundaDaSemana(today))
  const [editing, setEditing] = useState<AgendaEvent | null>(null)
  const events = (data ?? [])
    .filter((e) => isSameDay(new Date(e.inicio), today))
    .sort((a, b) => a.inicio.localeCompare(b.inicio))
  return (
    <section className="vx-today-agenda vx-glass">
      <header>
        <h2>Agenda de hoje</h2>
        <Link to="/admin/agenda" aria-label="Abrir agenda">
          <CalendarDays size={23} />
        </Link>
      </header>
      <div className="vx-today-events">
        {isLoading ? (
          <CardSkeleton rows={2} />
        ) : isError ? (
          <CardErrorState />
        ) : events.length === 0 ? (
          <p className="vx-agenda-empty">Nenhum compromisso para hoje.</p>
        ) : (
          events.map((e) => (
            <button
              type="button"
              key={e.id}
              className={`vx-today-event vx-event-${e.cor}`}
              onClick={() => setEditing(e)}
            >
              <time dateTime={e.inicio}>{formatEventTime(e.inicio)}</time>
              <strong>{e.titulo}</strong>
              {(e.descricao || e.projects?.nome) && (
                <span>{e.descricao || e.projects?.nome}</span>
              )}
            </button>
          ))
        )}
      </div>
      <Link className="vx-agenda-link" to="/admin/agenda">
        Ver agenda completa <ArrowRight size={20} />
      </Link>
      <AgendaEventModal
        open={!!editing}
        event={editing}
        defaultDate={today}
        onClose={() => setEditing(null)}
      />
    </section>
  )
}
