import { motion } from 'framer-motion'
import { ArrowDown, ArrowUp } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import AnimatedNumber from './AnimatedNumber'
import SparkLine from './SparkLine'

interface KpiDelta {
  /** Percentual já calculado, positivo = alta. */
  percent: number
  label: string
}

interface KpiCardProps {
  label: string
  value: number
  format: (value: number) => string
  icon: LucideIcon
  /** Classe de fundo translúcido do chip (ex.: "bg-accent/10 text-accent"). */
  chipClass: string
  delta?: KpiDelta
  sparkline?: readonly { key: string; value: number }[]
  index?: number
}

const CARD_STAGGER_S = 0.07

export default function KpiCard({
  label,
  value,
  format,
  icon: Icon,
  chipClass,
  delta,
  sparkline,
  index = 0,
}: KpiCardProps) {
  const isPositive = (delta?.percent ?? 0) >= 0

  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.4,
        delay: index * CARD_STAGGER_S,
        ease: [0.16, 1, 0.3, 1],
      }}
      className="group relative overflow-hidden rounded-2xl border border-white/5 bg-surface-1 p-5 transition-colors duration-200 hover:border-accent/40"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-widest text-muted/70">
          {label}
        </p>
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${chipClass}`}
        >
          <Icon aria-hidden className="h-4 w-4" />
        </span>
      </div>

      <AnimatedNumber
        value={value}
        format={format}
        className="mt-3 block font-kanit text-3xl font-bold leading-none text-ink"
      />

      <div className="mt-3 flex items-center justify-between gap-3">
        {delta ? (
          <span
            className={`inline-flex items-center gap-1 text-xs font-medium ${
              isPositive ? 'text-emerald-300' : 'text-red-400'
            }`}
          >
            {isPositive ? (
              <ArrowUp className="h-3 w-3" />
            ) : (
              <ArrowDown className="h-3 w-3" />
            )}
            {Math.abs(delta.percent).toFixed(0)}% {delta.label}
          </span>
        ) : (
          <span aria-hidden />
        )}
      </div>

      {sparkline && sparkline.length >= 2 && (
        <div className="mt-3 -mb-1">
          <SparkLine points={sparkline} colorClass={chipClass.match(/text-\S+/)?.[0] ?? 'text-accent'} />
        </div>
      )}
    </motion.article>
  )
}
