import { Star } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { formatRelativeTime } from '../../lib/format'

interface NpsSummary {
  total_respostas: number
  promotores: number
  neutros: number
  detratores: number
  total_enviadas: number
  nps: number | null
}

interface NpsResposta {
  id: string
  score: number | null
  comentario: string | null
  responded_at: string | null
  clients: { nome: string } | null
}

function scoreColor(score: number): string {
  if (score <= 6) return 'text-red-300'
  if (score <= 8) return 'text-amber-300'
  return 'text-emerald-300'
}

function npsColor(nps: number): string {
  if (nps < 0) return 'text-red-300'
  if (nps < 50) return 'text-amber-300'
  return 'text-emerald-300'
}

/** NPS consolidado pós-entrega + últimas respostas. */
export default function NpsCard() {
  const { data: resumo } = useQuery({
    queryKey: ['nps-summary'],
    queryFn: async (): Promise<NpsSummary | null> => {
      const { data, error } = await supabase.from('nps_summary').select('*').single()
      if (error) throw new Error(error.message)
      return data as unknown as NpsSummary
    },
  })

  const { data: respostas } = useQuery({
    queryKey: ['nps-respostas'],
    queryFn: async (): Promise<NpsResposta[]> => {
      const { data, error } = await supabase
        .from('nps_surveys')
        .select('id, score, comentario, responded_at, clients(nome)')
        .eq('status', 'respondido')
        .order('responded_at', { ascending: false })
        .limit(4)
      if (error) throw new Error(error.message)
      return (data ?? []) as unknown as NpsResposta[]
    },
  })

  const nps = resumo?.nps ?? null
  const total = resumo?.total_respostas ?? 0

  return (
    <section className="rounded-2xl border border-white/5 bg-surface-1 p-5">
      <div className="flex items-center gap-2">
        <Star className="h-4 w-4 text-accent" />
        <h2 className="text-sm font-semibold text-ink">NPS pós-entrega</h2>
        <span className="ml-auto text-xs font-light text-muted">
          {total} resposta(s) · {resumo?.total_enviadas ?? 0} enviada(s)
        </span>
      </div>

      <div className="mt-4 flex items-end gap-6">
        <div>
          <p
            className={`text-5xl font-bold leading-none tabular-nums ${
              nps === null ? 'text-muted/50' : npsColor(nps)
            }`}
          >
            {nps === null ? '—' : nps}
          </p>
          <p className="mt-1 text-xs font-light text-muted">Score NPS</p>
        </div>
        <div className="flex-1 space-y-1.5 pb-1 text-xs">
          <Barra
            label="Promotores"
            valor={resumo?.promotores ?? 0}
            total={total}
            cor="bg-emerald-400"
          />
          <Barra
            label="Neutros"
            valor={resumo?.neutros ?? 0}
            total={total}
            cor="bg-amber-400"
          />
          <Barra
            label="Detratores"
            valor={resumo?.detratores ?? 0}
            total={total}
            cor="bg-red-400"
          />
        </div>
      </div>

      {respostas && respostas.length > 0 && (
        <ul className="mt-5 flex list-none flex-col gap-2 border-t border-white/5 p-0 pt-4">
          {respostas.map((r) => (
            <li key={r.id} className="flex items-start gap-3">
              <span
                className={`mt-0.5 w-6 shrink-0 text-center text-sm font-bold tabular-nums ${
                  r.score !== null ? scoreColor(r.score) : 'text-muted'
                }`}
              >
                {r.score ?? '—'}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-ink">
                  {r.clients?.nome ?? 'Cliente'}
                  {r.responded_at && (
                    <span className="font-light text-muted">
                      {' '}
                      · {formatRelativeTime(r.responded_at)}
                    </span>
                  )}
                </p>
                {r.comentario && (
                  <p className="mt-0.5 line-clamp-2 text-xs font-light text-muted">
                    “{r.comentario}”
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function Barra({
  label,
  valor,
  total,
  cor,
}: {
  label: string
  valor: number
  total: number
  cor: string
}) {
  const pct = total > 0 ? Math.round((valor / total) * 100) : 0
  return (
    <div className="flex items-center gap-2">
      <span className="w-20 shrink-0 text-muted">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
        <div className={`h-full ${cor}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-6 shrink-0 text-right tabular-nums text-ink">{valor}</span>
    </div>
  )
}
