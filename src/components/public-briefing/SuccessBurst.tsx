import { useMemo } from 'react'
import { motion } from 'framer-motion'

/**
 * Burst de partículas para a tela de sucesso pós-envio. Disparo único
 * (nenhum loop), ~18 partículas, só transform/opacity — sem custo de
 * layout. Com prefers-reduced-motion o pai nem monta este componente.
 */

const PARTICLE_COUNT = 18
const COLORS = ['#6C5BF2', '#8B7CF6', '#34d399', '#F4F4F0', '#5546E0']

interface Particle {
  id: number
  angle: number
  distance: number
  size: number
  color: string
  delay: number
  rotate: number
}

function buildParticles(): Particle[] {
  return Array.from({ length: PARTICLE_COUNT }, (_, i) => {
    const angle = (i / PARTICLE_COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.4
    return {
      id: i,
      angle,
      distance: 70 + Math.random() * 90,
      size: 5 + Math.random() * 6,
      color: COLORS[i % COLORS.length],
      delay: Math.random() * 0.08,
      rotate: (Math.random() - 0.5) * 360,
    }
  })
}

export default function SuccessBurst() {
  const particles = useMemo(buildParticles, [])

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute left-1/2 top-0 h-0 w-0"
    >
      {particles.map((p) => {
        const x = Math.cos(p.angle) * p.distance
        const y = Math.sin(p.angle) * p.distance
        return (
          <motion.span
            key={p.id}
            className="absolute rounded-sm"
            style={{
              width: p.size,
              height: p.size,
              backgroundColor: p.color,
              left: 0,
              top: 0,
            }}
            initial={{ opacity: 1, x: 0, y: 0, rotate: 0, scale: 0.6 }}
            animate={{
              opacity: 0,
              x,
              y: y - 40,
              rotate: p.rotate,
              scale: 1,
            }}
            transition={{
              duration: 0.9,
              delay: p.delay,
              ease: [0.16, 1, 0.3, 1],
            }}
          />
        )
      })}
    </div>
  )
}
