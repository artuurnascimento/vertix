import { useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Clock } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import type { Tables } from '../../lib/database.types'
import { formatBRL } from '../../lib/commercial'

type TimeEntry = Tables<'time_entries'> & {
  profiles: Pick<Tables<'profiles'>, 'nome'> | null
}

interface HoursCardProps {
  projectId: string
}

const RECENT_ENTRIES_LIMIT = 8
const HOURS_STEP = 0.5
const VALOR_HORA_KEY = 'valor_hora'

const todayIso = () => new Date().toISOString().slice(0, 10)

function formatEntryDate(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
}

/** Card de horas do projeto — registro rápido, últimas entradas e rentabilidade. */
export default function HoursCard({ projectId }: HoursCardProps) {
  const queryClient = useQueryClient()
  const { user, profile } = useAuth()
  const shouldReduceMotion = useReducedMotion()

  const [data, setData] = useState(todayIso())
  const [horas, setHoras] = useState('')
  const [descricao, setDescricao] = useState('')

  const { data: entries, isLoading } = useQuery({
    queryKey: ['time-entries', projectId],
    queryFn: async (): Promise<TimeEntry[]> => {
      const { data: rows, error } = await supabase
        .from('time_entries')
        .select('*, profiles(nome)')
        .eq('project_id', projectId)
        .order('data', { ascending: false })
        .order('created_at', { ascending: false })
      if (error) throw new Error(error.message)
      return rows
    },
  })

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: async (): Promise<Tables<'settings'>[]> => {
      const { data: rows, error } = await supabase.from('settings').select('*')
      if (error) throw new Error(error.message)
      return rows
    },
  })

  const { data: receivedTotal } = useQuery({
    queryKey: ['receivables-paid-total', projectId],
    queryFn: async (): Promise<number> => {
      const { data: rows, error } = await supabase
        .from('receivables')
        .select('valor')
        .eq('project_id', projectId)
        .eq('status', 'pago')
      if (error) throw new Error(error.message)
      return rows.reduce((sum, r) => sum + r.valor, 0)
    },
  })

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['time-entries', projectId] })

  const createMutation = useMutation({
    mutationFn: async () => {
      const horasNum = Number(horas)
      if (!Number.isFinite(horasNum) || horasNum <= 0) {
        throw new Error('Informe um número de horas válido.')
      }
      const { error } = await supabase.from('time_entries').insert({
        project_id: projectId,
        profile_id: user?.id ?? null,
        data,
        horas: horasNum,
        descricao: descricao.trim() || null,
      })
      if (error) throw new Error(error.message)
    },
    onSuccess: async () => {
      setHoras('')
      setDescricao('')
      setData(todayIso())
      await invalidate()
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (createMutation.isPending) return
    createMutation.mutate()
  }

  const totalHoras = entries?.reduce((sum, e) => sum + e.horas, 0) ?? 0
  const valorHora = Number(
    settings?.find((s) => s.chave === VALOR_HORA_KEY)?.valor ?? '0'
  )
  const custoHoras = totalHoras * valorHora
  const receita = receivedTotal ?? 0
  const rentabilidade = receita - custoHoras
  const isPositive = rentabilidade >= 0

  const recentEntries = entries?.slice(0, RECENT_ENTRIES_LIMIT) ?? []

  return (
    <motion.section
      initial={shouldReduceMotion ? undefined : { opacity: 0, y: 8 }}
      animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      aria-label="Horas do projeto"
      className="rounded-2xl border border-white/5 bg-surface-1 p-6"
    >
      <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
        <Clock className="h-4 w-4 text-accent" />
        Horas
        {totalHoras > 0 && (
          <span className="text-xs font-light tabular-nums text-muted">
            ({totalHoras}h no total)
          </span>
        )}
      </h2>

      <form
        onSubmit={handleSubmit}
        className="mt-4 flex flex-wrap items-end gap-3"
      >
        <div className="flex flex-col gap-1">
          <label htmlFor="hours-date" className="text-[11px] text-muted">
            Data
          </label>
          <input
            id="hours-date"
            type="date"
            value={data}
            onChange={(e) => setData(e.target.value)}
            className="rounded-lg border border-white/5 bg-surface-2 px-3 py-2 text-sm text-ink outline-none transition-colors duration-200 focus:border-accent/60 focus:ring-2 focus:ring-accent/25"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="hours-value" className="text-[11px] text-muted">
            Horas *
          </label>
          <input
            id="hours-value"
            type="number"
            step={HOURS_STEP}
            min={0}
            value={horas}
            onChange={(e) => setHoras(e.target.value)}
            placeholder="0"
            required
            className="w-24 rounded-lg border border-white/5 bg-surface-2 px-3 py-2 text-sm text-ink outline-none transition-colors duration-200 focus:border-accent/60 focus:ring-2 focus:ring-accent/25"
          />
        </div>
        <div className="flex min-w-[10rem] flex-1 flex-col gap-1">
          <label htmlFor="hours-desc" className="text-[11px] text-muted">
            Descrição (opcional)
          </label>
          <input
            id="hours-desc"
            type="text"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="O que foi feito…"
            className="w-full rounded-lg border border-white/5 bg-surface-2 px-3 py-2 text-sm text-ink placeholder:text-muted/50 outline-none transition-colors duration-200 focus:border-accent/60 focus:ring-2 focus:ring-accent/25"
          />
        </div>
        <button
          type="submit"
          disabled={createMutation.isPending}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors duration-200 hover:bg-accent-2 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {createMutation.isPending ? 'Salvando…' : 'Registrar'}
        </button>
      </form>

      {createMutation.isError && (
        <p className="mt-2 text-xs text-red-400" role="alert">
          {createMutation.error.message}
        </p>
      )}

      {isLoading && (
        <div className="mt-4 h-16 animate-pulse rounded-xl bg-surface-2" />
      )}

      {!isLoading && recentEntries.length === 0 && (
        <p className="mt-4 text-sm font-light text-muted">
          Nenhuma hora registrada ainda.
        </p>
      )}

      {!isLoading && recentEntries.length > 0 && (
        <ul className="mt-4 flex flex-col divide-y divide-white/5">
          {recentEntries.map((entry) => (
            <li
              key={entry.id}
              className="flex items-center gap-3 py-2 text-sm"
            >
              <span className="w-12 shrink-0 tabular-nums text-xs text-muted">
                {formatEntryDate(entry.data)}
              </span>
              <span className="w-12 shrink-0 font-medium tabular-nums text-ink">
                {entry.horas}h
              </span>
              <span className="min-w-0 flex-1 truncate text-muted">
                {entry.descricao ?? '—'}
              </span>
              <span className="shrink-0 text-xs text-muted/70">
                {entry.profiles?.nome ?? profile?.nome ?? '—'}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 border-t border-white/5 pt-4">
        <p className="text-[11px] font-medium uppercase tracking-widest text-muted">
          Rentabilidade
        </p>
        <p
          className={`mt-1.5 text-lg font-semibold tabular-nums ${
            isPositive ? 'text-emerald-300' : 'text-red-400'
          }`}
        >
          {formatBRL(rentabilidade)}
        </p>
        <p className="mt-1 text-xs font-light tabular-nums text-muted">
          {formatBRL(receita)} − {totalHoras}h × {formatBRL(valorHora)}
        </p>
      </div>
    </motion.section>
  )
}
