import { useId, useMemo } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { formatBRL } from '../../lib/commercial'
import AnimatedNumber from './AnimatedNumber'
import { CardErrorState, CardSkeleton } from './CardStates'
import { useDashboardReceivables } from './useDashboardData'
import type { DashboardReceivable } from './useDashboardData'

interface MonthBucket {
  key: string
  label: string
  total: number
  isCurrent: boolean
}

const MONTHS_SHOWN = 6
const VIEW_WIDTH = 600
const VIEW_HEIGHT = 220

function monthKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${date.getFullYear()}-${month}`
}

function monthsAgoKey(now: Date, monthsAgo: number): string {
  return monthKey(new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1))
}

function revenueForMonth(
  receivables: readonly DashboardReceivable[],
  key: string
): number {
  return receivables
    .filter((r) => r.status === 'pago' && r.vencimento.slice(0, 7) === key)
    .reduce((sum, r) => sum + r.valor, 0)
}

function percentDelta(current: number, previous: number): number | null {
  if (previous === 0) return null
  return ((current - previous) / previous) * 100
}

const shortMonthFormatter = new Intl.DateTimeFormat('pt-BR', { month: 'short' })

function buildMonthBuckets(
  receivables: readonly DashboardReceivable[],
  now: Date
): MonthBucket[] {
  const currentKey = monthKey(now)
  return Array.from({ length: MONTHS_SHOWN }, (_, i) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (MONTHS_SHOWN - 1 - i), 1)
    const key = monthKey(date)
    return {
      key,
      label: shortMonthFormatter.format(date).replace('.', ''),
      total: revenueForMonth(receivables, key),
      isCurrent: key === currentKey,
    }
  })
}

interface PlottedPoint extends MonthBucket {
  x: number
  y: number
}

/** Plota o gráfico ocupando TODO o viewBox — curva vaza até as bordas do card (sem padding). */
function plotPoints(buckets: readonly MonthBucket[], maxTotal: number): PlottedPoint[] {
  const step = buckets.length > 1 ? VIEW_WIDTH / (buckets.length - 1) : 0
  return buckets.map((bucket, index) => {
    const x = index * step
    const ratio = maxTotal === 0 ? 0 : bucket.total / maxTotal
    // Curva ocupa a metade inferior do card, deixando espaço para o número editorial no topo.
    const y = VIEW_HEIGHT * 0.42 + VIEW_HEIGHT * 0.55 * (1 - ratio)
    return { ...bucket, x, y }
  })
}

function buildSmoothPath(points: readonly PlottedPoint[]): string {
  if (points.length === 0) return ''
  if (points.length === 1) return `M${points[0].x},${points[0].y}`
  let path = `M${points[0].x},${points[0].y}`
  for (let i = 0; i < points.length - 1; i++) {
    const current = points[i]
    const next = points[i + 1]
    const controlX = (current.x + next.x) / 2
    path += ` C${controlX},${current.y} ${controlX},${next.y} ${next.x},${next.y}`
  }
  return path
}

function buildChartAriaLabel(buckets: readonly MonthBucket[]): string {
  if (buckets.length === 0) return 'Gráfico de receita mensal, sem dados'
  const peak = buckets.reduce((max, b) => (b.total > max.total ? b : max), buckets[0])
  if (peak.total === 0) {
    return `Receita dos últimos ${buckets.length} meses, nenhum recebimento confirmado no período`
  }
  return `Receita dos últimos ${buckets.length} meses, máximo ${formatBRL(peak.total)} em ${peak.label}`
}

/**
 * Card HERÓI do dashboard — Receita do mês. Número editorial gigante flutuando
 * sobre a curva de receita dos últimos 6 meses, integrada como base do card
 * (sem moldura própria). Fusão de KpiCard(revenue) + RevenueChart.
 */
export default function RevenueHero() {
  const { data: receivables, isLoading, isError } = useDashboardReceivables()
  const prefersReducedMotion = useReducedMotion()
  const gradientId = useId()
  const glowId = useId()
  const dotGridId = useId()

  const now = useMemo(() => new Date(), [])
  const buckets = useMemo(
    () => buildMonthBuckets(receivables ?? [], now),
    [receivables, now]
  )
  const maxTotal = Math.max(...buckets.map((b) => b.total), 1)
  const hasRevenue = buckets.some((b) => b.total > 0)
  const chartAriaLabel = useMemo(() => buildChartAriaLabel(buckets), [buckets])
  const points = useMemo(() => plotPoints(buckets, maxTotal), [buckets, maxTotal])
  const linePath = useMemo(() => buildSmoothPath(points), [points])
  const areaPath = `${linePath} L${points[points.length - 1]?.x ?? 0},${VIEW_HEIGHT} L${points[0]?.x ?? 0},${VIEW_HEIGHT} Z`

  const currentKey = monthKey(now)
  const previousKey = monthsAgoKey(now, 1)
  const revenueThisMonth = revenueForMonth(receivables ?? [], currentKey)
  const revenueLastMonth = revenueForMonth(receivables ?? [], previousKey)
  const revenueDelta = percentDelta(revenueThisMonth, revenueLastMonth)
  const isPositive = (revenueDelta ?? 0) >= 0

  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      aria-labelledby="revenue-hero-heading"
      className="hero-card relative flex h-full min-h-[22rem] flex-col overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-[#17141F] to-[#0C0C10] p-7 shadow-[0_0_60px_-15px_rgba(108,91,242,0.35),0_1px_0_0_rgba(255,255,255,0.08)_inset] sm:p-9"
    >
      {/* Borda com glow gradiente sutil — pseudo-camada via box-shadow interno acima + esta linha de topo */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/50 to-transparent"
      />

      {/* Textura exclusiva do herói: dot-grid a ~3% opacidade */}
      <svg aria-hidden className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.05]">
        <defs>
          <pattern id={dotGridId} width="18" height="18" patternUnits="userSpaceOnUse">
            <circle cx="1.5" cy="1.5" r="1.5" fill="white" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${dotGridId})`} />
      </svg>

      {/* Glow radial de acento no canto superior direito */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-accent/25 blur-[90px]"
      />

      <header className="relative z-10 flex items-start justify-between gap-4">
        <div>
          <p
            id="revenue-hero-heading"
            className="text-[11px] font-medium uppercase tracking-[0.25em] text-muted"
          >
            Receita do mês
          </p>
        </div>
        <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-medium uppercase tracking-widest text-muted">
          Últimos 6 meses
        </span>
      </header>

      {isLoading && (
        <div className="relative z-10 mt-6">
          <CardSkeleton rows={1} rowClassName="h-48" />
        </div>
      )}

      {isError && (
        <div className="relative z-10 mt-6">
          <CardErrorState />
        </div>
      )}

      {!isLoading && !isError && (
        <>
          <div className="relative z-10 mt-3">
            <AnimatedNumber
              value={revenueThisMonth}
              format={formatBRL}
              className="hero-heading block font-kanit text-6xl font-bold leading-none tabular-nums sm:text-7xl lg:text-8xl"
            />
            <div className="mt-4 flex items-center gap-3">
              {revenueDelta !== null ? (
                <span
                  className={`inline-flex items-center gap-1.5 text-sm font-medium tabular-nums ${
                    isPositive ? 'text-emerald-300' : 'text-red-400'
                  }`}
                >
                  {isPositive ? (
                    <ArrowUp className="h-3.5 w-3.5" aria-hidden />
                  ) : (
                    <ArrowDown className="h-3.5 w-3.5" aria-hidden />
                  )}
                  {isPositive ? 'Alta de' : 'Queda de'} {Math.abs(revenueDelta).toFixed(0)}%
                  vs. mês anterior
                </span>
              ) : (
                <span className="text-sm font-light text-muted">
                  Sem base de comparação ainda
                </span>
              )}
            </div>
          </div>

          {/* Gráfico integrado como base do card — vaza até as bordas, sem moldura própria */}
          <div className="relative z-0 mt-auto -mx-7 -mb-7 sm:-mx-9 sm:-mb-9">
            {!hasRevenue ? (
              <p className="px-7 pb-6 text-sm font-light text-muted sm:px-9">
                Quando os primeiros pagamentos forem confirmados, a evolução mensal aparece aqui.
              </p>
            ) : (
              <>
                <table className="sr-only">
                  <caption>{chartAriaLabel}</caption>
                  <thead>
                    <tr>
                      <th scope="col">Mês</th>
                      <th scope="col">Receita recebida</th>
                    </tr>
                  </thead>
                  <tbody>
                    {buckets.map((bucket) => (
                      <tr key={bucket.key}>
                        <th scope="row">{bucket.label}</th>
                        <td>{formatBRL(bucket.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <svg
                  viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
                  preserveAspectRatio="none"
                  className="h-44 w-full sm:h-52"
                  role="img"
                  aria-label={chartAriaLabel}
                >
                  <defs>
                    <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6C5BF2" stopOpacity="0.4" />
                      <stop offset="100%" stopColor="#6C5BF2" stopOpacity="0" />
                    </linearGradient>
                    <filter id={glowId} x="-20%" y="-60%" width="140%" height="220%">
                      <feGaussianBlur in="SourceGraphic" stdDeviation="4" />
                    </filter>
                  </defs>

                  <motion.path
                    d={areaPath}
                    fill={`url(#${gradientId})`}
                    stroke="none"
                    initial={prefersReducedMotion ? false : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.6, delay: 0.2 }}
                  />

                  <motion.path
                    d={linePath}
                    fill="none"
                    stroke="#6C5BF2"
                    strokeWidth={3}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    filter={`url(#${glowId})`}
                    opacity={0.85}
                    initial={prefersReducedMotion ? false : { pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 1, ease: 'easeOut', delay: 0.15 }}
                  />

                  <motion.path
                    d={linePath}
                    fill="none"
                    stroke="#B4A8FF"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    initial={prefersReducedMotion ? false : { pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 1, ease: 'easeOut', delay: 0.15 }}
                  />

                  {points.map((point) => (
                    <g key={point.key}>
                      {point.isCurrent && (
                        <circle
                          cx={point.x}
                          cy={point.y}
                          r={10}
                          fill="#6C5BF2"
                          opacity={0.2}
                          filter={`url(#${glowId})`}
                        />
                      )}
                      <circle
                        cx={point.x}
                        cy={point.y}
                        r={point.isCurrent ? 5 : 3.5}
                        fill={point.isCurrent ? '#6C5BF2' : '#0C0C10'}
                        stroke="#B4A8FF"
                        strokeWidth={1.75}
                      >
                        <title>{`${point.label}: ${formatBRL(point.total)}`}</title>
                      </circle>
                    </g>
                  ))}
                </svg>
              </>
            )}
          </div>
        </>
      )}
    </motion.section>
  )
}
