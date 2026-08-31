import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../../lib/auth'

interface SplashScreenProps {
  /** Chamado quando o fade-out termina — o pai desmonta o splash. */
  onDone: () => void
}

/** Duração mínima em tela para a animação da marca completar. */
const MIN_VISIBLE_MS = 2400
const MIN_VISIBLE_REDUCED_MS = 1100
const FADE_OUT_MS = 600
/** Teto absoluto: mesmo se a sessão demorar, o splash nunca prende o app. */
const HARD_CAP_MS = 6000

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Onboarding de abertura da marca: as duas lâminas do símbolo se desenham
 * subindo ao vértice, a wordmark entra com o "I" em indigo e o overlay
 * some quando a sessão termina de carregar.
 */
export default function SplashScreen({ onDone }: SplashScreenProps) {
  const { loading } = useAuth()
  const [minElapsed, setMinElapsed] = useState(false)
  const [forceLeave, setForceLeave] = useState(false)
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    const minMs = prefersReducedMotion() ? MIN_VISIBLE_REDUCED_MS : MIN_VISIBLE_MS
    const minTimer = setTimeout(() => setMinElapsed(true), minMs)
    const capTimer = setTimeout(() => setForceLeave(true), HARD_CAP_MS)
    return () => {
      clearTimeout(minTimer)
      clearTimeout(capTimer)
    }
  }, [])

  useEffect(() => {
    if (leaving) return
    if (!forceLeave && (!minElapsed || loading)) return
    setLeaving(true)
  }, [minElapsed, loading, forceLeave, leaving])

  // Ref evita que uma identidade nova de onDone reinicie/cancele o timer do fade.
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  useEffect(() => {
    if (!leaving) return
    const timer = setTimeout(() => onDoneRef.current(), FADE_OUT_MS)
    return () => clearTimeout(timer)
  }, [leaving])

  return (
    <div
      className={`vx-splash${leaving ? ' vx-splash--leaving' : ''}`}
      role="status"
      aria-label="Carregando Vertix"
    >
      <div aria-hidden className="vx-splash-glow" />

      <div className="vx-splash-stage">
        <svg
          viewBox="0 0 132 162"
          className="vx-splash-mark"
          fill="none"
          aria-hidden="true"
          // Caps arredondados do traço excedem o viewBox — sem isso as pontas clipam.
          style={{ overflow: 'visible' }}
        >
          <path
            className="vx-splash-blade-a"
            d="M6 132 L66 14 L126 132"
            stroke="#6C5BF2"
            strokeWidth="26"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <path
            className="vx-splash-blade-b"
            d="M34 150 L66 88 L98 150"
            stroke="#F4F4F0"
            strokeWidth="20"
            strokeLinejoin="round"
            strokeLinecap="round"
            opacity="0.85"
          />
        </svg>

        <p className="vx-splash-word font-kanit">
          VERT<span className="vx-splash-word-i">I</span>X
        </p>

        <p className="vx-splash-tagline">e-commerce + sistemas sob medida</p>
      </div>
    </div>
  )
}
