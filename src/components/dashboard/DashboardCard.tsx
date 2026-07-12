import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'

interface DashboardCardProps {
  title: string
  subtitle?: string
  /** Link discreto no canto do card ("ver financeiro", etc.). */
  action?: { label: string; to: string }
  children: ReactNode
  className?: string
}

/** Casca padrão dos cards do dashboard — surface-1, borda white/5. */
export default function DashboardCard({
  title,
  subtitle,
  action,
  children,
  className = '',
}: DashboardCardProps) {
  return (
    <section
      className={`flex h-full flex-col rounded-2xl border border-white/5 bg-surface-1 p-6 ${className}`}
    >
      <header className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-kanit text-base font-semibold text-ink">
            {title}
          </h2>
          {subtitle && (
            <p className="mt-0.5 text-xs font-light text-muted">{subtitle}</p>
          )}
        </div>
        {action && (
          <Link
            to={action.to}
            className="group inline-flex shrink-0 items-center gap-1 rounded-md text-xs font-medium text-accent transition-colors duration-150 hover:text-accent-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            {action.label}
            <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-150 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </Link>
        )}
      </header>
      <div className="mt-5 flex-1">{children}</div>
    </section>
  )
}
