import { useId, useMemo } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

interface SparkLinePoint {
  key: string
  value: number
}

interface SparkLineProps {
  points: readonly SparkLinePoint[]
  colorClass?: string
}

const VIEW_WIDTH = 100
const VIEW_HEIGHT = 32
const PADDING_Y = 4

/** Constrói o path SVG (linha) normalizado ao viewBox. */
function buildPath(points: readonly SparkLinePoint[]): string {
  if (points.length === 0) return ''
  const values = points.map((p) => p.value)
  const max = Math.max(...values, 0)
  const min = Math.min(...values, 0)
  const range = max - min || 1
  const step = points.length > 1 ? VIEW_WIDTH / (points.length - 1) : 0

  return points
    .map((point, index) => {
      const x = index * step
      const normalized = (point.value - min) / range
      const y = VIEW_HEIGHT - PADDING_Y - normalized * (VIEW_HEIGHT - PADDING_Y * 2)
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`
    })
    .join(' ')
}

/** Mini gráfico de linha sem eixos — tendência dos últimos N meses de um KPI. */
export default function SparkLine({
  points,
  colorClass = 'text-accent',
}: SparkLineProps) {
  const gradientId = useId()
  const prefersReducedMotion = useReducedMotion()
  const path = useMemo(() => buildPath(points), [points])

  if (points.length < 2) return null

  return (
    <svg
      viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
      preserveAspectRatio="none"
      className={`h-8 w-full ${colorClass}`}
      aria-hidden
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.35" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <motion.path
        d={`${path} L${VIEW_WIDTH},${VIEW_HEIGHT} L0,${VIEW_HEIGHT} Z`}
        fill={`url(#${gradientId})`}
        stroke="none"
        initial={prefersReducedMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.2 }}
      />
      <motion.path
        d={path}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={prefersReducedMotion ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      />
    </svg>
  )
}
