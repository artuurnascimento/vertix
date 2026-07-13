import { useId, useMemo } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

interface SparkLinePoint {
  key: string
  value: number
}

interface SparkLineProps {
  points: readonly SparkLinePoint[]
  /** Cor neon do card (hex) — usada na linha, no glow e no gradiente de preenchimento. */
  colorHex?: string
}

const VIEW_WIDTH = 200
const VIEW_HEIGHT = 56
const PADDING_Y = 6

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

/** Mini gráfico de linha sem eixos — tendência dos últimos N meses de um KPI, com glow neon. */
export default function SparkLine({
  points,
  colorHex = '#6C5BF2',
}: SparkLineProps) {
  const gradientId = useId()
  const glowId = useId()
  const prefersReducedMotion = useReducedMotion()
  const path = useMemo(() => buildPath(points), [points])

  if (points.length < 2) return null

  return (
    <svg
      viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
      preserveAspectRatio="none"
      className="h-12 w-full sm:h-14"
      aria-hidden
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={colorHex} stopOpacity="0.3" />
          <stop offset="100%" stopColor={colorHex} stopOpacity="0" />
        </linearGradient>
        <filter id={glowId} x="-20%" y="-100%" width="140%" height="300%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" />
        </filter>
      </defs>
      <motion.path
        d={`${path} L${VIEW_WIDTH},${VIEW_HEIGHT} L0,${VIEW_HEIGHT} Z`}
        fill={`url(#${gradientId})`}
        stroke="none"
        initial={prefersReducedMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.2 }}
      />
      {/* Camada duplicada borrada → glow neon atrás da linha nítida */}
      <motion.path
        d={path}
        fill="none"
        stroke={colorHex}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        filter={`url(#${glowId})`}
        opacity={0.8}
        initial={prefersReducedMotion ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      />
      <motion.path
        d={path}
        fill="none"
        stroke={colorHex}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={prefersReducedMotion ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      />
    </svg>
  )
}
