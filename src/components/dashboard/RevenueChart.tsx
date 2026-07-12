import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { BarChart3 } from 'lucide-react'
import { formatBRL } from '../../lib/commercial'
import DashboardCard from './DashboardCard'
import { CardEmptyState, CardErrorState, CardSkeleton } from './CardStates'
import { useDashboardReceivables } from './useDashboardData'
import type { DashboardReceivable } from './useDashboardData'

interface MonthBucket {
  key: string
  label: string
  total: number
  isCurrent: boolean
}

const MONTHS_SHOWN = 6
const BAR_STAGGER_S = 0.06
const BAR_DURATION_S = 0.55
/** Altura mínima visível quando o mês teve algum recebimento. */
const MIN_BAR_PERCENT = 6

const shortMonthFormatter = new Intl.DateTimeFormat('pt-BR', {
  month: 'short',
})

function monthKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${date.getFullYear()}-${month}`
}

/** Agrupa recebíveis PAGOS por mês de pagamento (pago_em), últimos 6 meses. */
function buildMonthBuckets(
  receivables: readonly DashboardReceivable[],
  now: Date
): MonthBucket[] {
  const currentKey = monthKey(now)
  return Array.from({ length: MONTHS_SHOWN }, (_, i) => {
    const date = new Date(
      now.getFullYear(),
      now.getMonth() - (MONTHS_SHOWN - 1 - i),
      1
    )
    const key = monthKey(date)
    const total = receivables
      .filter(
        (r) =>
          r.status === 'pago' &&
          r.pago_em !== null &&
          r.pago_em.slice(0, 7) === key
      )
      .reduce((sum, r) => sum + r.valor, 0)
    return {
      key,
      label: shortMonthFormatter.format(date).replace('.', ''),
      total,
      isCurrent: key === currentKey,
    }
  })
}

export default function RevenueChart() {
  const { data: receivables, isLoading, isError } = useDashboardReceivables()

  const buckets = useMemo(
    () => buildMonthBuckets(receivables ?? [], new Date()),
    [receivables]
  )

  const maxTotal = Math.max(...buckets.map((b) => b.total), 1)
  const hasRevenue = buckets.some((b) => b.total > 0)

  return (
    <DashboardCard
      title="Receita"
      subtitle="Recebimentos confirmados nos últimos 6 meses"
      action={{ label: 'ver financeiro', to: '/admin/financeiro' }}
    >
      {isLoading && <CardSkeleton rows={3} rowClassName="h-12" />}

      {isError && <CardErrorState />}

      {!isLoading && !isError && !hasRevenue && (
        <CardEmptyState
          icon={BarChart3}
          title="Nenhum recebimento ainda"
          description="Quando os primeiros pagamentos forem confirmados, a evolução mensal aparece aqui."
        />
      )}

      {!isLoading && !isError && hasRevenue && (
        <div className="flex h-full flex-col justify-end">
          <div className="flex items-end gap-3 sm:gap-4">
            {buckets.map((bucket, index) => {
              const percent =
                bucket.total === 0
                  ? 0
                  : Math.max(
                      (bucket.total / maxTotal) * 100,
                      MIN_BAR_PERCENT
                    )
              return (
                <div
                  key={bucket.key}
                  className="group relative flex flex-1 flex-col items-center gap-2"
                >
                  {/* Tooltip com o valor do mês */}
                  <span
                    role="tooltip"
                    className="pointer-events-none absolute -top-8 z-10 whitespace-nowrap rounded-md border border-white/10 bg-surface-2 px-2 py-1 text-[11px] font-medium text-ink opacity-0 transition-opacity duration-150 group-hover:opacity-100"
                  >
                    {formatBRL(bucket.total)}
                  </span>
                  <span
                    aria-label={`${bucket.label}: ${formatBRL(bucket.total)}`}
                    className="flex h-36 w-full max-w-12 items-end overflow-hidden rounded-t-md"
                  >
                    {bucket.total > 0 ? (
                      <motion.span
                        initial={{ height: 0 }}
                        animate={{ height: `${percent}%` }}
                        transition={{
                          duration: BAR_DURATION_S,
                          ease: 'easeOut',
                          delay: index * BAR_STAGGER_S,
                        }}
                        className={`block w-full rounded-t-md transition-colors duration-150 ${
                          bucket.isCurrent
                            ? 'bg-accent group-hover:bg-accent-2'
                            : 'bg-white/10 group-hover:bg-white/20'
                        }`}
                      />
                    ) : (
                      <span
                        aria-hidden
                        className="block h-px w-full bg-white/10"
                      />
                    )}
                  </span>
                  <span
                    className={`text-[11px] uppercase tracking-wider ${
                      bucket.isCurrent
                        ? 'font-medium text-accent'
                        : 'text-muted/70'
                    }`}
                  >
                    {bucket.label}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </DashboardCard>
  )
}
