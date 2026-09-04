import { formatScore } from './raioxData'

/**
 * Badge da nota da análise (0-10): <5 vermelho, 5-7 âmbar, >7 verde.
 * Sem nota (análise ainda rodando ou falha) fica neutro.
 */

const SCORE_RED_BELOW = 5
const SCORE_GREEN_ABOVE = 7

function scoreClasses(score: number | null): string {
  if (score === null) return 'border-white/10 bg-white/5 text-muted'
  if (score < SCORE_RED_BELOW)
    return 'border-red-400/25 bg-red-400/10 text-red-300'
  if (score <= SCORE_GREEN_ABOVE)
    return 'border-amber-400/25 bg-amber-400/10 text-amber-300'
  return 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300'
}

interface ScoreBadgeProps {
  score: number | null
}

export default function ScoreBadge({ score }: ScoreBadgeProps) {
  return (
    <span
      title="Nota da análise (0–10)"
      className={`inline-flex min-w-11 justify-center rounded-full border px-2.5 py-0.5 font-mono text-xs font-semibold tabular-nums ${scoreClasses(score)}`}
    >
      {formatScore(score)}
    </span>
  )
}
