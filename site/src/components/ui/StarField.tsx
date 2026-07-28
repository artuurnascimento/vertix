import { useMemo } from 'react'

interface Star {
  x: number
  y: number
  size: number
  opacity: number
}

/** LCG determinístico — estrelas estáveis entre renders, sem mismatch. */
function makeStars(count: number, seedStart: number): Star[] {
  let seed = seedStart
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280
    return seed / 233280
  }
  return Array.from({ length: count }, () => ({
    x: rand() * 100,
    y: rand() * 100,
    size: rand() * 1.6 + 0.4,
    opacity: rand() * 0.5 + 0.12,
  }))
}

/** Poeira estelar tênue espalhada pelo fundo. */
export default function StarField() {
  const stars = useMemo(() => makeStars(70, 7), [])

  return (
    <div className="absolute inset-0">
      {stars.map((s, i) => (
        <span
          key={i}
          className="absolute rounded-full bg-white"
          style={{
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: s.size,
            height: s.size,
            opacity: s.opacity,
            boxShadow: `0 0 ${s.size * 2.5}px rgba(255,255,255,0.55)`,
          }}
        />
      ))}
    </div>
  )
}
