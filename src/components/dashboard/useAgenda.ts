/**
 * Dados e mutations da Agenda semanal do dashboard.
 * Query key prefixo ['agenda', ...] — só este módulo escreve/invalida aqui.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import type { Tables, TablesInsert } from '../../lib/database.types'

export type AgendaCor = 'accent' | 'sky' | 'emerald' | 'amber'

export const AGENDA_CORES: readonly AgendaCor[] = [
  'accent',
  'sky',
  'emerald',
  'amber',
]

export type AgendaEvent = Tables<'agenda_events'> & {
  projects: Pick<Tables<'projects'>, 'nome'> | null
}

const DAYS_IN_WEEK = 7

/** Segunda-feira 00:00 local da semana que contém `date`. */
export function segundaDaSemana(date: Date): Date {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const weekday = result.getDay() // 0=domingo … 6=sábado
  const diffToMonday = weekday === 0 ? -6 : 1 - weekday
  result.setDate(result.getDate() + diffToMonday)
  return result
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

/** Chave estável (yyyy-mm-dd local) usada como id de dia e query key. */
export function dayKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const weekdayLabels = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM']

/** Os 7 dias (segunda a domingo) da semana de `mondayDate`. */
export function weekDays(mondayDate: Date): { date: Date; label: string }[] {
  return Array.from({ length: DAYS_IN_WEEK }, (_, i) => ({
    date: addDays(mondayDate, i),
    label: weekdayLabels[i],
  }))
}

const weekRangeFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: 'numeric',
  month: 'short',
})

/** "12 – 18 jul" — label de navegação de semana. */
export function formatWeekRange(mondayDate: Date): string {
  const sunday = addDays(mondayDate, DAYS_IN_WEEK - 1)
  const startDay = mondayDate.getDate()
  const endLabel = weekRangeFormatter
    .format(sunday)
    .replace('.', '')
    .toLowerCase()
  return `${startDay} – ${endLabel}`
}

const timeFormatter = new Intl.DateTimeFormat('pt-BR', {
  hour: '2-digit',
  minute: '2-digit',
})

/** "08:00" a partir de um ISO string. */
export function formatEventTime(isoDate: string): string {
  return timeFormatter.format(new Date(isoDate))
}

/** Combina data (yyyy-mm-dd) + hora (HH:mm) locais em ISO string (UTC). */
export function localDateTimeToISO(dateStr: string, timeStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  const [hour, minute] = timeStr.split(':').map(Number)
  return new Date(year, month - 1, day, hour, minute).toISOString()
}

/** "HH:mm" local a partir de um ISO string — para preencher inputs de hora. */
export function isoToLocalTime(isoDate: string): string {
  const date = new Date(isoDate)
  const hour = String(date.getHours()).padStart(2, '0')
  const minute = String(date.getMinutes()).padStart(2, '0')
  return `${hour}:${minute}`
}

/** "yyyy-mm-dd" local a partir de um ISO string — para preencher input date. */
export function isoToLocalDate(isoDate: string): string {
  return dayKey(new Date(isoDate))
}

export function useAgendaWeek(mondayDate: Date) {
  const weekKey = dayKey(mondayDate)
  return useQuery({
    queryKey: ['agenda', weekKey],
    queryFn: async (): Promise<AgendaEvent[]> => {
      const start = mondayDate.toISOString()
      const end = addDays(mondayDate, DAYS_IN_WEEK).toISOString()
      const { data, error } = await supabase
        .from('agenda_events')
        .select('*, projects(nome)')
        .gte('inicio', start)
        .lt('inicio', end)
        .order('inicio', { ascending: true })
      if (error) throw new Error(error.message)
      return data as AgendaEvent[]
    },
  })
}

export interface AgendaEventFormValues {
  titulo: string
  descricao: string
  data: string
  horaInicio: string
  horaFim: string
  cor: AgendaCor
  projectId: string
}

/** Campos comuns a insert/update — nunca inclui `criado_por` (só setado na criação). */
function eventFieldsFromValues(
  values: AgendaEventFormValues
): Pick<
  TablesInsert<'agenda_events'>,
  'titulo' | 'descricao' | 'inicio' | 'fim' | 'cor' | 'project_id'
> {
  return {
    titulo: values.titulo,
    descricao: values.descricao === '' ? null : values.descricao,
    inicio: localDateTimeToISO(values.data, values.horaInicio),
    fim: localDateTimeToISO(values.data, values.horaFim),
    cor: values.cor,
    project_id: values.projectId === '' ? null : values.projectId,
  }
}

function insertPayloadFromValues(
  values: AgendaEventFormValues,
  criadoPor: string | null
): TablesInsert<'agenda_events'> {
  return { ...eventFieldsFromValues(values), criado_por: criadoPor }
}

export function useAgendaMutations() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['agenda'] })

  const createMutation = useMutation({
    mutationFn: async (values: AgendaEventFormValues) => {
      const payload = insertPayloadFromValues(values, user?.id ?? null)
      const { error } = await supabase.from('agenda_events').insert(payload)
      if (error) throw new Error(error.message)
    },
    onSuccess: invalidate,
  })

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      values,
    }: {
      id: string
      values: AgendaEventFormValues
    }) => {
      const payload = eventFieldsFromValues(values)
      const { error } = await supabase
        .from('agenda_events')
        .update(payload)
        .eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: invalidate,
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('agenda_events')
        .delete()
        .eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: invalidate,
  })

  return { createMutation, updateMutation, deleteMutation }
}

export function useAgendaProjects() {
  return useQuery({
    queryKey: ['agenda', 'projects-lookup'],
    queryFn: async (): Promise<Pick<Tables<'projects'>, 'id' | 'nome'>[]> => {
      const { data, error } = await supabase
        .from('projects')
        .select('id, nome')
        .order('nome', { ascending: true })
      if (error) throw new Error(error.message)
      return data
    },
    staleTime: 60_000,
  })
}
