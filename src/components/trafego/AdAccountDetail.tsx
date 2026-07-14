import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { formatBRL } from '../../lib/commercial'
import {
  aggregateCurrentMonth,
  cpc,
  cpm,
  ctr,
  formatDerived,
  roas,
} from './adMetrics'
import type { DailyMetric } from './adMetrics'

/**
 * Detalhe expandido de uma conta de anúncio: cartões do mês, gráfico de
 * gasto 30d, funil impressões→cliques→conversões e tabela dos últimos 14
 * dias. Derivados sempre calculados (adMetrics), nunca armazenados.
 */

const CHART_HEIGHT = 72
const TABLE_DAYS = 14

function num(value: number): string {
  return value.toLocaleString('pt-BR')
}

function dataBR(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

function SpendChart({ rows }: { rows: DailyMetric[] }) {
  if (rows.length === 0) return null
  const max = Math.max(...rows.map((r) => r.gasto), 0.01)
  const barWidth = 100 / rows.length
  const total = rows.reduce((s, r) => s + r.gasto, 0)

  return (
    <svg
      viewBox={`0 0 100 ${CHART_HEIGHT}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={`Gasto diário dos últimos ${rows.length} dias, total ${formatBRL(total)}`}
      className="h-20 w-full"
    >
      {rows.map((r, i) => {
        const altura = Math.max((r.gasto / max) * (CHART_HEIGHT - 6), 1)
        return (
          <rect
            key={r.data}
            x={i * barWidth + barWidth * 0.2}
            y={CHART_HEIGHT - altura}
            width={barWidth * 0.6}
            height={altura}
            rx={1}
            className="fill-accent/70"
            style={{ filter: 'drop-shadow(0 0 4px rgba(108,91,242,0.45))' }}
          >
            <title>{`${dataBR(r.data)}: ${formatBRL(r.gasto)}`}</title>
          </rect>
        )
      })}
    </svg>
  )
}

function Funnel({
  impressoes,
  cliques,
  conversoes,
}: {
  impressoes: number
  cliques: number
  conversoes: number
}) {
  const max = Math.max(impressoes, 1)
  const steps = [
    { label: 'Impressões', valor: impressoes, cor: 'bg-sky-400/70' },
    { label: 'Cliques', valor: cliques, cor: 'bg-accent/80' },
    { label: 'Conversões', valor: conversoes, cor: 'bg-emerald-400/80' },
  ]
  return (
    <div className="flex flex-col gap-2.5">
      {steps.map((s) => (
        <div key={s.label}>
          <div className="flex items-baseline justify-between text-xs">
            <span className="font-medium uppercase tracking-widest text-muted">
              {s.label}
            </span>
            <span className="tabular-nums font-semibold text-ink">
              {num(s.valor)}
            </span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-white/5">
            <div
              className={`h-2 rounded-full ${s.cor}`}
              style={{
                width: `${Math.max((s.valor / max) * 100, s.valor > 0 ? 2 : 0)}%`,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

export default function AdAccountDetail({ accountId }: { accountId: string }) {
  const { data: rows, isLoading } = useQuery({
    queryKey: ['ad-metrics', accountId],
    queryFn: async (): Promise<DailyMetric[]> => {
      const desde = new Date()
      desde.setDate(desde.getDate() - 30)
      const { data, error } = await supabase
        .from('ad_metrics_daily')
        .select('data, gasto, impressoes, cliques, conversoes, receita')
        .eq('ad_account_id', accountId)
        .gte('data', desde.toISOString().slice(0, 10))
        .order('data', { ascending: true })
      if (error) throw new Error(error.message)
      return data
    },
  })

  if (isLoading) {
    return <div className="h-40 animate-pulse rounded-xl bg-surface-2" />
  }

  if (!rows || rows.length === 0) {
    return (
      <p className="py-6 text-center text-sm font-light text-muted">
        Sincronize para ver os primeiros números.
      </p>
    )
  }

  const mes = aggregateCurrentMonth(rows)
  const cards = [
    { label: 'Gasto (mês)', valor: formatBRL(mes.gasto) },
    { label: 'Receita (mês)', valor: formatBRL(mes.receita) },
    { label: 'ROAS', valor: formatDerived(roas(mes.gasto, mes.receita)) },
    { label: 'CPM', valor: formatDerived(cpm(mes.gasto, mes.impressoes), 'R$ ') },
    { label: 'CPC', valor: formatDerived(cpc(mes.gasto, mes.cliques), 'R$ ') },
    {
      label: 'CTR',
      valor:
        ctr(mes.cliques, mes.impressoes) === null
          ? '—'
          : `${formatDerived(ctr(mes.cliques, mes.impressoes))}%`,
    },
  ]

  const ultimos = [...rows].reverse().slice(0, TABLE_DAYS)

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-white/5 bg-surface-2 px-3 py-2.5"
          >
            <p className="text-[10px] font-medium uppercase tracking-widest text-muted">
              {card.label}
            </p>
            <p className="mt-1 tabular-nums text-sm font-semibold text-ink">
              {card.valor}
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <p className="mb-2 text-[11px] font-medium uppercase tracking-widest text-muted">
            Gasto diário (30d)
          </p>
          <SpendChart rows={rows} />
        </div>
        <div>
          <p className="mb-2 text-[11px] font-medium uppercase tracking-widest text-muted">
            Funil do mês
          </p>
          <Funnel
            impressoes={mes.impressoes}
            cliques={mes.cliques}
            conversoes={mes.conversoes}
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead>
            <tr className="text-[10px] font-medium uppercase tracking-widest text-muted">
              <th className="pb-2 pr-3 font-medium">Dia</th>
              <th className="pb-2 pr-3 font-medium">Gasto</th>
              <th className="pb-2 pr-3 font-medium">Impressões</th>
              <th className="pb-2 pr-3 font-medium">Cliques</th>
              <th className="pb-2 pr-3 font-medium">Conversões</th>
              <th className="pb-2 font-medium">Receita</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {ultimos.map((r) => (
              <tr key={r.data} className="tabular-nums text-ink/85">
                <td className="py-2 pr-3">{dataBR(r.data)}</td>
                <td className="py-2 pr-3">{formatBRL(r.gasto)}</td>
                <td className="py-2 pr-3">{num(r.impressoes ?? 0)}</td>
                <td className="py-2 pr-3">{num(r.cliques ?? 0)}</td>
                <td className="py-2 pr-3">{num(r.conversoes ?? 0)}</td>
                <td className="py-2">{formatBRL(r.receita ?? 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
