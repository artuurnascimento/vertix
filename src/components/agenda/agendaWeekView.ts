/**
 * Utilitários exclusivos da página Agenda (visão semana inteira).
 * Cópia mínima de agrupamento por dia — a mesma lógica existe (não exportada)
 * dentro de AgendaCard.tsx; duplicada aqui em vez de editar o arquivo alheio.
 */
import { dayKey } from '../dashboard/useAgenda'
import type { AgendaEvent } from '../dashboard/useAgenda'

/** Agrupa eventos por dayKey (yyyy-mm-dd local) e ordena cada grupo por horário de início. */
export function groupEventsByDay(
  events: AgendaEvent[] | undefined
): Map<string, AgendaEvent[]> {
  const map = new Map<string, AgendaEvent[]>()
  for (const event of events ?? []) {
    const key = dayKey(new Date(event.inicio))
    const list = map.get(key) ?? []
    list.push(event)
    map.set(key, list)
  }
  for (const list of map.values()) {
    list.sort((a, b) => a.inicio.localeCompare(b.inicio))
  }
  return map
}

const WEEKDAY_FULL_LABELS = [
  'Segunda',
  'Terça',
  'Quarta',
  'Quinta',
  'Sexta',
  'Sábado',
  'Domingo',
]

/** Nome completo do dia da semana a partir do índice 0=segunda…6=domingo. */
export function weekdayFullLabel(index: number): string {
  return WEEKDAY_FULL_LABELS[index] ?? ''
}

/** "Alinhamento semanal, segunda 13, 09:00 às 10:30" — aria-label do bloco de evento. */
export function eventAriaLabel(
  weekdayLabel: string,
  dayOfMonth: number,
  startLabel: string,
  endLabel: string,
  title: string
): string {
  return `${title}, ${weekdayLabel.toLowerCase()} ${dayOfMonth}, ${startLabel} às ${endLabel}`
}
