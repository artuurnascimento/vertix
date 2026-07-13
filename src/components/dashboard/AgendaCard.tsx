import { useMemo, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import DashboardCard from './DashboardCard'
import { CardErrorState, CardSkeleton } from './CardStates'
import AgendaEventModal from './AgendaEventModal'
import {
  addDays,
  dayKey,
  formatEventTime,
  formatWeekRange,
  isSameDay,
  segundaDaSemana,
  useAgendaWeek,
  weekDays,
} from './useAgenda'
import type { AgendaEvent, AgendaCor } from './useAgenda'

const ROW_STAGGER_S = 0.05

/** Blocos de cor do evento — bg/10, borda esquerda 3px, texto claro. */
const EVENT_COLOR_CLASSES: Record<
  AgendaCor,
  { border: string; bg: string; text: string; dot: string }
> = {
  accent: {
    border: 'border-l-accent',
    bg: 'bg-accent/10',
    text: 'text-accent',
    dot: 'bg-accent',
  },
  sky: {
    border: 'border-l-sky-400',
    bg: 'bg-sky-400/10',
    text: 'text-sky-300',
    dot: 'bg-sky-400',
  },
  emerald: {
    border: 'border-l-emerald-400',
    bg: 'bg-emerald-400/10',
    text: 'text-emerald-300',
    dot: 'bg-emerald-400',
  },
  amber: {
    border: 'border-l-amber-400',
    bg: 'bg-amber-400/10',
    text: 'text-amber-300',
    dot: 'bg-amber-400',
  },
}

function colorMeta(cor: string) {
  return EVENT_COLOR_CLASSES[cor as AgendaCor] ?? EVENT_COLOR_CLASSES.accent
}

export default function AgendaCard() {
  const today = useMemo(() => new Date(), [])
  const prefersReducedMotion = useReducedMotion()

  const [weekStart, setWeekStart] = useState(() => segundaDaSemana(today))
  const [selectedDate, setSelectedDate] = useState(() => today)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingEvent, setEditingEvent] = useState<AgendaEvent | null>(null)

  const { data: events, isLoading, isError } = useAgendaWeek(weekStart)

  const days = useMemo(() => weekDays(weekStart), [weekStart])

  const eventsByDay = useMemo(() => {
    const map = new Map<string, AgendaEvent[]>()
    for (const event of events ?? []) {
      const key = dayKey(new Date(event.inicio))
      const list = map.get(key) ?? []
      list.push(event)
      map.set(key, list)
    }
    return map
  }, [events])

  const selectedKey = dayKey(selectedDate)
  const dayEvents = eventsByDay.get(selectedKey) ?? []

  const goToWeek = (direction: -1 | 1) => {
    setWeekStart((prev) => addDays(prev, direction * 7))
  }

  const goToToday = () => {
    setWeekStart(segundaDaSemana(today))
    setSelectedDate(today)
  }

  const openCreateModal = () => {
    setEditingEvent(null)
    setModalOpen(true)
  }

  const openEditModal = (event: AgendaEvent) => {
    setEditingEvent(event)
    setModalOpen(true)
  }

  return (
    <DashboardCard title="Agenda" subtitle="Compromissos da semana">
      {/* Header: navegação de semana + ações */}
      <div className="relative -mt-1 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Semana anterior"
            onClick={() => goToWeek(-1)}
            className="rounded-lg p-1.5 text-muted transition-colors duration-150 hover:bg-white/5 hover:text-ink"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[6.5rem] text-center text-sm font-medium text-ink">
            {formatWeekRange(weekStart)}
          </span>
          <button
            type="button"
            aria-label="Próxima semana"
            onClick={() => goToWeek(1)}
            className="rounded-lg p-1.5 text-muted transition-colors duration-150 hover:bg-white/5 hover:text-ink"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={goToToday}
            className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-muted transition-colors duration-150 hover:bg-white/5 hover:text-ink"
          >
            Hoje
          </button>
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white shadow-[0_8px_24px_-8px_rgba(108,91,242,0.6)] transition-all duration-200 hover:bg-accent-2"
          >
            <Plus className="h-3.5 w-3.5" />
            Evento
          </button>
        </div>
      </div>

      {/* Faixa de dias */}
      <div className="relative mt-5 grid grid-cols-7 gap-1.5">
        {days.map(({ date, label }) => {
          const key = dayKey(date)
          const isToday = isSameDay(date, today)
          const isSelected = isSameDay(date, selectedDate)
          const hasEvents = (eventsByDay.get(key) ?? []).length > 0

          return (
            <button
              key={key}
              type="button"
              onClick={() => setSelectedDate(date)}
              aria-current={isToday ? 'date' : undefined}
              aria-pressed={isSelected}
              className={`relative flex flex-col items-center gap-1 rounded-xl px-1.5 py-2 transition-all duration-200 ${
                isToday
                  ? 'bg-gradient-to-r from-accent to-accent-2 text-white shadow-[0_4px_24px_rgba(108,91,242,0.4)]'
                  : isSelected
                    ? 'border border-accent/50 bg-accent/5 text-ink'
                    : 'border border-transparent text-muted hover:bg-white/5 hover:text-ink'
              }`}
            >
              <span className="text-[10px] font-medium uppercase tracking-widest opacity-80">
                {label}
              </span>
              <span className="text-sm font-semibold">{date.getDate()}</span>
              <span
                aria-hidden
                className={`h-1 w-1 rounded-full transition-opacity duration-200 ${
                  hasEvents
                    ? isToday
                      ? 'bg-white/90 opacity-100'
                      : 'bg-accent opacity-100'
                    : 'opacity-0'
                }`}
              />
            </button>
          )
        })}
      </div>

      {/* Lista do dia selecionado */}
      <div className="relative mt-5">
        {isLoading && <CardSkeleton rows={3} rowClassName="h-14" />}

        {isError && <CardErrorState />}

        {!isLoading && !isError && (
          <AnimatePresence mode="wait">
            <motion.div
              key={selectedKey}
              initial={
                prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 6 }
              }
              animate={{ opacity: 1, y: 0 }}
              exit={
                prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: -6 }
              }
              transition={{ duration: 0.2 }}
            >
              {dayEvents.length === 0 && (
                <div className="flex flex-col items-center gap-3 py-8 text-center">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5">
                    <CalendarDays className="h-4 w-4 text-muted" />
                  </span>
                  <p className="text-sm font-light text-muted">
                    Nenhum evento neste dia
                  </p>
                  <button
                    type="button"
                    onClick={openCreateModal}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-accent/30 bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent transition-colors duration-150 hover:bg-accent/15"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Evento
                  </button>
                </div>
              )}

              {dayEvents.length > 0 && (
                <ul className="flex flex-col gap-2">
                  {dayEvents.map((event, index) => {
                    const colors = colorMeta(event.cor)
                    return (
                      <motion.li
                        key={event.id}
                        initial={
                          prefersReducedMotion
                            ? { opacity: 1 }
                            : { opacity: 0, y: 6 }
                        }
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                          duration: 0.22,
                          delay: prefersReducedMotion
                            ? 0
                            : index * ROW_STAGGER_S,
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => openEditModal(event)}
                          className={`w-full rounded-lg border-l-[3px] ${colors.border} ${colors.bg} px-4 py-2.5 text-left transition-colors duration-150 hover:brightness-125 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent`}
                        >
                          <span
                            className={`text-[11px] font-medium tracking-wide ${colors.text}`}
                          >
                            {formatEventTime(event.inicio)} –{' '}
                            {formatEventTime(event.fim)}
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
                  })}
                </ul>
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </div>

      <AgendaEventModal
        open={modalOpen}
        event={editingEvent}
        defaultDate={selectedDate}
        onClose={() => setModalOpen(false)}
      />
    </DashboardCard>
  )
}
