import type { LucideIcon } from 'lucide-react'

interface CardEmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
}

/** Estado vazio padrão dos cards do dashboard (primeiro uso). */
export function CardEmptyState({
  icon: Icon,
  title,
  description,
}: CardEmptyStateProps) {
  return (
    <div className="flex h-full min-h-[10rem] flex-col items-center justify-center px-4 py-6 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-full border border-accent/20 bg-accent/10">
        <Icon className="h-5 w-5 text-accent" />
      </span>
      <p className="mt-4 text-sm font-semibold text-ink">{title}</p>
      <p className="mt-1 max-w-[16rem] text-xs font-light leading-relaxed text-muted">
        {description}
      </p>
    </div>
  )
}

/** Erro de carregamento — mesmo vocabulário das outras páginas. */
export function CardErrorState() {
  return (
    <p className="py-8 text-center text-sm font-light text-red-400" role="alert">
      Não foi possível carregar os dados. Recarregue a página.
    </p>
  )
}

interface CardSkeletonProps {
  rows?: number
  rowClassName?: string
}

const DEFAULT_SKELETON_ROWS = 4

/** Skeleton genérico de linhas pulsantes. */
export function CardSkeleton({
  rows = DEFAULT_SKELETON_ROWS,
  rowClassName = 'h-8',
}: CardSkeletonProps) {
  return (
    <div aria-label="Carregando" className="flex flex-col gap-3">
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className={`animate-pulse rounded-xl bg-surface-2 ${rowClassName}`}
          style={{ opacity: 1 - i * 0.15 }}
        />
      ))}
    </div>
  )
}
