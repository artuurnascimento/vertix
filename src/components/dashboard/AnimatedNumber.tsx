import { useEffect, useRef, useState } from 'react'
import { animate, useReducedMotion } from 'framer-motion'

interface AnimatedNumberProps {
  /** Valor final já formatado (ex.: "R$ 12.340,00" ou "8"). */
  value: number
  format: (value: number) => string
  durationS?: number
  className?: string
}

const DEFAULT_DURATION_S = 0.8

/** Conta de 0 até o valor final, formatando a cada frame — respeita reduced motion. */
export default function AnimatedNumber({
  value,
  format,
  durationS = DEFAULT_DURATION_S,
  className,
}: AnimatedNumberProps) {
  const prefersReducedMotion = useReducedMotion()
  const [display, setDisplay] = useState(prefersReducedMotion ? value : 0)
  const previousValue = useRef(prefersReducedMotion ? value : 0)

  useEffect(() => {
    if (prefersReducedMotion) {
      setDisplay(value)
      previousValue.current = value
      return
    }

    const controls = animate(previousValue.current, value, {
      duration: durationS,
      ease: 'easeOut',
      onUpdate: (latest) => setDisplay(latest),
      onComplete: () => {
        previousValue.current = value
      },
    })
    return () => controls.stop()
  }, [value, durationS, prefersReducedMotion])

  return <span className={className}>{format(display)}</span>
}
