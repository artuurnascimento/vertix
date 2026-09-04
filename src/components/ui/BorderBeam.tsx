import { useEffect } from 'react'
import type { CSSProperties } from 'react'

/**
 * Feixe girando na borda do elemento pai (o pai precisa de `relative` e de um
 * raio de canto próprio, que o feixe herda).
 *
 * Adaptado do snippet original para este projeto: sem "use client" (Vite, não
 * Next), sem o utilitário `cn` e o alias `@/` (não existem aqui), e com o
 * violeta da marca no lugar do laranja e roxo genéricos.
 *
 * Depende de `@property --angle` para animar o ângulo do degradê. Onde não
 * houver suporte, a borda simplesmente não gira — o card continua correto.
 */

const BORDER_BEAM_STYLES = `
@property --angle {
  syntax: "<angle>";
  initial-value: 0deg;
  inherits: false;
}

@keyframes border-beam-spin {
  from {
    --angle: 0deg;
  }
  to {
    --angle: 360deg;
  }
}

@media (prefers-reduced-motion: reduce) {
  .vx-border-beam {
    animation: none !important;
  }
}
`

/** Injeta o bloco de CSS no documento uma única vez. */
function useGlobalStyles(css: string, id: string) {
  useEffect(() => {
    if (document.getElementById(id)) return
    const style = document.createElement('style')
    style.id = id
    style.textContent = css
    document.head.appendChild(style)
  }, [css, id])
}

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
  duration = 12,
  delay = 0,
  // Pico quase branco virando violeta, como a cabeça dos feixes do Scan:
  // violeta sobre violeta some no card escuro.
  colorFrom = '#FFFFFF',
  colorTo = '#6C5BF2',
  borderWidth = 2,
}: BorderBeamProps) {
  useGlobalStyles(BORDER_BEAM_STYLES, 'border-beam-styles')

  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 rounded-[inherit] ${className}`}
      style={
        {
          '--duration': `${duration}s`,
          '--delay': `-${delay}s`,
          '--color-from': colorFrom,
          '--color-to': colorTo,
          '--border-width': `${borderWidth}px`,
        } as CSSProperties
      }
    >
      <div
        className="vx-border-beam absolute inset-0 rounded-[inherit]"
        style={
          {
            padding: 'var(--border-width)',
            background: `linear-gradient(
              var(--angle, 0deg),
              transparent 0%,
              transparent 35%,
              var(--color-from) 50%,
              var(--color-to) 65%,
              transparent 80%,
              transparent 100%
            )`,
            mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
            maskComposite: 'exclude',
            WebkitMask:
              'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
            WebkitMaskComposite: 'xor',
            animation:
              'border-beam-spin var(--duration) linear infinite var(--delay)',
          } as CSSProperties
        }
      />
    </div>
  )
}
