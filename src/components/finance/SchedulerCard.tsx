import { useState } from 'react'
import { CalendarClock, Play, RotateCw } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { Tables } from '../../lib/database.types'
import { formatRelativeTime } from '../../lib/format'

type JobRun = Tables<'job_runs'>

const STATUS_DOT: Record<string, string> = {
  ok: 'bg-emerald-400',
  pulado: 'bg-white/40',
  erro: 'bg-red-400',
}

const ROTINAS = [
  { label: 'Cobrança recorrente', quando: 'todo dia 1, 06:00' },
  { label: 'Lembretes de pagamento', quando: 'diário, 09:00' },
  { label: 'Varredura de alertas', quando: 'diário, 08:00' },
]

/**
 * Cartão do agendador: mostra que o robô está de pé (rotinas + últimas
 * execuções via job_runs) e permite rodar a cobrança recorrente na hora.
 */
export default function SchedulerCard() {
  const queryClient = useQueryClient()
  const [feedback, setFeedback] = useState<string | null>(null)

  const { data: runs } = useQuery({
    queryKey: ['job-runs'],
    queryFn: async (): Promise<JobRun[]> => {
      const { data, error } = await supabase
        .from('job_runs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5)
      if (error) throw new Error(error.message)
      return data
    },
  })

  const rodarCobranca = useMutation({
    mutationFn: async (): Promise<number> => {
      const { data, error } = await supabase.rpc(
        'generate_subscription_receivables'
      )
      if (error) throw new Error(error.message)
      return (data as number) ?? 0
    },
    onSuccess: async (criadas) => {
      setFeedback(
        criadas > 0
          ? `${criadas} cobrança(s) gerada(s).`
          : 'Nenhuma cobrança pendente neste ciclo.'
      )
      await queryClient.invalidateQueries({ queryKey: ['job-runs'] })
      await queryClient.invalidateQueries({ queryKey: ['receivables'] })
    },
    onError: () => setFeedback('Só administradores podem rodar a cobrança.'),
  })

  return (
    <section className="rounded-2xl border border-white/5 bg-surface-1 p-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-accent" />
          <h2 className="text-sm font-semibold text-ink">Agendador</h2>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-300">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Ativo
        </span>
        <button
          type="button"
          onClick={() => rodarCobranca.mutate()}
          disabled={rodarCobranca.isPending}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-accent/30 bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent transition-colors duration-150 hover:bg-accent/20 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        >
          {rodarCobranca.isPending ? (
            <RotateCw className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Play className="h-3.5 w-3.5" />
          )}
          Rodar cobrança agora
        </button>
      </div>

      {feedback && (
        <p className="mt-3 text-xs font-light text-muted">{feedback}</p>
      )}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted/70">
            Rotinas
          </p>
          <ul className="mt-2 flex list-none flex-col gap-1.5 p-0">
            {ROTINAS.map((r) => (
              <li
                key={r.label}
                className="flex items-center justify-between text-xs"
              >
                <span className="text-ink">{r.label}</span>
                <span className="font-light text-muted">{r.quando}</span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted/70">
            Últimas execuções
          </p>
          {!runs || runs.length === 0 ? (
            <p className="mt-2 text-xs font-light text-muted">
              Ainda sem execuções registradas.
            </p>
          ) : (
            <ul className="mt-2 flex list-none flex-col gap-1.5 p-0">
              {runs.map((run) => (
                <li key={run.id} className="flex items-center gap-2 text-xs">
                  <span
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                      STATUS_DOT[run.status] ?? 'bg-white/40'
                    }`}
                  />
                  <span className="truncate text-ink">{run.job}</span>
                  <span className="ml-auto shrink-0 font-light text-muted">
                    {formatRelativeTime(run.created_at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  )
}
