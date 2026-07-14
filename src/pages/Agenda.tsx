import { useMemo, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import AgendaEventModal from '../components/dashboard/AgendaEventModal'
import AgendaWeekGrid from '../components/agenda/AgendaWeekGrid'
import AgendaWeekList from '../components/agenda/AgendaWeekList'
import { groupEventsByDay } from '../components/agenda/agendaWeekView'
import {
  addDays,
  dayKey,
  formatWeekRange,
  segundaDaSemana,
  useAgendaWeek,
  weekDays,
} from '../components/dashboard/useAgenda'
import type { AgendaEvent } from '../components/dashboard/useAgenda'

/**
 * Página dedicada de Agenda — visão da semana inteira, mais completa que o
 * card do dashboard. Reusa integralmente useAgendaWeek/useAgendaMutations
 * (via AgendaEventModal) do dashboard; nenhuma query nova é criada aqui.
 */
export default function Agenda() {
  const today = useMemo(() => new Date(), [])
  const prefersReducedMotion = useReducedMotion()

  const [weekStart, setWeekStart] = useState(() => segundaDaSemana(today))
  const [modalOpen, setModalOpen] = useState(false)
  const [editingEvent, setEditingEvent] = useState<AgendaEvent | null>(null)
  const [creationDate, setCreationDate] = useState(() => today)

  const { data: events, isLoading, isError } = useAgendaWeek(weekStart)

  const days = useMemo(() => weekDays(weekStart), [weekStart])
  const eventsByDay = useMemo(() => groupEventsByDay(events), [events])
  const weekKey = dayKey(weekStart)
  const weekRangeLabel = formatWeekRange(weekStart)

  const goToWeek = (direction: -1 | 1) => {
    setWeekStart((prev) => addDays(prev, direction * 7))
  }

  const goToToday = () => {
    setWeekStart(segundaDaSemana(today))
  }

  const openCreateModal = (date: Date) => {
    setEditingEvent(null)
    setCreationDate(date)
    setModalOpen(true)
  }

  const openEditModal = (event: AgendaEvent) => {
    setEditingEvent(event)
    setModalOpen(true)
  }

  return (
    <div>
      {/* Header da página */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="hero-heading font-kanit text-4xl font-bold leading-tight sm:text-5xl">
            Agenda
          </h1>
          <p className="mt-2 text-sm font-light text-muted">
            Visão completa dos compromissos da semana.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-xl border border-white/5 bg-surface-1 px-1.5 py-1.5">
            <button
              type="button"
              aria-label="Semana anterior"
              onClick={() => goToWeek(-1)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors duration-150 hover:bg-white/5 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-[9rem] px-1 text-center text-sm font-medium tabular-nums text-ink">
              {weekRangeLabel}
            </span>
            <button
              type="button"
              aria-label="Próxima semana"
              onClick={() => goToWeek(1)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors duration-150 hover:bg-white/5 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={goToToday}
            className="rounded-xl border border-white/10 px-4 py-2.5 font-kanit text-sm font-medium text-muted transition-colors duration-150 hover:bg-white/5 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Hoje
          </button>

          <button
            type="button"
            onClick={() => openCreateModal(today)}
            className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 font-kanit text-sm font-semibold text-ink shadow-lg shadow-accent/25 transition-colors duration-200 hover:bg-accent-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <Plus size={16} strokeWidth={2.5} />
            Evento
          </button>
        </div>
      </div>

      {/* Corpo: grade semanal (lg+) ou lista vertical (<lg) */}
      <div className="mt-8">
        {isLoading && (
          <div
            aria-label="Carregando agenda"
            className="hidden grid-cols-7 gap-1 rounded-2xl border border-white/5 bg-surface-1 p-3 lg:grid"
          >
            {Array.from({ length: 7 }, (_, i) => (
              <div
                key={i}
                className="h-[360px] animate-pulse rounded-xl bg-surface-2"
                style={{ opacity: 1 - i * 0.08 }}
              />
            ))}
          </div>
        )}

        {isError && (
          <div className="flex h-64 items-center justify-center rounded-2xl border border-white/5 bg-surface-1">
            <p className="text-sm text-red-400">
              Não foi possível carregar a agenda. Recarregue a página.
            </p>
          </div>
        )}

        {!isLoading && !isError && (
          <AnimatePresence mode="wait">
            <motion.div
              key={weekKey}
              initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: -8 }}
              transition={{ duration: 0.22 }}
            >
              <AgendaWeekGrid
                days={days}
                today={today}
                eventsByDay={eventsByDay}
                dayKeyOf={dayKey}
                onOpenEvent={openEditModal}
                onCreateForDay={openCreateModal}
                weekRangeLabel={weekRangeLabel}
              />
              <AgendaWeekList
                days={days}
                today={today}
                eventsByDay={eventsByDay}
                dayKeyOf={dayKey}
                onOpenEvent={openEditModal}
                onCreateForDay={openCreateModal}
                weekRangeLabel={weekRangeLabel}
              />
            </motion.div>
          </AnimatePresence>
        )}
      </div>

      <AgendaEventModal
        open={modalOpen}
        event={editingEvent}
        defaultDate={creationDate}
        onClose={() => setModalOpen(false)}
      />
    </div>
  )
}
