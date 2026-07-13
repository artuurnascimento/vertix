import type { SVGProps } from 'react'
import { motion } from 'framer-motion'
import { Canvas, IDLE_EASE, useIlluMotion } from './shared'

/**
 * Tema "estilo": identidade visual e as três direções de layout
 * (minimalista, vibrante, premium/sofisticado).
 */

export function IdentidadeVisual(props: SVGProps<SVGSVGElement>) {
  const { reduced, container, item } = useIlluMotion()
  return (
    <Canvas title="Identidade visual — paleta e pincel" {...props}>
      <motion.g initial="hidden" animate="show" variants={container}>
        {/* Amostras de cor em leque */}
        <motion.g
          variants={item}
          style={{ transformOrigin: '34px 55px' }}
          animate={reduced ? undefined : { rotate: [-10, -13, -10] }}
          transition={reduced ? undefined : { duration: 3.4, repeat: Infinity, ease: IDLE_EASE }}
        >
          <rect x="24" y="24" width="20" height="30" rx="4" className="fill-accent/40" transform="rotate(-10 34 40)" />
        </motion.g>
        <motion.g variants={item}>
          <rect x="38" y="22" width="20" height="30" rx="4" className="fill-accent-2/40 stroke-white/10" strokeWidth="1" transform="rotate(2 48 40)" />
        </motion.g>
        <motion.g
          variants={item}
          style={{ transformOrigin: '62px 54px' }}
          animate={reduced ? undefined : { rotate: [14, 17, 14] }}
          transition={reduced ? undefined : { duration: 3.4, repeat: Infinity, ease: IDLE_EASE }}
        >
          <rect x="52" y="24" width="20" height="30" rx="4" className="fill-white/10 stroke-white/20" strokeWidth="1" transform="rotate(14 62 42)" />
        </motion.g>
        {/* Pincel pintando */}
        <motion.g
          variants={item}
          style={{ transformOrigin: '90px 44px' }}
          animate={reduced ? undefined : { rotate: [0, -6, 0] }}
          transition={reduced ? undefined : { duration: 2.4, repeat: Infinity, ease: IDLE_EASE }}
        >
          <line x1="80" y1="60" x2="100" y2="28" className="stroke-white/30" strokeWidth="3" strokeLinecap="round" />
          <path d="M98 20l7 6-9 5z" className="fill-accent-2/70" />
        </motion.g>
        {/* Respingo pulsando */}
        <motion.circle
          variants={item}
          cx="86"
          cy="66"
          r="2.5"
          className="fill-accent/50"
          animate={reduced ? undefined : { scale: [1, 1.3, 1], opacity: [0.9, 0.4, 0.9] }}
          transition={reduced ? undefined : { duration: 2, repeat: Infinity, ease: IDLE_EASE }}
          style={{ transformOrigin: '86px 66px' }}
        />
      </motion.g>
    </Canvas>
  )
}

export function EstiloMinimalista(props: SVGProps<SVGSVGElement>) {
  const { reduced, container, item } = useIlluMotion()
  return (
    <Canvas title="Layout minimalista" {...props}>
      <motion.g initial="hidden" animate="show" variants={container}>
        <motion.rect variants={item} x="16" y="12" width="88" height="56" rx="6" className="stroke-white/15" strokeWidth="1" />
        <motion.rect variants={item} x="26" y="24" width="34" height="4" rx="2" className="fill-white/30" />
        <motion.rect variants={item} x="26" y="32" width="22" height="2.5" rx="1.25" className="fill-white/10" />
        <motion.rect
          variants={item}
          x="26"
          y="52"
          width="18"
          height="7"
          rx="3.5"
          className="fill-accent/30 stroke-accent/40"
          strokeWidth="1"
          animate={reduced ? undefined : { opacity: [0.85, 1, 0.85] }}
          transition={reduced ? undefined : { duration: 3, repeat: Infinity, ease: IDLE_EASE }}
        />
        {/* Cursor sutil respirando ao lado do texto — reforça "clean" */}
        <motion.line
          variants={item}
          x1="64"
          y1="22"
          x2="64"
          y2="28"
          className="stroke-white/40"
          strokeWidth="1.5"
          strokeLinecap="round"
          animate={reduced ? undefined : { opacity: [0, 1, 0] }}
          transition={reduced ? undefined : { duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
        />
      </motion.g>
    </Canvas>
  )
}

export function EstiloVibrante(props: SVGProps<SVGSVGElement>) {
  const { reduced, container, item } = useIlluMotion()
  return (
    <Canvas title="Layout vibrante" {...props}>
      <motion.g initial="hidden" animate="show" variants={container}>
        <motion.rect
          variants={item}
          x="14"
          y="12"
          width="44"
          height="26"
          rx="5"
          className="fill-accent/40"
          animate={reduced ? undefined : { opacity: [1, 0.75, 1] }}
          transition={reduced ? undefined : { duration: 2.6, repeat: Infinity, ease: IDLE_EASE }}
        />
        <motion.rect variants={item} x="62" y="12" width="44" height="12" rx="4" className="fill-accent-2/50" />
        <motion.rect variants={item} x="62" y="28" width="20" height="10" rx="3" className="fill-accent/25" />
        <motion.rect
          variants={item}
          x="86"
          y="28"
          width="20"
          height="10"
          rx="3"
          className="fill-white/15"
          animate={reduced ? undefined : { scale: [1, 1.06, 1] }}
          transition={reduced ? undefined : { duration: 2.2, repeat: Infinity, ease: IDLE_EASE }}
          style={{ transformOrigin: '96px 33px' }}
        />
        <motion.rect variants={item} x="14" y="42" width="20" height="26" rx="4" className="fill-accent-2/30" />
        <motion.rect
          variants={item}
          x="38"
          y="42"
          width="44"
          height="26"
          rx="5"
          className="fill-accent/15 stroke-accent/50"
          strokeWidth="1"
          animate={reduced ? undefined : { opacity: [0.7, 1, 0.7] }}
          transition={reduced ? undefined : { duration: 2.8, repeat: Infinity, ease: IDLE_EASE }}
        />
        <motion.rect variants={item} x="86" y="42" width="20" height="26" rx="4" className="fill-accent/50" />
      </motion.g>
    </Canvas>
  )
}

export function EstiloPremium(props: SVGProps<SVGSVGElement>) {
  const { reduced, container, item } = useIlluMotion()
  return (
    <Canvas title="Layout escuro elegante" {...props}>
      <motion.g initial="hidden" animate="show" variants={container}>
        <motion.rect variants={item} x="14" y="10" width="92" height="60" rx="6" className="fill-black/50 stroke-white/25" strokeWidth="1" />
        <motion.rect variants={item} x="21" y="17" width="78" height="46" rx="3" className="stroke-white/15" strokeWidth="1" />
        <motion.path
          variants={item}
          d="M60 30l7 9-7 9-7-9z"
          className="fill-accent/25 stroke-accent/70"
          strokeWidth="1.2"
          strokeLinejoin="round"
          animate={reduced ? undefined : { rotate: 360 }}
          transition={reduced ? undefined : { duration: 10, repeat: Infinity, ease: 'linear' }}
          style={{ transformOrigin: '60px 39px' }}
        />
        <motion.circle
          variants={item}
          cx="44"
          cy="39"
          r="1.5"
          className="fill-accent-2/50"
          animate={reduced ? undefined : { opacity: [0.4, 1, 0.4] }}
          transition={reduced ? undefined : { duration: 2.4, repeat: Infinity, ease: IDLE_EASE, delay: 0.3 }}
        />
        <motion.circle
          variants={item}
          cx="76"
          cy="39"
          r="1.5"
          className="fill-accent-2/50"
          animate={reduced ? undefined : { opacity: [0.4, 1, 0.4] }}
          transition={reduced ? undefined : { duration: 2.4, repeat: Infinity, ease: IDLE_EASE, delay: 1 }}
        />
        <motion.rect variants={item} x="46" y="52" width="28" height="2" rx="1" className="fill-white/25" />
        <motion.rect variants={item} x="53" y="57" width="14" height="1.5" rx="0.75" className="fill-white/10" />
      </motion.g>
    </Canvas>
  )
}
