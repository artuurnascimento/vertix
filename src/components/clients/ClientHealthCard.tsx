import { Link } from 'react-router-dom'
import { HeartPulse } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { formatBRL } from '../../lib/commercial'

interface HealthRow {
  client_id: string
  nome: string
  empresa: string | null
  score: number
  faixa: 'saudavel' | 'atencao' | 'risco'
  em_atraso_valor: number
  tickets_abertos: number
  sla_estourados: number
  projetos_parados: number
  ultimo_nps: number | null
  dias_inativo: number | null
}

const FAIXA_META: Record<
  HealthRow['faixa'],
  { label: string; ring: string; text: string; bar: string }
> = {
  saudavel: {
    label: 'Saudável',
    ring: 'border-emerald-400/25',
    text: 'text-emerald-300',
    bar: 'bg-emerald-400',
  },
  atencao: {
    label: 'Atenção',
    ring: 'border-amber-400/25',
    text: 'text-amber-300',
    bar: 'bg-amber-400',
  },
  risco: {
    label: 'Risco',
    ring: 'border-red-400/30',
    text: 'text-red-300',
    bar: 'bg-red-400',
  },
}

/** Motivo mais forte por trás de um score baixo, para dar contexto na hora. */
function motivo(row: HealthRow): string | null {
  if (row.em_atraso_valor > 0)
    return `${formatBRL(row.em_atraso_valor)} em atraso`
  if (row.sla_estourados > 0) return `${row.sla_estourados} SLA estourado(s)`
  if (row.projetos_parados > 0)
    return `${row.projetos_parados} projeto(s) parado(s)`
  if (row.ultimo_nps !== null && row.ultimo_nps <= 6)
    return `NPS ${row.ultimo_nps}`
  if (row.tickets_abertos > 0) return `${row.tickets_abertos} chamado(s) aberto(s)`
  return null
}

interface ClientHealthCardProps {
  /** Só mostra quem não está saudável (default: mostra os piores independente). */
  onlyAtRisk?: boolean
  limit?: number
}

/** Saúde da carteira: clientes ordenados do pior para o melhor score. */
export default function ClientHealthCard({
  onlyAtRisk = false,
  limit = 6,
}: ClientHealthCardProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['client-health'],
    queryFn: async (): Promise<HealthRow[]> => {
      const { data, error } = await supabase
        .from('client_health')
        .select('*')
        .order('score', { ascending: true })
      if (error) throw new Error(error.message)
      return (data ?? []) as unknown as HealthRow[]
    },
  })

  const linhas = (data ?? [])
    .filter((r) => (onlyAtRisk ? r.faixa !== 'saudavel' : true))
    .slice(0, limit)

  return (
    <section className="flex h-full flex-col rounded-2xl border border-white/5 bg-surface-1 p-5">
      <div className="flex items-center gap-2">
        <HeartPulse className="h-4 w-4 text-accent" />
        <h2 className="text-sm font-semibold text-ink">Saúde da carteira</h2>
      </div>

      {isLoading ? (
        <div className="mt-4 space-y-2">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-surface-2" />
          ))}
        </div>
      ) : linhas.length === 0 ? (
        <p className="mt-6 flex-1 text-center text-sm font-light text-muted">
          {onlyAtRisk
            ? 'Nenhum cliente em risco. Carteira saudável.'
            : 'Nenhum cliente cadastrado ainda.'}
        </p>
      ) : (
        <ul className="mt-3 flex list-none flex-col gap-2 p-0">
          {linhas.map((row) => {
            const meta = FAIXA_META[row.faixa]
            const razao = motivo(row)
            return (
              <li key={row.client_id}>
                <Link
                  to={`/admin/clientes/${row.client_id}`}
                  className="flex items-center gap-3 rounded-lg border border-white/5 bg-surface-2 px-3 py-2.5 transition-colors duration-150 hover:border-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                >
                  <div
                    className={`flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-full border ${meta.ring}`}
                  >
                    <span className={`text-sm font-bold tabular-nums ${meta.text}`}>
                      {row.score}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">
                      {row.nome}
                    </p>
                    <p className="truncate text-xs font-light text-muted">
                      <span className={meta.text}>{meta.label}</span>
                      {razao ? ` · ${razao}` : ''}
                    </p>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
