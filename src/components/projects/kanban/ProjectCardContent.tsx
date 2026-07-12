import { Clock3 } from 'lucide-react'
import { getTipoServicoMeta } from '../../../lib/format'
import { formatTimeInStage } from './stageTime'
import type { ProjectWithClient } from './types'

interface ProjectCardContentProps {
  project: ProjectWithClient
  /** Classes extras (borda/sombra) — difere entre o card no board e o DragOverlay. */
  className?: string
}

/** Corpo visual do card — puro, reutilizado pelo card arrastável e pelo DragOverlay. */
export default function ProjectCardContent({
  project,
  className = '',
}: ProjectCardContentProps) {
  const tipoMeta = getTipoServicoMeta(project.tipo_servico)
  const clientLine = project.clients
    ? [project.clients.nome, project.clients.empresa].filter(Boolean).join(' · ')
    : '—'

  return (
    <div className={`rounded-xl border bg-surface-2 p-3.5 ${className}`}>
      <p className="text-sm font-medium leading-snug text-ink">{project.nome}</p>
      <p className="mt-1 truncate text-xs font-light text-muted">{clientLine}</p>
      <div className="mt-3">
        <span
          className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium ${tipoMeta.badgeClass}`}
        >
          {tipoMeta.label}
        </span>
      </div>
      <p className="mt-2.5 flex items-center gap-1.5 text-[11px] font-light text-muted/70">
        <Clock3 aria-hidden className="h-3 w-3" />
        {formatTimeInStage(project.updated_at)}
      </p>
    </div>
  )
}
