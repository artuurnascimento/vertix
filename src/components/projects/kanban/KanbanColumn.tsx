import { motion } from 'framer-motion'
import { useDroppable } from '@dnd-kit/core'
import { getProjectStatusMeta } from '../../../lib/format'
import type { ProjectStatus } from '../../../lib/format'
import ProjectCard from './ProjectCard'
import type { ProjectWithClient } from './types'

const COLUMN_STAGGER_S = 0.06
const COLUMN_EASE = [0.25, 0.1, 0.25, 1] as const

interface KanbanColumnProps {
  status: ProjectStatus
  projects: ProjectWithClient[]
  index: number
}

/** Coluna fixa do board — droppable (id = status), sempre visível mesmo vazia. */
export default function KanbanColumn({
  status,
  projects,
  index,
}: KanbanColumnProps) {
  const meta = getProjectStatusMeta(status)
  const { setNodeRef, isOver } = useDroppable({ id: status })

  return (
    <motion.section
      ref={setNodeRef}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.3,
        delay: index * COLUMN_STAGGER_S,
        ease: COLUMN_EASE,
      }}
      aria-label={`Coluna ${meta.label}`}
      className={[
        'flex h-full w-[300px] shrink-0 flex-col rounded-2xl border transition-colors duration-150',
        isOver
          ? 'border-accent/30 bg-accent/5 ring-1 ring-accent/30'
          : 'border-white/5 bg-surface-1',
      ].join(' ')}
    >
      <header className="flex items-center gap-2.5 px-4 pb-3 pt-4">
        <span aria-hidden className={`h-2 w-2 rounded-full ${meta.dotClass}`} />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-ink/90">
          {meta.label}
        </h3>
        <span className="ml-auto text-xs font-light tabular-nums text-muted">
          {projects.length}
        </span>
      </header>

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-3 pb-3">
        {projects.length === 0 && (
          <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-white/5 py-8">
            <p className="text-xs font-light text-muted/50">Nenhum projeto</p>
          </div>
        )}
        {projects.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>
    </motion.section>
  )
}
