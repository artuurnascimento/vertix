import type { SVGProps } from 'react'
import { motion } from 'framer-motion'
import { Canvas, IDLE_EASE, useIlluMotion } from './shared'

/**
 * Tema "site": páginas do site, conteúdo, domínio, redes sociais, mobile.
 * Presença digital fora do fluxo de compra em si.
 */

export function SitePaginas(props: SVGProps<SVGSVGElement>) {
  const { reduced, container, item } = useIlluMotion()
  return (
    <Canvas title="Páginas do site" {...props}>
      <motion.g initial="hidden" animate="show" variants={container}>
        {/* Páginas empilhadas atrás */}
        <motion.rect variants={item} x="30" y="10" width="76" height="48" rx="5" className="fill-white/5 stroke-white/10" strokeWidth="1" />
        <motion.rect variants={item} x="22" y="16" width="76" height="48" rx="5" className="fill-surface-2 stroke-white/15" strokeWidth="1" />
        {/* Janela do navegador */}
        <motion.rect variants={item} x="14" y="22" width="76" height="48" rx="5" className="fill-surface-2 stroke-white/25" strokeWidth="1.5" />
        <motion.line variants={item} x1="14" y1="32" x2="90" y2="32" className="stroke-white/15" strokeWidth="1" />
        <motion.circle
          variants={item}
          cx="21"
          cy="27"
          r="1.8"
          className="fill-accent/60"
          animate={reduced ? undefined : { opacity: [0.5, 1, 0.5] }}
          transition={reduced ? undefined : { duration: 2.4, repeat: Infinity, ease: IDLE_EASE }}
        />
        <motion.circle variants={item} cx="27" cy="27" r="1.8" className="fill-white/20" />
        <motion.circle variants={item} cx="33" cy="27" r="1.8" className="fill-white/20" />
        {/* Conteúdo */}
        <motion.rect variants={item} x="22" y="38" width="28" height="3" rx="1.5" className="fill-white/20" />
        <motion.rect variants={item} x="22" y="45" width="44" height="2.5" rx="1.25" className="fill-white/10" />
        <motion.rect variants={item} x="22" y="51" width="36" height="2.5" rx="1.25" className="fill-white/10" />
        <motion.rect
          variants={item}
          x="22"
          y="58"
          width="14"
          height="5"
          rx="2"
          className="fill-accent/30"
          animate={reduced ? undefined : { opacity: [0.7, 1, 0.7] }}
          transition={reduced ? undefined : { duration: 2.8, repeat: Infinity, ease: IDLE_EASE }}
        />
      </motion.g>
    </Canvas>
  )
}

export function Conteudo(props: SVGProps<SVGSVGElement>) {
  const { reduced, container, item } = useIlluMotion()
  return (
    <Canvas title="Conteúdo — texto e foto" {...props}>
      <motion.g initial="hidden" animate="show" variants={container}>
        {/* Documento */}
        <motion.rect variants={item} x="22" y="12" width="44" height="56" rx="4" className="fill-white/5 stroke-white/25" strokeWidth="1.5" />
        <motion.rect variants={item} x="28" y="20" width="32" height="2.5" rx="1.25" className="fill-white/15" />
        <motion.rect variants={item} x="28" y="26" width="26" height="2.5" rx="1.25" className="fill-white/15" />
        <motion.rect variants={item} x="28" y="32" width="20" height="2.5" rx="1.25" className="fill-white/10" />
        {/* Cartão de foto sobreposto, respirando levemente */}
        <motion.g
          variants={item}
          animate={reduced ? undefined : { y: [0, -2, 0] }}
          transition={reduced ? undefined : { duration: 3, repeat: Infinity, ease: IDLE_EASE }}
        >
          <rect x="56" y="30" width="42" height="32" rx="4" className="fill-surface-2 stroke-accent/50" strokeWidth="1.5" />
          <circle cx="66" cy="39" r="3" className="fill-accent-2/60" />
          <path d="M58 56l10-10 7 7 6-6 9 9v2a2 2 0 0 1-2 2H60a2 2 0 0 1-2-2z" className="fill-accent/30" />
        </motion.g>
      </motion.g>
    </Canvas>
  )
}

export function Dominio(props: SVGProps<SVGSVGElement>) {
  const { reduced, container, item } = useIlluMotion()
  return (
    <Canvas title="Domínio — barra de navegador" {...props}>
      <motion.g initial="hidden" animate="show" variants={container}>
        <motion.rect variants={item} x="14" y="22" width="92" height="40" rx="6" className="fill-surface-2 stroke-white/25" strokeWidth="1.5" />
        <motion.line variants={item} x1="14" y1="34" x2="106" y2="34" className="stroke-white/15" strokeWidth="1" />
        <motion.circle variants={item} cx="21" cy="28" r="1.6" className="fill-accent/50" />
        <motion.circle variants={item} cx="27" cy="28" r="1.6" className="fill-white/20" />
        {/* Cadeado https */}
        <motion.g variants={item}>
          <rect x="34" y="26" width="6" height="5" rx="1.2" className="fill-transparent stroke-white/40" strokeWidth="1" />
          <path d="M35.5 26v-2a2 2 0 0 1 4 0v2" className="stroke-white/40" strokeWidth="1" fill="none" />
        </motion.g>
        {/* Barra de endereço — retângulo "www" estilizado, sem texto */}
        <motion.rect variants={item} x="44" y="26" width="54" height="5" rx="2.5" className="fill-white/5" />
        <motion.g
          variants={item}
          animate={reduced ? undefined : { opacity: [0.4, 0.9, 0.4] }}
          transition={reduced ? undefined : { duration: 2.6, repeat: Infinity, ease: IDLE_EASE }}
        >
          <rect x="48" y="27.4" width="4" height="2.2" rx="1" className="fill-accent/70" />
          <rect x="54" y="27.4" width="4" height="2.2" rx="1" className="fill-accent/70" />
          <rect x="60" y="27.4" width="4" height="2.2" rx="1" className="fill-accent/70" />
        </motion.g>
        <motion.rect variants={item} x="68" y="27.4" width="22" height="2.2" rx="1.1" className="fill-white/20" />
        {/* Cursor piscando no fim da barra */}
        <motion.line
          variants={item}
          x1="92"
          y1="26.5"
          x2="92"
          y2="30.5"
          className="stroke-accent-2"
          strokeWidth="1.3"
          strokeLinecap="round"
          animate={reduced ? undefined : { opacity: [0, 1, 0] }}
          transition={reduced ? undefined : { duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.rect variants={item} x="20" y="42" width="80" height="14" rx="3" className="fill-accent/10 stroke-white/10" strokeWidth="1" />
      </motion.g>
    </Canvas>
  )
}

export function RedesSociais(props: SVGProps<SVGSVGElement>) {
  const { reduced, container, item } = useIlluMotion()
  return (
    <Canvas title="Redes sociais — celular com curtidas" {...props}>
      <motion.g initial="hidden" animate="show" variants={container}>
        {/* Celular */}
        <motion.rect variants={item} x="38" y="10" width="44" height="60" rx="7" className="fill-surface-2 stroke-white/25" strokeWidth="1.5" />
        <motion.rect variants={item} x="44" y="18" width="32" height="32" rx="3" className="fill-accent/10 stroke-white/15" strokeWidth="1" />
        <motion.rect variants={item} x="44" y="54" width="20" height="3" rx="1.5" className="fill-white/15" />
        <motion.rect variants={item} x="44" y="60" width="14" height="2.5" rx="1.25" className="fill-white/10" />
        {/* Coração de curtida pulsando */}
        <motion.path
          variants={item}
          d="M92 30c0-4-3-6-6-6-2 0-4 1-5 3-1-2-3-3-5-3-3 0-6 2-6 6 0 6 8 11 11 13 3-2 11-7 11-13z"
          className="fill-accent-2/70"
          animate={reduced ? undefined : { scale: [1, 1.22, 1] }}
          transition={reduced ? undefined : { duration: 1.6, repeat: Infinity, ease: IDLE_EASE }}
          style={{ transformOrigin: '86px 34px' }}
        />
        {/* Balão de comentário flutuando */}
        <motion.g
          variants={item}
          animate={reduced ? undefined : { y: [0, -3, 0] }}
          transition={reduced ? undefined : { duration: 2.8, repeat: Infinity, ease: IDLE_EASE }}
        >
          <path d="M12 44h18a4 4 0 0 1 4 4v6a4 4 0 0 1-4 4h-8l-4 4v-4h-6a4 4 0 0 1-4-4v-6a4 4 0 0 1 4-4z" className="fill-accent/20 stroke-accent/60" strokeWidth="1.2" />
        </motion.g>
      </motion.g>
    </Canvas>
  )
}

export function Mobile(props: SVGProps<SVGSVGElement>) {
  const { reduced, container, item } = useIlluMotion()
  return (
    <Canvas title="Mobile — smartphone com app" {...props}>
      <motion.g initial="hidden" animate="show" variants={container}>
        <motion.rect variants={item} x="40" y="8" width="40" height="64" rx="8" className="fill-surface-2 stroke-white/25" strokeWidth="1.5" />
        <motion.rect variants={item} x="46" y="16" width="28" height="42" rx="3" className="fill-accent/12 stroke-white/15" strokeWidth="1" />
        <motion.circle variants={item} cx="60" cy="64" r="3" className="stroke-white/25" strokeWidth="1.2" />
        {/* Ícones do app */}
        <motion.rect variants={item} x="50" y="21" width="8" height="8" rx="2" className="fill-accent/40" />
        <motion.rect variants={item} x="62" y="21" width="8" height="8" rx="2" className="fill-accent-2/40" />
        <motion.rect
          variants={item}
          x="50"
          y="33"
          width="8"
          height="8"
          rx="2"
          className="fill-white/15"
          animate={reduced ? undefined : { opacity: [0.5, 1, 0.5] }}
          transition={reduced ? undefined : { duration: 2.4, repeat: Infinity, ease: IDLE_EASE }}
        />
        <motion.rect variants={item} x="62" y="33" width="8" height="8" rx="2" className="fill-white/15" />
        {/* Notificação surgindo no topo */}
        <motion.g
          variants={item}
          animate={reduced ? undefined : { y: [-2, 2, -2], opacity: [0.7, 1, 0.7] }}
          transition={reduced ? undefined : { duration: 2.6, repeat: Infinity, ease: IDLE_EASE }}
        >
          <rect x="14" y="16" width="22" height="14" rx="4" className="fill-accent/25 stroke-accent/60" strokeWidth="1.2" />
          <circle cx="20" cy="23" r="2.4" className="fill-accent/70" />
          <rect x="25" y="21" width="9" height="2" rx="1" className="fill-white/30" />
          <rect x="25" y="25" width="6" height="1.6" rx="0.8" className="fill-white/15" />
        </motion.g>
      </motion.g>
    </Canvas>
  )
}
