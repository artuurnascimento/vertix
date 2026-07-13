import type { SVGProps } from 'react'
import { motion } from 'framer-motion'
import { Canvas, IDLE_EASE, useIlluMotion } from './shared'

/**
 * Tema "sistema": automação, usuários, integrações, recorrência,
 * relatórios, segurança, suporte. Backoffice e operação do produto.
 */

export function Automacao(props: SVGProps<SVGSVGElement>) {
  const { reduced, container, item } = useIlluMotion()
  return (
    <Canvas title="Automação — engrenagens" {...props}>
      <motion.g initial="hidden" animate="show" variants={container}>
        <motion.g
          variants={item}
          style={{ transformOrigin: '46px 40px' }}
          animate={reduced ? undefined : { rotate: 360 }}
          transition={reduced ? undefined : { duration: 9, repeat: Infinity, ease: 'linear' }}
        >
          <circle cx="46" cy="40" r="13" className="stroke-white/30" strokeWidth="5" strokeDasharray="5.1 5.11" />
        </motion.g>
        <circle cx="46" cy="40" r="9.5" className="stroke-white/25" strokeWidth="1.5" />
        <motion.circle
          variants={item}
          cx="46"
          cy="40"
          r="3.5"
          className="fill-accent/50"
          animate={reduced ? undefined : { opacity: [0.7, 1, 0.7] }}
          transition={reduced ? undefined : { duration: 2.4, repeat: Infinity, ease: IDLE_EASE }}
        />
        <motion.g
          variants={item}
          style={{ transformOrigin: '80px 54px' }}
          animate={reduced ? undefined : { rotate: -360 }}
          transition={reduced ? undefined : { duration: 6, repeat: Infinity, ease: 'linear' }}
        >
          <circle cx="80" cy="54" r="8" className="stroke-accent-2/60" strokeWidth="4" strokeDasharray="4.2 4.18" />
        </motion.g>
        <circle cx="80" cy="54" r="2.5" className="fill-accent-2/50" />
        <motion.path
          variants={item}
          d="M60 22q20-8 36 10"
          className="stroke-accent/50"
          strokeWidth="1.5"
          strokeDasharray="3 4"
          strokeLinecap="round"
          fill="none"
          animate={reduced ? undefined : { strokeDashoffset: [0, -14] }}
          transition={reduced ? undefined : { duration: 2, repeat: Infinity, ease: 'linear' }}
        />
      </motion.g>
    </Canvas>
  )
}

export function Usuarios(props: SVGProps<SVGSVGElement>) {
  const { reduced, container, item } = useIlluMotion()
  return (
    <Canvas title="Usuários e permissões" {...props}>
      <motion.g initial="hidden" animate="show" variants={container}>
        <motion.g variants={item}>
          <circle cx="30" cy="38" r="6" className="fill-white/10 stroke-white/20" strokeWidth="1" />
          <path d="M19 60a11 11 0 0 1 22 0" className="fill-white/5 stroke-white/20" strokeWidth="1" />
        </motion.g>
        <motion.g variants={item}>
          <circle cx="90" cy="38" r="6" className="fill-white/10 stroke-white/20" strokeWidth="1" />
          <path d="M79 60a11 11 0 0 1 22 0" className="fill-white/5 stroke-white/20" strokeWidth="1" />
        </motion.g>
        {/* Avatar central em destaque, respirando */}
        <motion.g
          variants={item}
          animate={reduced ? undefined : { scale: [1, 1.05, 1] }}
          transition={reduced ? undefined : { duration: 2.8, repeat: Infinity, ease: IDLE_EASE }}
          style={{ transformOrigin: '60px 46px' }}
        >
          <circle cx="60" cy="32" r="9" className="fill-accent/30 stroke-white/25" strokeWidth="1.5" />
          <path d="M44 60a16 16 0 0 1 32 0" className="fill-accent/20 stroke-white/25" strokeWidth="1.5" />
        </motion.g>
      </motion.g>
    </Canvas>
  )
}

export function Integracoes(props: SVGProps<SVGSVGElement>) {
  const { reduced, container, item } = useIlluMotion()
  const satelites: Array<[number, number]> = [
    [22, 18],
    [98, 18],
    [22, 62],
    [98, 62],
  ]
  return (
    <Canvas title="Integrações — hub conectado" {...props}>
      <motion.g initial="hidden" animate="show" variants={container}>
        {satelites.map(([x, y], i) => (
          <motion.g key={`${x}-${y}`} variants={item}>
            <line x1="60" y1="40" x2={x} y2={y} className="stroke-white/15" strokeWidth="1" />
            <motion.circle
              cx={(60 + x) / 2}
              cy={(40 + y) / 2}
              r="1.6"
              className="fill-accent-2/60"
              animate={reduced ? undefined : { opacity: [0.3, 1, 0.3] }}
              transition={reduced ? undefined : { duration: 2.2, repeat: Infinity, ease: IDLE_EASE, delay: i * 0.3 }}
            />
          </motion.g>
        ))}
        <motion.rect
          variants={item}
          x="51"
          y="31"
          width="18"
          height="18"
          rx="5"
          className="fill-accent/40 stroke-white/25"
          strokeWidth="1.5"
          animate={reduced ? undefined : { scale: [1, 1.08, 1] }}
          transition={reduced ? undefined : { duration: 2.6, repeat: Infinity, ease: IDLE_EASE }}
          style={{ transformOrigin: '60px 40px' }}
        />
        {satelites.map(([x, y]) => (
          <motion.circle
            key={`n-${x}-${y}`}
            variants={item}
            cx={x}
            cy={y}
            r="5.5"
            className="fill-surface-2 stroke-accent-2/60"
            strokeWidth="1.5"
          />
        ))}
      </motion.g>
    </Canvas>
  )
}

export function Recorrencia(props: SVGProps<SVGSVGElement>) {
  const { reduced, container, item } = useIlluMotion()
  return (
    <Canvas title="Recorrência — ciclo de assinatura" {...props}>
      <motion.g initial="hidden" animate="show" variants={container}>
        {/* Setas em ciclo girando devagar */}
        <motion.g
          variants={item}
          style={{ transformOrigin: '48px 40px' }}
          animate={reduced ? undefined : { rotate: 360 }}
          transition={reduced ? undefined : { duration: 7, repeat: Infinity, ease: 'linear' }}
        >
          <path
            d="M48 26a14 14 0 1 1-11.5 6"
            className="stroke-accent/60"
            strokeWidth="2.5"
            strokeLinecap="round"
            fill="none"
          />
          <path d="M31 26l6 2-1 6z" className="fill-accent/60" />
        </motion.g>
        {/* Calendário à direita */}
        <motion.rect variants={item} x="72" y="20" width="34" height="34" rx="5" className="fill-white/5 stroke-white/25" strokeWidth="1.5" />
        <motion.path variants={item} d="M72 30v-2a6 6 0 0 1 6-6h22a6 6 0 0 1 6 6v2z" className="fill-accent-2/25" />
        <motion.circle
          variants={item}
          cx="89"
          cy="40"
          r="4.5"
          className="fill-accent-2/50"
          animate={reduced ? undefined : { opacity: [0.5, 1, 0.5] }}
          transition={reduced ? undefined : { duration: 2.4, repeat: Infinity, ease: IDLE_EASE }}
        />
        <motion.rect variants={item} x="18" y="58" width="30" height="3" rx="1.5" className="fill-white/10" />
      </motion.g>
    </Canvas>
  )
}

export function Relatorios(props: SVGProps<SVGSVGElement>) {
  const { reduced, container, item } = useIlluMotion()
  const bars = [
    { x: 24, h: 12 },
    { x: 40, h: 22 },
    { x: 56, h: 16 },
    { x: 72, h: 30 },
    { x: 88, h: 20 },
  ]
  return (
    <Canvas title="Relatórios — gráfico de barras e linha" {...props}>
      <motion.g initial="hidden" animate="show" variants={container}>
        <motion.line variants={item} x1="16" y1="66" x2="104" y2="66" className="stroke-white/15" strokeWidth="1.5" strokeLinecap="round" />
        {bars.map((bar, i) => (
          <motion.rect
            key={bar.x}
            variants={item}
            x={bar.x}
            width="10"
            rx="2"
            y={66 - bar.h}
            height={bar.h}
            className={i === 3 ? 'fill-accent/45' : 'fill-accent/20'}
            animate={reduced ? undefined : { scaleY: [1, 1.12, 1] }}
            transition={reduced ? undefined : { duration: 2.4, repeat: Infinity, ease: IDLE_EASE, delay: i * 0.15 }}
            style={{ transformOrigin: `${bar.x + 5}px 66px` }}
          />
        ))}
        {/* Linha de tendência subindo */}
        <motion.path
          variants={item}
          d="M22 50 40 40 56 44 72 22 90 28"
          className="stroke-accent-2/70"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          strokeDasharray="1 1"
          pathLength={1}
          animate={reduced ? undefined : { pathLength: [0, 1] }}
          transition={reduced ? undefined : { duration: 3, repeat: Infinity, ease: IDLE_EASE }}
        />
      </motion.g>
    </Canvas>
  )
}

export function Seguranca(props: SVGProps<SVGSVGElement>) {
  const { reduced, container, item } = useIlluMotion()
  return (
    <Canvas title="Segurança — escudo com cadeado" {...props}>
      <motion.g initial="hidden" animate="show" variants={container}>
        <motion.path
          variants={item}
          d="M60 12l30 10v20c0 16-13 26-30 30-17-4-30-14-30-30V22z"
          className="fill-accent/15 stroke-accent/60"
          strokeWidth="1.8"
          strokeLinejoin="round"
          animate={reduced ? undefined : { opacity: [0.85, 1, 0.85] }}
          transition={reduced ? undefined : { duration: 3, repeat: Infinity, ease: IDLE_EASE }}
        />
        {/* Cadeado */}
        <motion.g variants={item}>
          <rect x="50" y="40" width="20" height="16" rx="3" className="fill-surface-2 stroke-white/30" strokeWidth="1.5" />
          <path d="M53 40v-6a7 7 0 0 1 14 0v6" className="stroke-white/30" strokeWidth="2" fill="none" strokeLinecap="round" />
          <motion.circle
            cx="60"
            cy="47"
            r="2.2"
            className="fill-accent-2/70"
            animate={reduced ? undefined : { opacity: [0.5, 1, 0.5] }}
            transition={reduced ? undefined : { duration: 1.8, repeat: Infinity, ease: IDLE_EASE }}
          />
        </motion.g>
      </motion.g>
    </Canvas>
  )
}

export function Suporte(props: SVGProps<SVGSVGElement>) {
  const { reduced, container, item } = useIlluMotion()
  return (
    <Canvas title="Suporte — headset e chat" {...props}>
      <motion.g initial="hidden" animate="show" variants={container}>
        {/* Headset */}
        <motion.path variants={item} d="M32 44v-6a20 20 0 0 1 40 0v6" className="stroke-white/30" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        <motion.rect variants={item} x="26" y="42" width="10" height="16" rx="4" className="fill-accent/30 stroke-white/25" strokeWidth="1.2" />
        <motion.rect variants={item} x="68" y="42" width="10" height="16" rx="4" className="fill-accent/30 stroke-white/25" strokeWidth="1.2" />
        <motion.path variants={item} d="M36 58q4 6 12 6" className="stroke-white/25" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        {/* Balão de chat com pontinhos digitando */}
        <motion.g variants={item}>
          <path d="M70 16h30a6 6 0 0 1 6 6v10a6 6 0 0 1-6 6H82l-6 6v-6h-6a6 6 0 0 1-6-6V22a6 6 0 0 1 6-6z" className="fill-accent-2/20 stroke-accent-2/60" strokeWidth="1.3" />
          {[80, 88, 96].map((x, i) => (
            <motion.circle
              key={x}
              cx={x}
              cy="27"
              r="2"
              className="fill-accent-2/70"
              animate={reduced ? undefined : { opacity: [0.3, 1, 0.3] }}
              transition={reduced ? undefined : { duration: 1.4, repeat: Infinity, ease: IDLE_EASE, delay: i * 0.25 }}
            />
          ))}
        </motion.g>
      </motion.g>
    </Canvas>
  )
}
