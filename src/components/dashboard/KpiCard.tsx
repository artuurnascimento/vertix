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

/** Cor neon dedicada por módulo — hex usado no glow SVG, classes usadas no chip/borda. */
export interface KpiAccent {
  hex: string
  chipClass: string
  borderHoverClass: string
}

interface KpiCardProps {
  label: string
  value: number
  format: (value: number) => string
  icon: LucideIcon
  accent: KpiAccent
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
  accent,
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
      className={`group relative flex h-full flex-col overflow-hidden rounded-2xl border border-white/5 bg-gradient-to-b from-surface-1 to-[#101018] p-5 shadow-[0_1px_0_0_rgba(255,255,255,0.06)_inset] transition-all duration-300 ${accent.borderHoverClass}`}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"
      />

      <div className="flex items-start justify-between gap-2">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${accent.chipClass}`}
        >
          <Icon aria-hidden className="h-4 w-4" />
        </span>
        <p className="pt-1.5 text-[11px] font-medium uppercase tracking-widest text-muted">
          {label}
        </p>
      </div>

      <AnimatedNumber
        value={value}
        format={format}
        className="mt-4 block font-kanit text-3xl font-bold leading-none tabular-nums text-ink sm:text-4xl"
      />

      <div className="mt-2 flex items-center justify-between gap-3">
        {delta ? (
          <span
            className={`inline-flex items-center gap-1 text-xs font-medium tabular-nums ${
              isPositive ? 'text-emerald-300' : 'text-red-400'
            }`}
          >
            {isPositive ? (
              <ArrowUp className="h-3 w-3" aria-hidden />
            ) : (
              <ArrowDown className="h-3 w-3" aria-hidden />
            )}
            <span>
              {isPositive ? 'Alta de' : 'Queda de'} {Math.abs(delta.percent).toFixed(0)}%{' '}
              {delta.label}
            </span>
          </span>
        ) : (
          <span aria-hidden />
        )}
      </div>

      {sparkline && sparkline.length >= 2 && (
        <div className="-mx-5 mt-auto -mb-5 pt-3">
          <SparkLine points={sparkline} colorHex={accent.hex} />
        </div>
      )}
    </motion.article>
  )
}
