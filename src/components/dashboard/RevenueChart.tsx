import { useId, useMemo, useState } from 'react'
import type { FocusEvent, KeyboardEvent } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { TrendingUp } from 'lucide-react'
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
const VIEW_WIDTH = 600
const VIEW_HEIGHT = 220
const PADDING_X = 44
const PADDING_TOP = 20
const PADDING_BOTTOM = 36

/** Formata um valor em milhares curtos para o eixo Y (ex.: 20000 → "20k"). */
function formatAxisK(value: number): string {
  if (value === 0) return '0'
  const thousands = value / 1000
  const rounded = Number.isInteger(thousands) ? thousands : thousands.toFixed(1)
  return `${rounded}k`
}

const shortMonthFormatter = new Intl.DateTimeFormat('pt-BR', {
  month: 'short',
})

function monthKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${date.getFullYear()}-${month}`
}

/** Agrupa recebíveis PAGOS por mês de vencimento, últimos 6 meses (0 quando sem dado). */
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
      .filter((r) => r.status === 'pago' && r.vencimento.slice(0, 7) === key)
      .reduce((sum, r) => sum + r.valor, 0)
    return {
      key,
      label: shortMonthFormatter.format(date).replace('.', ''),
      total,
      isCurrent: key === currentKey,
    }
  })
}

interface PlottedPoint extends MonthBucket {
  x: number
  y: number
}

/** Posiciona os buckets no viewBox e devolve também o path suavizado (Catmull-Rom → Bezier). */
function plotPoints(buckets: readonly MonthBucket[], maxTotal: number): PlottedPoint[] {
  const innerWidth = VIEW_WIDTH - PADDING_X * 2
  const innerHeight = VIEW_HEIGHT - PADDING_TOP - PADDING_BOTTOM
  const step = buckets.length > 1 ? innerWidth / (buckets.length - 1) : 0

  return buckets.map((bucket, index) => {
    const x = PADDING_X + index * step
    const ratio = maxTotal === 0 ? 0 : bucket.total / maxTotal
    const y = PADDING_TOP + innerHeight * (1 - ratio)
    return { ...bucket, x, y }
  })
}

/** Curva suave usando pontos de controle intermediários (aproxima Catmull-Rom). */
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

/** Gera o aria-label do gráfico com o insight real (mês/valor de pico). */
function buildChartAriaLabel(buckets: readonly MonthBucket[]): string {
  if (buckets.length === 0) return 'Gráfico de receita mensal, sem dados'
  const peak = buckets.reduce((max, b) => (b.total > max.total ? b : max), buckets[0])
  if (peak.total === 0) {
    return `Receita dos últimos ${buckets.length} meses, nenhum recebimento confirmado no período`
  }
  return `Receita dos últimos ${buckets.length} meses, máximo ${formatBRL(peak.total)} em ${peak.label}`
}

export default function RevenueChart() {
  const { data: receivables, isLoading, isError } = useDashboardReceivables()
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const gradientId = useId()
  const glowId = useId()
  const prefersReducedMotion = useReducedMotion()

  const buckets = useMemo(
    () => buildMonthBuckets(receivables ?? [], new Date()),
    [receivables]
  )

  const maxTotal = Math.max(...buckets.map((b) => b.total), 1)
  const hasRevenue = buckets.some((b) => b.total > 0)
  const chartAriaLabel = useMemo(() => buildChartAriaLabel(buckets), [buckets])

  const points = useMemo(() => plotPoints(buckets, maxTotal), [buckets, maxTotal])
  const linePath = useMemo(() => buildSmoothPath(points), [points])
  const areaPath = `${linePath} L${points[points.length - 1]?.x ?? 0},${VIEW_HEIGHT - PADDING_BOTTOM} L${points[0]?.x ?? 0},${VIEW_HEIGHT - PADDING_BOTTOM} Z`

  const activePoint = points.find((p) => p.key === activeKey) ?? null

  function closeTooltip(event: FocusEvent<SVGGElement>): void {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setActiveKey(null)
    }
  }

  function handlePointKeyDown(event: KeyboardEvent<SVGGElement>): void {
    if (event.key === 'Escape') {
      setActiveKey(null)
      event.currentTarget.blur()
    }
  }

  return (
    <DashboardCard
      title="Receita dos últimos 6 meses"
      subtitle="Recebimentos confirmados por mês de vencimento"
      action={{ label: 'ver financeiro', to: '/admin/financeiro' }}
    >
      {isLoading && <CardSkeleton rows={1} rowClassName="h-48" />}

      {isError && <CardErrorState />}

      {!isLoading && !isError && !hasRevenue && (
        <CardEmptyState
          icon={TrendingUp}
          title="Nenhum recebimento ainda"
          description="Quando os primeiros pagamentos forem confirmados, a evolução mensal aparece aqui."
        />
      )}

      {!isLoading && !isError && hasRevenue && (
        <div className="relative">
          <div className="absolute right-0 top-0 z-10 inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-medium uppercase tracking-widest text-muted">
            Últimos 6 meses
          </div>
          {/* Alternativa textual acessível — mesmos dados do SVG, oculta visualmente. */}
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
            className="mt-6 h-56 w-full overflow-visible"
            role="img"
            aria-label={chartAriaLabel}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6C5BF2" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#6C5BF2" stopOpacity="0" />
              </linearGradient>
              <filter id={glowId} x="-20%" y="-60%" width="140%" height="220%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="3" />
              </filter>
            </defs>

            {/* Linhas de referência horizontais + labels do eixo Y em "k" */}
            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
              const y = PADDING_TOP + (VIEW_HEIGHT - PADDING_TOP - PADDING_BOTTOM) * (1 - ratio)
              return (
                <g key={ratio}>
                  <line
                    x1={PADDING_X}
                    x2={VIEW_WIDTH - PADDING_X}
                    y1={y}
                    y2={y}
                    stroke="white"
                    strokeOpacity={0.04}
                  />
                  <text
                    x={PADDING_X - 10}
                    y={y}
                    textAnchor="end"
                    dominantBaseline="middle"
                    className="fill-muted tabular-nums"
                    style={{ fontSize: '9px' }}
                  >
                    {formatAxisK(maxTotal * ratio)}
                  </text>
                </g>
              )
            })}

            <motion.path
              d={areaPath}
              fill={`url(#${gradientId})`}
              stroke="none"
              initial={prefersReducedMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.15 }}
            />

            {/* Camada duplicada e borrada → glow neon atrás da linha nítida */}
            <motion.path
              d={linePath}
              fill="none"
              stroke="#6C5BF2"
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
              filter={`url(#${glowId})`}
              opacity={0.75}
              initial={prefersReducedMotion ? false : { pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1, ease: 'easeOut' }}
            />

            <motion.path
              d={linePath}
              fill="none"
              stroke="#6C5BF2"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={prefersReducedMotion ? false : { pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1, ease: 'easeOut' }}
            />

            {points.map((point, index) => (
              <g
                key={point.key}
                tabIndex={0}
                role="button"
                aria-label={`${point.label}: ${formatBRL(point.total)}`}
                className="cursor-pointer outline-none"
                onMouseEnter={() => setActiveKey(point.key)}
                onMouseLeave={() => setActiveKey(null)}
                onFocus={() => setActiveKey(point.key)}
                onBlur={closeTooltip}
                onKeyDown={handlePointKeyDown}
              >
                {point.isCurrent && (
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r={9}
                    fill="#6C5BF2"
                    opacity={0.18}
                    filter={`url(#${glowId})`}
                  />
                )}
                {activeKey === point.key && (
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r={12}
                    fill="none"
                    stroke="#6C5BF2"
                    strokeWidth={1.5}
                    strokeOpacity={0.5}
                  />
                )}
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={activeKey === point.key ? 6 : 4}
                  fill={point.isCurrent ? '#6C5BF2' : '#0C0C0C'}
                  stroke="#6C5BF2"
                  strokeWidth={2}
                  className="transition-[r] duration-150"
                >
                  <title>{`${point.label}: ${formatBRL(point.total)}`}</title>
                </circle>
                {/* Alvo de toque/foco maior — invisível, facilita clique e tab. */}
                <circle cx={point.x} cy={point.y} r={14} fill="transparent" />
                <text
                  x={point.x}
                  y={VIEW_HEIGHT - 10}
                  textAnchor="middle"
                  className={`fill-current text-[10px] uppercase tracking-wider tabular-nums ${
                    point.isCurrent ? 'fill-accent font-medium' : 'fill-muted'
                  }`}
                  style={{ fontSize: '10px' }}
                >
                  {point.label}
                </text>
                {index === points.length - 1 && (
                  <title>{`${point.label}: ${formatBRL(point.total)}`}</title>
                )}
              </g>
            ))}
          </svg>

          {activePoint && (
            <div
              role="status"
              className="pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded-lg border border-accent/30 bg-surface-2 px-3 py-1.5 text-xs font-medium text-ink shadow-lg"
              style={{
                left: `${(activePoint.x / VIEW_WIDTH) * 100}%`,
                top: `${(activePoint.y / VIEW_HEIGHT) * 100}%`,
              }}
            >
              <span className="capitalize text-muted">{activePoint.label}</span>{' '}
              <span className="font-kanit font-semibold tabular-nums text-ink">
                {formatBRL(activePoint.total)}
              </span>
            </div>
          )}
        </div>
      )}
    </DashboardCard>
  )
}
