import type { CSSProperties } from 'react'

/**
 * Feixe de luz girando na borda do elemento pai (o pai precisa de `relative`
 * e de um raio de canto próprio, que o feixe herda).
 *
 * Adaptado do snippet original, com uma troca importante de técnica: o
 * original anima uma variável de ângulo declarada com `@property`, que só
 * interpola em navegadores que suportam esse recurso — nos demais a borda
 * fica parada, sem erro nenhum. Aqui um bloco com degradê cônico gira por
 * `transform: rotate`, que funciona em qualquer navegador atual e ainda roda
 * no compositor, sem repintura.
 *
 * As cores também mudaram: pico quase branco virando violeta da marca, no
 * lugar do laranja e roxo genéricos, que sumiam contra o card escuro.
 */

interface BorderBeamProps {
  className?: string
  /** Segundos por volta completa. */
  duration?: number
  /** Adianta a animação, para cards vizinhos não girarem juntos. */
  delay?: number
  colorFrom?: string
  colorTo?: string
  borderWidth?: number
}

export default function BorderBeam({
  className = '',
  duration = 5,
  delay = 0,
  colorFrom = '#FFFFFF',
  colorTo = '#6C5BF2',
  borderWidth = 2,
}: BorderBeamProps) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit] ${className}`}
      style={
        {
          padding: `${borderWidth}px`,
          // Recorta o miolo: sobra só a moldura.
          mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
          maskComposite: 'exclude',
          WebkitMask:
            'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
          WebkitMaskComposite: 'xor',
        } as CSSProperties
      }
    >
      <div
        className="vx-beam-girando absolute left-1/2 top-1/2 aspect-square w-[220%]"
        style={
          {
            background: `conic-gradient(from 0deg, transparent 0deg, transparent 296deg, ${colorTo} 330deg, ${colorFrom} 350deg, ${colorTo} 356deg, transparent 360deg)`,
            animationDuration: `${duration}s`,
            animationDelay: `-${delay}s`,
          } as CSSProperties
        }
      />
    </div>
  )
}
