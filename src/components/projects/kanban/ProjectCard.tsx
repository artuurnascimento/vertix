import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDraggable } from '@dnd-kit/core'
import ProjectCardContent from './ProjectCardContent'
import type { ProjectWithClient } from './types'

/** Janela após o fim de um drag em que o click residual do browser é ignorado. */
const CLICK_SUPPRESS_MS = 200

interface ProjectCardProps {
  project: ProjectWithClient
}

/**
 * Card arrastável (useDraggable). O card original fica esmaecido durante o
 * drag — quem segue o ponteiro é o DragOverlay do board. Clique (sem arrasto)
 * navega para o detalhe do projeto.
 */
export default function ProjectCard({ project }: ProjectCardProps) {
  const navigate = useNavigate()
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: project.id,
  })

  // Guarda o instante em que o último drag terminou para suprimir o click
  // sintético que o browser dispara logo após soltar o card.
  const dragEndedAtRef = useRef(0)
  useEffect(() => {
    if (!isDragging) return
    return () => {
      dragEndedAtRef.current = Date.now()
    }
  }, [isDragging])

  const handleClick = () => {
    if (Date.now() - dragEndedAtRef.current < CLICK_SUPPRESS_MS) return
    navigate(`/admin/projetos/${project.id}`)
  }

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={handleClick}
      className={[
        'rounded-xl outline-none transition-opacity duration-150',
        'cursor-grab touch-none active:cursor-grabbing',
        'focus-visible:ring-2 focus-visible:ring-accent/60',
        isDragging ? 'opacity-30' : 'opacity-100',
      ].join(' ')}
    >
      <ProjectCardContent
        project={project}
        className="border-white/5 transition-colors duration-150 hover:border-white/10"
      />
    </div>
  )
}
