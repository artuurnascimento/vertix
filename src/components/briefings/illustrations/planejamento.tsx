import type { SVGProps } from 'react'
import { motion } from 'framer-motion'
import { Canvas, IDLE_EASE, useIlluMotion } from './shared'

/**
 * Tema "planejamento": agendamento, metas, público-alvo, concorrentes.
 * Estratégia e descoberta antes/durante o projeto.
 */

export function Agendamento(props: SVGProps<SVGSVGElement>) {
  const { reduced, container, item } = useIlluMotion()
  const cols = [42, 56, 70, 84]
  const rows = [38, 47, 56]
  return (
    <Canvas title="Agendamento" {...props}>
      <motion.g initial="hidden" animate="show" variants={container}>
        <motion.rect variants={item} x="28" y="18" width="64" height="48" rx="6" className="fill-white/5 stroke-white/25" strokeWidth="1.5" />
        <motion.path variants={item} d="M28 30v-6a6 6 0 0 1 6-6h52a6 6 0 0 1 6 6v6z" className="fill-accent/25" />
        <motion.line variants={item} x1="42" y1="13" x2="42" y2="22" className="stroke-white/40" strokeWidth="2.5" strokeLinecap="round" />
        <motion.line variants={item} x1="78" y1="13" x2="78" y2="22" className="stroke-white/40" strokeWidth="2.5" strokeLinecap="round" />
        {rows.map((y) =>
          cols.map((x) => {
            if (x === 70 && y === 47) return null
            return <circle key={`${x}-${y}`} cx={x} cy={y} r="1.8" className="fill-white/20" />
          })
        )}
        {/* Data destacada pulsando */}
        <motion.circle
          variants={item}
          cx="70"
          cy="47"
          r="5.5"
          className="fill-accent/50"
          animate={reduced ? undefined : { scale: [1, 1.15, 1] }}
          transition={reduced ? undefined : { duration: 2.2, repeat: Infinity, ease: IDLE_EASE }}
          style={{ transformOrigin: '70px 47px' }}
        />
      </motion.g>
    </Canvas>
  )
}

export function Metas(props: SVGProps<SVGSVGElement>) {
  const { reduced, container, item } = useIlluMotion()
  return (
    <Canvas title="Metas — crescimento e alvo" {...props}>
      <motion.g initial="hidden" animate="show" variants={container}>
        <motion.line variants={item} x1="16" y1="66" x2="104" y2="66" className="stroke-white/15" strokeWidth="1.5" strokeLinecap="round" />
        <motion.rect variants={item} x="24" y="54" width="11" height="12" rx="2" className="fill-accent/15" />
        <motion.rect variants={item} x="40" y="46" width="11" height="20" rx="2" className="fill-accent/25" />
        <motion.rect
          variants={item}
          x="56"
          y="36"
          width="11"
          height="30"
          rx="2"
          className="fill-accent/40"
          animate={reduced ? undefined : { scaleY: [1, 1.06, 1] }}
          transition={reduced ? undefined : { duration: 2.6, repeat: Infinity, ease: IDLE_EASE }}
          style={{ transformOrigin: '61.5px 66px' }}
        />
        <motion.path
          variants={item}
          d="M26 50 46 42 62 32 84 24"
          className="stroke-accent-2/70"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        {/* Alvo com seta chegando */}
        <motion.circle variants={item} cx="88" cy="22" r="7.5" className="stroke-accent-2/60" strokeWidth="1.5" />
        <motion.circle
          variants={item}
          cx="88"
          cy="22"
          r="2.8"
          className="fill-accent-2/70"
          animate={reduced ? undefined : { scale: [1, 1.3, 1], opacity: [1, 0.6, 1] }}
          transition={reduced ? undefined : { duration: 2, repeat: Infinity, ease: IDLE_EASE }}
          style={{ transformOrigin: '88px 22px' }}
        />
      </motion.g>
    </Canvas>
  )
}

export function PublicoAlvo(props: SVGProps<SVGSVGElement>) {
  const { reduced, container, item } = useIlluMotion()
  return (
    <Canvas title="Público-alvo — grupo e alvo" {...props}>
      <motion.g initial="hidden" animate="show" variants={container}>
        {/* Grupo de pessoas */}
        <motion.g variants={item}>
          <circle cx="26" cy="34" r="5.5" className="fill-white/10 stroke-white/20" strokeWidth="1" />
          <path d="M16 54a10 10 0 0 1 20 0" className="fill-white/5 stroke-white/20" strokeWidth="1" />
        </motion.g>
        <motion.g
          variants={item}
          animate={reduced ? undefined : { scale: [1, 1.05, 1] }}
          transition={reduced ? undefined : { duration: 2.6, repeat: Infinity, ease: IDLE_EASE }}
          style={{ transformOrigin: '42px 40px' }}
        >
          <circle cx="42" cy="30" r="7" className="fill-accent/30 stroke-white/25" strokeWidth="1.3" />
          <path d="M29 54a13 13 0 0 1 26 0" className="fill-accent/20 stroke-white/25" strokeWidth="1.3" />
        </motion.g>
        <motion.g variants={item}>
          <circle cx="58" cy="34" r="5.5" className="fill-white/10 stroke-white/20" strokeWidth="1" />
          <path d="M48 54a10 10 0 0 1 20 0" className="fill-white/5 stroke-white/20" strokeWidth="1" />
        </motion.g>
        {/* Alvo com seta apontando para o grupo */}
        <motion.circle variants={item} cx="92" cy="34" r="16" className="stroke-accent-2/40" strokeWidth="1.3" />
        <motion.circle variants={item} cx="92" cy="34" r="10" className="stroke-accent-2/55" strokeWidth="1.3" />
        <motion.circle
          variants={item}
          cx="92"
          cy="34"
          r="4"
          className="fill-accent-2/70"
          animate={reduced ? undefined : { scale: [1, 1.2, 1] }}
          transition={reduced ? undefined : { duration: 2.2, repeat: Infinity, ease: IDLE_EASE }}
          style={{ transformOrigin: '92px 34px' }}
        />
        <motion.path
          variants={item}
          d="M68 46L88 36"
          className="stroke-accent/70"
          strokeWidth="2"
          strokeLinecap="round"
          animate={reduced ? undefined : { x: [-2, 0, -2] }}
          transition={reduced ? undefined : { duration: 2.4, repeat: Infinity, ease: IDLE_EASE }}
        />
        <path d="M88 36l-6-1 2-6z" className="fill-accent/70 pointer-events-none" />
      </motion.g>
    </Canvas>
  )
}

export function Concorrentes(props: SVGProps<SVGSVGElement>) {
  const { reduced, container, item } = useIlluMotion()
  return (
    <Canvas title="Concorrentes — comparativo de mercado" {...props}>
      <motion.g initial="hidden" animate="show" variants={container}>
        {/* Duas lupas comparando */}
        <motion.g variants={item}>
          <circle cx="38" cy="32" r="14" className="fill-accent/10 stroke-accent/60" strokeWidth="1.8" />
          <line x1="48" y1="42" x2="56" y2="50" className="stroke-accent/60" strokeWidth="3" strokeLinecap="round" />
        </motion.g>
        <motion.g
          variants={item}
          animate={reduced ? undefined : { scale: [1, 1.08, 1] }}
          transition={reduced ? undefined : { duration: 2.6, repeat: Infinity, ease: IDLE_EASE }}
          style={{ transformOrigin: '82px 48px' }}
        >
          <circle cx="82" cy="48" r="14" className="fill-accent-2/10 stroke-accent-2/60" strokeWidth="1.8" />
          <line x1="72" y1="58" x2="64" y2="66" className="stroke-accent-2/60" strokeWidth="3" strokeLinecap="round" />
        </motion.g>
        {/* Barras de comparação atrás */}
        <motion.rect variants={item} x="32" y="24" width="12" height="4" rx="2" className="fill-white/20" />
        <motion.rect variants={item} x="76" y="41" width="12" height="4" rx="2" className="fill-white/20" />
        {/* Selo de "vs" — losango neutro sem texto */}
        <motion.path
          variants={item}
          d="M60 10l6 6-6 6-6-6z"
          className="fill-accent-2/40 stroke-accent-2/70"
          strokeWidth="1"
          animate={reduced ? undefined : { rotate: [0, 8, 0, -8, 0] }}
          transition={reduced ? undefined : { duration: 4, repeat: Infinity, ease: IDLE_EASE }}
          style={{ transformOrigin: '60px 16px' }}
        />
      </motion.g>
    </Canvas>
  )
}
