import { useId, useMemo, useState } from 'react'
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
const PADDING_X = 24
const PADDING_TOP = 20
const PADDING_BOTTOM = 36

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

export default function RevenueChart() {
  const { data: receivables, isLoading, isError } = useDashboardReceivables()
  const [hoveredKey, setHoveredKey] = useState<string | null>(null)
  const gradientId = useId()
  const prefersReducedMotion = useReducedMotion()

  const buckets = useMemo(
    () => buildMonthBuckets(receivables ?? [], new Date()),
    [receivables]
  )

  const maxTotal = Math.max(...buckets.map((b) => b.total), 1)
  const hasRevenue = buckets.some((b) => b.total > 0)

  const points = useMemo(() => plotPoints(buckets, maxTotal), [buckets, maxTotal])
  const linePath = useMemo(() => buildSmoothPath(points), [points])
  const areaPath = `${linePath} L${points[points.length - 1]?.x ?? 0},${VIEW_HEIGHT - PADDING_BOTTOM} L${points[0]?.x ?? 0},${VIEW_HEIGHT - PADDING_BOTTOM} Z`

  const hoveredPoint = points.find((p) => p.key === hoveredKey) ?? null

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
          <div className="absolute left-0 top-0 text-[11px] font-medium uppercase tracking-widest text-muted/60">
            máx. {formatBRL(maxTotal)}
          </div>
          <svg
            viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
            className="mt-6 h-56 w-full overflow-visible"
            role="img"
            aria-label="Gráfico de receita mensal"
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6C5BF2" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#6C5BF2" stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* Linhas de referência horizontais */}
            {[0.25, 0.5, 0.75].map((ratio) => (
              <line
                key={ratio}
                x1={PADDING_X}
                x2={VIEW_WIDTH - PADDING_X}
                y1={PADDING_TOP + (VIEW_HEIGHT - PADDING_TOP - PADDING_BOTTOM) * ratio}
                y2={PADDING_TOP + (VIEW_HEIGHT - PADDING_TOP - PADDING_BOTTOM) * ratio}
                stroke="white"
                strokeOpacity={0.04}
              />
            ))}

            <motion.path
              d={areaPath}
              fill={`url(#${gradientId})`}
              stroke="none"
              initial={prefersReducedMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.15 }}
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
              <g key={point.key}>
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={hoveredKey === point.key ? 6 : 4}
                  fill={point.isCurrent ? '#6C5BF2' : '#0C0C0C'}
                  stroke="#6C5BF2"
                  strokeWidth={2}
                  className="cursor-pointer transition-[r] duration-150"
                  onMouseEnter={() => setHoveredKey(point.key)}
                  onMouseLeave={() => setHoveredKey(null)}
                >
                  <title>{`${point.label}: ${formatBRL(point.total)}`}</title>
                </circle>
                <text
                  x={point.x}
                  y={VIEW_HEIGHT - 10}
                  textAnchor="middle"
                  className={`fill-current text-[10px] uppercase tracking-wider ${
                    point.isCurrent ? 'fill-accent font-medium' : 'fill-muted/60'
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

          {hoveredPoint && (
            <div
              className="pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded-md border border-white/10 bg-surface-2 px-2.5 py-1.5 text-xs font-medium text-ink shadow-lg"
              style={{
                left: `${(hoveredPoint.x / VIEW_WIDTH) * 100}%`,
                top: `${(hoveredPoint.y / VIEW_HEIGHT) * 100}%`,
              }}
            >
              {formatBRL(hoveredPoint.total)}
            </div>
          )}
        </div>
      )}
    </DashboardCard>
  )
}
