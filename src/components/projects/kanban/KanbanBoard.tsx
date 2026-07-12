import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type {
  CollisionDetection,
  DragEndEvent,
  DragStartEvent,
} from '@dnd-kit/core'
import { PROJECT_STATUS_ORDER } from '../../../lib/format'
import type { ProjectStatus } from '../../../lib/format'
import KanbanColumn from './KanbanColumn'
import ProjectCardContent from './ProjectCardContent'
import { useMoveProject } from './useMoveProject'
import type { ProjectWithClient } from './types'

/** Distância mínima (px) antes de iniciar o drag — preserva o click de navegação. */
const DRAG_ACTIVATION_DISTANCE_PX = 6
const ERROR_TOAST_MS = 5000

/** Ponteiro dentro da coluna primeiro; interseção de retângulos como fallback (teclado). */
const collisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args)
  return pointerCollisions.length > 0 ? pointerCollisions : rectIntersection(args)
}

interface KanbanBoardProps {
  projects: ProjectWithClient[]
}

export default function KanbanBoard({ projects }: KanbanBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const moveProject = useMoveProject()
  const { isError: isMoveError, reset: resetMove } = moveProject

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: DRAG_ACTIVATION_DISTANCE_PX },
    }),
    useSensor(KeyboardSensor)
  )

  const projectsByStatus = useMemo(() => {
    const groups = new Map<ProjectStatus, ProjectWithClient[]>(
      PROJECT_STATUS_ORDER.map((status) => [status, []])
    )
    for (const project of projects) {
      const status = PROJECT_STATUS_ORDER.find((s) => s === project.status)
      if (status) groups.get(status)?.push(project)
    }
    return groups
  }, [projects])

  const activeProject = useMemo(
    () =>
      activeId ? (projects.find((p) => p.id === activeId) ?? null) : null,
    [activeId, projects]
  )

  // Aviso de erro discreto que se dissolve sozinho.
  useEffect(() => {
    if (!isMoveError) return
    const timer = setTimeout(() => resetMove(), ERROR_TOAST_MS)
    return () => clearTimeout(timer)
  }, [isMoveError, resetMove])

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id))
  }

  const handleDragCancel = () => {
    setActiveId(null)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null)
    const { active, over } = event
    if (!over) return

    const project = projects.find((p) => p.id === active.id)
    if (!project) return

    const toStatus = PROJECT_STATUS_ORDER.find((s) => s === over.id)
    if (!toStatus || toStatus === project.status) return

    moveProject.mutate({ project, toStatus })
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="flex h-full items-stretch gap-4 overflow-x-auto pb-2">
        {PROJECT_STATUS_ORDER.map((status, index) => (
          <KanbanColumn
            key={status}
            status={status}
            index={index}
            projects={projectsByStatus.get(status) ?? []}
          />
        ))}
      </div>

      <DragOverlay dropAnimation={null}>
        {activeProject && (
          <ProjectCardContent
            project={activeProject}
            className="rotate-2 cursor-grabbing border-white/10 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.75)] ring-1 ring-accent/30"
          />
        )}
      </DragOverlay>

      <AnimatePresence>
        {isMoveError && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.2 }}
            role="alert"
            className="fixed bottom-6 right-6 z-50 rounded-lg border border-red-400/30 bg-surface-2 px-4 py-3 text-sm text-red-300 shadow-[0_12px_32px_-8px_rgba(0,0,0,0.6)]"
          >
            Não foi possível mover o projeto. A alteração foi desfeita.
          </motion.div>
        )}
      </AnimatePresence>
    </DndContext>
  )
}
