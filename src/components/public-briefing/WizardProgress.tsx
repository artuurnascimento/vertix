import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'

/**
 * Progresso do wizard: "Pergunta X de N" + barra fina accent + microcopy
 * motivacional que celebra marcos (25/50/75%). A barra anima via scaleX
 * (compositor-friendly); o número da pergunta atual "conta" com um leve
 * crossfade/slide. Com prefers-reduced-motion tudo vira salto instantâneo.
 */

interface WizardProgressProps {
  /** Índice (0-based) da pergunta atual — ignorado na revisão. */
  current: number
  total: number
  isReview: boolean
}

const MILESTONES = [
  { at: 0.25, texto: 'Ótimo começo!' },
  { at: 0.5, texto: 'Metade concluída 🎉' },
  { at: 0.75, texto: 'Quase lá!' },
] as const

/** Encontra o marco mais recente já cruzado, se ainda não tiver passado do próximo. */
function marcoAtual(fraction: number): string | null {
  let atingido: string | null = null
  for (const marco of MILESTONES) {
    if (fraction >= marco.at) atingido = marco.texto
  }
  return atingido
}

export default function WizardProgress({
  current,
  total,
  isReview,
}: WizardProgressProps) {
  const reducedMotion = useReducedMotion()
  const fraction = isReview ? 1 : (current + 1) / (total + 1)
  const percent = Math.round(fraction * 100)
  const [milestone, setMilestone] = useState<string | null>(null)

  useEffect(() => {
    const marco = isReview ? null : marcoAtual(fraction)
    if (!marco) return
    setMilestone(marco)
    const timer = setTimeout(() => setMilestone(null), 2200)
    return () => clearTimeout(timer)
  }, [fraction, isReview])

  return (
    <div className="mb-6">
      <div className="flex items-baseline justify-between text-xs">
        <span className="font-medium tracking-wide text-muted">
          {isReview ? 'Revisão final' : `Pergunta ${current + 1} de ${total}`}
        </span>
        <span aria-hidden className="relative inline-flex text-muted/60">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={percent}
              initial={
                reducedMotion ? { opacity: 1 } : { opacity: 0, y: -6 }
              }
              animate={{ opacity: 1, y: 0 }}
              exit={reducedMotion ? { opacity: 1 } : { opacity: 0, y: 6 }}
              transition={{ duration: reducedMotion ? 0 : 0.2 }}
            >
              {percent}%
            </motion.span>
          </AnimatePresence>
        </span>
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
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
              : { type: 'spring', stiffness: 260, damping: 32 }
          }
        />
      </div>

      <div aria-live="polite" className="mt-1.5 h-4">
        <AnimatePresence mode="wait">
          {milestone && (
            <motion.p
              key={milestone}
              initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
              transition={{ duration: reducedMotion ? 0.01 : 0.25 }}
              className="text-[11px] font-medium text-accent"
            >
              {milestone}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
