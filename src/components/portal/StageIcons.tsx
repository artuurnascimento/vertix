import type { ReactElement } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import type { ProjectStatus } from '../../lib/format'

/**
 * Ícones SVG ilustrativos das 6 etapas do projeto no portal do cliente.
 * A etapa atual anima em loop suave (framer-motion); concluídas e futuras
 * ficam estáticas. prefers-reduced-motion desliga tudo.
 */

export type StageState = 'done' | 'current' | 'upcoming'

interface IconProps {
  animado: boolean
}

const STROKE = 1.7

function IconeInicio({ animado }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round" aria-hidden className="h-5 w-5">
      <motion.g
        animate={animado ? { y: [0, -1.4, 0] } : undefined}
        transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
      >
        <path d="M12 3c2.6 1.7 4 4.4 4 7.4 0 1.9-.5 3.6-1.4 5.1H9.4A9.6 9.6 0 0 1 8 10.4C8 7.4 9.4 4.7 12 3Z" />
        <circle cx="12" cy="9.5" r="1.6" />
        <path d="M9.4 15.5 7.5 18M14.6 15.5l1.9 2.5" />
        <motion.path
          d="M12 15.5v3.2"
          className="text-amber-300"
          stroke="currentColor"
          animate={animado ? { opacity: [1, 0.25, 1], scaleY: [1, 0.6, 1] } : undefined}
          style={{ originY: 0.6 }}
          transition={{ duration: 0.8, repeat: Infinity, ease: 'easeInOut' }}
        />
      </motion.g>
    </svg>
  )
}

function IconeBriefing({ animado }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round" aria-hidden className="h-5 w-5">
      <rect x="6" y="4.5" width="12" height="16" rx="2" />
      <path d="M9.5 4.5V3.8A1.3 1.3 0 0 1 10.8 2.5h2.4a1.3 1.3 0 0 1 1.3 1.3v.7" />
      {[9.5, 12.5, 15.5].map((y, i) => (
        <motion.line
          key={y}
          x1="9"
          y1={y}
          x2={i === 2 ? 13 : 15}
          y2={y}
          animate={animado ? { opacity: [0.25, 1, 0.25] } : undefined}
          transition={{
            duration: 1.8,
            repeat: Infinity,
            delay: i * 0.35,
            ease: 'easeInOut',
          }}
        />
      ))}
    </svg>
  )
}

function IconePlanejamento({ animado }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round" aria-hidden className="h-5 w-5">
      <circle cx="5.5" cy="18.5" r="2" />
      <circle cx="18.5" cy="5.5" r="2" />
      <motion.path
        d="M7 17c4-1.5 5-2.5 5-5s1-3.5 5-5"
        strokeDasharray="2.6 2.6"
        animate={animado ? { strokeDashoffset: [0, -10.4] } : undefined}
        transition={{ duration: 1.6, repeat: Infinity, ease: 'linear' }}
      />
    </svg>
  )
}

function IconeDesenvolvimento({ animado }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round" aria-hidden className="h-5 w-5">
      <motion.g
        animate={animado ? { rotate: 360 } : undefined}
        transition={{ duration: 7, repeat: Infinity, ease: 'linear' }}
        style={{ originX: '50%', originY: '50%' }}
      >
        <circle cx="12" cy="12" r="3.2" />
        {[0, 45, 90, 135, 180, 225, 270, 315].map((angulo) => (
          <line
            key={angulo}
            x1="12"
            y1="4.2"
            x2="12"
            y2="6.4"
            transform={`rotate(${angulo} 12 12)`}
          />
        ))}
      </motion.g>
    </svg>
  )
}

function IconeRevisao({ animado }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round" aria-hidden className="h-5 w-5">
      <path d="M5 5h8M5 9h5M5 13h4" opacity={0.55} />
      <motion.g
        animate={animado ? { x: [0, 2.2, 0], y: [0, -2.2, 0] } : undefined}
        transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
      >
        <circle cx="13.5" cy="13.5" r="4.2" />
        <path d="m16.7 16.7 3.3 3.3" />
      </motion.g>
    </svg>
  )
}

function IconeEntrega({ animado }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round" aria-hidden className="h-5 w-5">
      <rect x="4.5" y="9" width="15" height="11" rx="1.5" />
      <path d="M4.5 12.5h15M12 9v11" />
      <path d="M12 9c-3.2 0-4.5-1.4-4.5-2.7C7.5 5 8.5 4.3 9.6 4.6 11 5 12 7 12 9Zm0 0c3.2 0 4.5-1.4 4.5-2.7 0-1.3-1-2-2.1-1.7C13 5 12 7 12 9Z" />
      <motion.path
        d="M20.5 5.5v2.4M19.3 6.7h2.4"
        className="text-amber-300"
        stroke="currentColor"
        animate={animado ? { scale: [0.6, 1.15, 0.6], opacity: [0.4, 1, 0.4] } : undefined}
        style={{ originX: '85%', originY: '28%' }}
        transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
      />
    </svg>
  )
}

const ICONES: Record<ProjectStatus, (props: IconProps) => ReactElement> = {
  lead: IconeInicio,
  briefing_enviado: IconeBriefing,
  briefing_recebido: IconePlanejamento,
  em_desenvolvimento: IconeDesenvolvimento,
  revisao: IconeRevisao,
  entregue: IconeEntrega,
}

const COR_POR_ESTADO: Record<StageState, string> = {
  done: 'text-accent/80',
  current: 'text-accent',
  upcoming: 'text-muted/70',
}

interface StageIconProps {
  stage: ProjectStatus
  state: StageState
}

export default function StageIcon({ stage, state }: StageIconProps) {
  const prefersReducedMotion = useReducedMotion()
  const Icone = ICONES[stage]
  const animado = state === 'current' && !prefersReducedMotion
  return (
    <span className={COR_POR_ESTADO[state]}>
      <Icone animado={animado} />
    </span>
  )
}
