import { motion, useReducedMotion } from 'framer-motion'

/**
 * Progresso do wizard: "Pergunta X de N" + barra fina accent. A barra anima
 * via scaleX (compositor-friendly); com prefers-reduced-motion vira salto.
 */

interface WizardProgressProps {
  /** Índice (0-based) da pergunta atual — ignorado na revisão. */
  current: number
  total: number
  isReview: boolean
}

export default function WizardProgress({
  current,
  total,
  isReview,
}: WizardProgressProps) {
  const reducedMotion = useReducedMotion()
  const fraction = isReview ? 1 : (current + 1) / (total + 1)

  return (
    <div className="mb-6">
      <div className="flex items-baseline justify-between text-xs">
        <span className="font-medium tracking-wide text-muted">
          {isReview ? 'Revisão final' : `Pergunta ${current + 1} de ${total}`}
        </span>
        <span aria-hidden className="text-muted/60">
          {Math.round(fraction * 100)}%
        </span>
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(fraction * 100)}
        aria-label="Progresso do briefing"
        className="mt-2 h-1 overflow-hidden rounded-full bg-white/10"
      >
        <motion.div
          className="h-full w-full origin-left rounded-full bg-accent"
          initial={false}
          animate={{ scaleX: fraction }}
          transition={
            reducedMotion
              ? { duration: 0 }
              : { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }
          }
        />
      </div>
    </div>
  )
}
