import type { SVGProps } from 'react'
import { motion } from 'framer-motion'
import { Canvas, IDLE_EASE, useIlluMotion } from './shared'

/**
 * Tema "comércio": loja, catálogo, pagamento, entrega, estoque, orçamento,
 * prazo. Ilustrações literais de operação de e-commerce/varejo.
 */

export function Loja(props: SVGProps<SVGSVGElement>) {
  const { reduced, container, item } = useIlluMotion()
  return (
    <Canvas title="Loja online" {...props}>
      <motion.g initial="hidden" animate="show" variants={container}>
        {/* Toldo listrado */}
        <motion.path
          variants={item}
          d="M24 16h72v8a6 6 0 0 1-12 0 6 6 0 0 1-12 0 6 6 0 0 1-12 0 6 6 0 0 1-12 0 6 6 0 0 1-12 0 6 6 0 0 1-12 0z"
          className="fill-accent/30 stroke-white/25"
          strokeWidth="1"
          strokeLinejoin="round"
          style={{ transformOrigin: '60px 16px' }}
          animate={reduced ? undefined : { rotate: [0, -1.5, 0, 1.5, 0] }}
          transition={reduced ? undefined : { duration: 4, repeat: Infinity, ease: IDLE_EASE }}
        />
        {/* Fachada */}
        <motion.rect
          variants={item}
          x="28"
          y="30"
          width="64"
          height="32"
          rx="2"
          className="fill-white/5 stroke-white/25"
          strokeWidth="1.5"
        />
        {/* Letreiro */}
        <motion.rect variants={item} x="46" y="24" width="28" height="7" rx="2" className="fill-accent/40 stroke-white/20" strokeWidth="1" />
        {/* Porta */}
        <motion.rect variants={item} x="36" y="42" width="13" height="20" rx="2" className="fill-accent/20 stroke-white/20" strokeWidth="1" />
        <motion.circle variants={item} cx="46" cy="52" r="1" className="fill-white/40" />
        {/* Vitrine */}
        <motion.rect variants={item} x="57" y="42" width="26" height="12" rx="2" className="fill-accent/10 stroke-white/20" strokeWidth="1" />
        <motion.circle
          variants={item}
          cx="64"
          cy="48"
          r="2.5"
          className="fill-accent-2/50"
          animate={reduced ? undefined : { opacity: [0.5, 1, 0.5] }}
          transition={reduced ? undefined : { duration: 2.6, repeat: Infinity, ease: IDLE_EASE }}
        />
        {/* Calçada */}
        <motion.line variants={item} x1="16" y1="64" x2="104" y2="64" className="stroke-white/15" strokeWidth="1.5" strokeLinecap="round" />
      </motion.g>
    </Canvas>
  )
}

export function Catalogo(props: SVGProps<SVGSVGElement>) {
  const { reduced, container, item } = useIlluMotion()
  const cols = [20, 47, 74]
  const rows = [14, 42]
  return (
    <Canvas title="Catálogo de produtos" {...props}>
      <motion.g initial="hidden" animate="show" variants={container}>
        {rows.map((y) =>
          cols.map((x) => {
            const destaque = x === 47 && y === 14
            return (
              <motion.g key={`${x}-${y}`} variants={item}>
                <rect
                  x={x}
                  y={y}
                  width="26"
                  height="22"
                  rx="3"
                  className={destaque ? 'fill-accent/20 stroke-accent/60' : 'fill-white/5 stroke-white/15'}
                  strokeWidth="1"
                />
                <motion.circle
                  cx={x + 13}
                  cy={y + 8}
                  r="4"
                  className={destaque ? 'fill-accent/50' : 'fill-white/15'}
                  animate={destaque && !reduced ? { scale: [1, 1.15, 1] } : undefined}
                  transition={destaque && !reduced ? { duration: 2.4, repeat: Infinity, ease: IDLE_EASE } : undefined}
                  style={{ transformOrigin: `${x + 13}px ${y + 8}px` }}
                />
                <rect x={x + 6} y={y + 16} width="14" height="2.5" rx="1.25" className="fill-white/10" />
              </motion.g>
            )
          })
        )}
      </motion.g>
    </Canvas>
  )
}

export function Pagamento(props: SVGProps<SVGSVGElement>) {
  const { reduced, container, item } = useIlluMotion()
  return (
    <Canvas title="Pagamento — maquininha aprovando cartão" {...props}>
      <motion.g initial="hidden" animate="show" variants={container}>
        {/* Maquininha */}
        <motion.rect variants={item} x="18" y="20" width="40" height="46" rx="6" className="fill-white/5 stroke-white/25" strokeWidth="1.5" />
        <motion.rect variants={item} x="24" y="26" width="28" height="16" rx="2" className="fill-accent/15 stroke-white/20" strokeWidth="1" />
        {/* Check de aprovado piscando na tela */}
        <motion.path
          variants={item}
          d="M30 34l4 4 8-8"
          className="stroke-accent/70"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          animate={reduced ? undefined : { opacity: [0.4, 1, 0.4] }}
          transition={reduced ? undefined : { duration: 2.2, repeat: Infinity, ease: IDLE_EASE }}
        />
        <motion.rect variants={item} x="24" y="46" width="10" height="4" rx="1.5" className="fill-white/15" />
        <motion.rect variants={item} x="24" y="53" width="18" height="4" rx="1.5" className="fill-white/10" />
        {/* Cartão entrando pela lateral */}
        <motion.g
          variants={item}
          animate={reduced ? undefined : { x: [8, 0, 8] }}
          transition={reduced ? undefined : { duration: 3.2, repeat: Infinity, ease: IDLE_EASE }}
        >
          <rect x="52" y="30" width="30" height="19" rx="3" className="fill-accent-2/30 stroke-accent-2/70" strokeWidth="1.5" />
          <rect x="52" y="35" width="30" height="4" className="fill-white/15" />
          <rect x="57" y="43" width="9" height="3" rx="1" className="fill-white/25" />
        </motion.g>
        {/* Selo de aprovado flutuando */}
        <motion.circle
          variants={item}
          cx="94"
          cy="24"
          r="9"
          className="fill-accent/20 stroke-accent/70"
          strokeWidth="1.5"
          animate={reduced ? undefined : { y: [0, -3, 0] }}
          transition={reduced ? undefined : { duration: 2.8, repeat: Infinity, ease: IDLE_EASE }}
        />
        <path d="M90 24l3 3 6-6" className="stroke-accent-2 pointer-events-none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </motion.g>
    </Canvas>
  )
}

export function Entrega(props: SVGProps<SVGSVGElement>) {
  const { reduced, container, item } = useIlluMotion()
  return (
    <Canvas title="Entrega — caminhão e rota" {...props}>
      <motion.g initial="hidden" animate="show" variants={container}>
        {/* Rota pontilhada percorrida */}
        <motion.path
          variants={item}
          d="M8 66q40-4 96 0"
          className="stroke-accent-2/50"
          strokeWidth="1.5"
          strokeDasharray="3 4"
          strokeLinecap="round"
          fill="none"
          animate={reduced ? undefined : { strokeDashoffset: [0, -14] }}
          transition={reduced ? undefined : { duration: 2.4, repeat: Infinity, ease: 'linear' }}
        />
        <motion.g
          variants={item}
          animate={reduced ? undefined : { y: [0, -1.4, 0] }}
          transition={reduced ? undefined : { duration: 2, repeat: Infinity, ease: IDLE_EASE }}
        >
          {/* Baú */}
          <rect x="18" y="28" width="46" height="24" rx="3" className="fill-accent/15 stroke-white/25" strokeWidth="1.5" />
          <rect x="32" y="34" width="13" height="13" rx="2" className="fill-accent/40" />
          <line x1="38.5" y1="34" x2="38.5" y2="47" className="stroke-white/25" strokeWidth="1" />
          {/* Cabine */}
          <path d="M64 34h12l9 10v8H64z" className="fill-white/5 stroke-white/25" strokeWidth="1.5" strokeLinejoin="round" />
          <rect x="70" y="38" width="8" height="6" rx="1" className="fill-accent-2/30" />
          {/* Rodas */}
          <circle cx="32" cy="55" r="6" className="fill-bg stroke-white/30" strokeWidth="2" />
          <circle cx="78" cy="55" r="6" className="fill-bg stroke-white/30" strokeWidth="2" />
          <circle cx="32" cy="55" r="1.8" className="fill-white/20" />
          <circle cx="78" cy="55" r="1.8" className="fill-white/20" />
        </motion.g>
        {/* Linhas de movimento */}
        <motion.g
          variants={item}
          animate={reduced ? undefined : { opacity: [0.2, 0.7, 0.2], x: [2, -2, 2] }}
          transition={reduced ? undefined : { duration: 1.6, repeat: Infinity, ease: IDLE_EASE }}
        >
          <line x1="4" y1="34" x2="12" y2="34" className="stroke-accent/50" strokeWidth="2" strokeLinecap="round" />
          <line x1="2" y1="42" x2="10" y2="42" className="stroke-accent/50" strokeWidth="2" strokeLinecap="round" />
          <line x1="4" y1="50" x2="12" y2="50" className="stroke-accent/50" strokeWidth="2" strokeLinecap="round" />
        </motion.g>
      </motion.g>
    </Canvas>
  )
}

export function Estoque(props: SVGProps<SVGSVGElement>) {
  const { reduced, container, item } = useIlluMotion()
  const shelves = [20, 38, 56]
  return (
    <Canvas title="Estoque — prateleiras com caixas" {...props}>
      <motion.g initial="hidden" animate="show" variants={container}>
        {/* Estrutura das prateleiras */}
        <motion.rect variants={item} x="14" y="14" width="92" height="54" rx="3" className="stroke-white/20" strokeWidth="1.5" />
        {shelves.map((y) => (
          <motion.line key={y} variants={item} x1="14" y1={y} x2="106" y2={y} className="stroke-white/15" strokeWidth="1.2" />
        ))}
        {/* Caixas */}
        <motion.rect variants={item} x="20" y="22" width="16" height="12" rx="1.5" className="fill-accent/35 stroke-white/20" strokeWidth="1" />
        <motion.rect variants={item} x="40" y="20" width="18" height="14" rx="1.5" className="fill-white/10 stroke-white/20" strokeWidth="1" />
        <motion.rect
          variants={item}
          x="66"
          y="21"
          width="14"
          height="13"
          rx="1.5"
          className="fill-accent-2/35 stroke-white/20"
          strokeWidth="1"
          animate={reduced ? undefined : { y: [21, 19, 21] }}
          transition={reduced ? undefined : { duration: 3, repeat: Infinity, ease: IDLE_EASE }}
        />
        <motion.rect variants={item} x="24" y="40" width="20" height="14" rx="1.5" className="fill-white/10 stroke-white/20" strokeWidth="1" />
        <motion.rect variants={item} x="52" y="41" width="16" height="13" rx="1.5" className="fill-accent/25 stroke-white/20" strokeWidth="1" />
        <motion.rect variants={item} x="76" y="40" width="18" height="14" rx="1.5" className="fill-white/10 stroke-white/20" strokeWidth="1" />
        <motion.rect variants={item} x="20" y="58" width="18" height="10" rx="1.5" className="fill-accent/30 stroke-white/20" strokeWidth="1" />
        <motion.rect
          variants={item}
          x="60"
          y="58"
          width="16"
          height="10"
          rx="1.5"
          className="fill-accent-2/30 stroke-white/20"
          strokeWidth="1"
          animate={reduced ? undefined : { opacity: [1, 0.55, 1] }}
          transition={reduced ? undefined : { duration: 2.8, repeat: Infinity, ease: IDLE_EASE }}
        />
      </motion.g>
    </Canvas>
  )
}

export function Orcamento(props: SVGProps<SVGSVGElement>) {
  const { reduced, container, item } = useIlluMotion()
  return (
    <Canvas title="Orçamento — notas, moedas e calculadora" {...props}>
      <motion.g initial="hidden" animate="show" variants={container}>
        {/* Calculadora */}
        <motion.rect variants={item} x="18" y="14" width="38" height="52" rx="5" className="fill-white/5 stroke-white/25" strokeWidth="1.5" />
        <motion.rect variants={item} x="24" y="20" width="26" height="10" rx="2" className="fill-accent/15 stroke-white/20" strokeWidth="1" />
        {[0, 1, 2].map((row) =>
          [0, 1, 2].map((col) => (
            <motion.rect
              key={`${row}-${col}`}
              variants={item}
              x={24 + col * 9.5}
              y={36 + row * 8.5}
              width="7"
              height="6"
              rx="1.5"
              className="fill-white/10"
            />
          ))
        )}
        {/* Nota */}
        <motion.rect
          variants={item}
          x="62"
          y="16"
          width="40"
          height="24"
          rx="3"
          className="fill-accent/20 stroke-accent/60"
          strokeWidth="1.5"
          style={{ transformOrigin: '82px 28px' }}
          animate={reduced ? undefined : { rotate: [-3, 3, -3] }}
          transition={reduced ? undefined : { duration: 4, repeat: Infinity, ease: IDLE_EASE }}
        />
        <circle cx="82" cy="28" r="6" className="stroke-accent/50 pointer-events-none" strokeWidth="1.2" />
        {/* Moedas empilhadas flutuando */}
        <motion.g
          variants={item}
          animate={reduced ? undefined : { y: [0, -2.5, 0] }}
          transition={reduced ? undefined : { duration: 2.6, repeat: Infinity, ease: IDLE_EASE }}
        >
          <ellipse cx="86" cy="56" rx="14" ry="5" className="fill-accent-2/30 stroke-accent-2/60" strokeWidth="1.2" />
          <ellipse cx="86" cy="51" rx="14" ry="5" className="fill-accent-2/40 stroke-accent-2/60" strokeWidth="1.2" />
          <ellipse cx="86" cy="46" rx="14" ry="5" className="fill-accent-2/50 stroke-accent-2/70" strokeWidth="1.2" />
        </motion.g>
      </motion.g>
    </Canvas>
  )
}

export function Prazo(props: SVGProps<SVGSVGElement>) {
  const { reduced, container, item } = useIlluMotion()
  return (
    <Canvas title="Prazo — calendário e relógio" {...props}>
      <motion.g initial="hidden" animate="show" variants={container}>
        {/* Calendário */}
        <motion.rect variants={item} x="14" y="16" width="60" height="52" rx="6" className="fill-white/5 stroke-white/25" strokeWidth="1.5" />
        <motion.path variants={item} d="M14 28v-4a6 6 0 0 1 6-6h48a6 6 0 0 1 6 6v4z" className="fill-accent/25" />
        <motion.line variants={item} x1="26" y1="11" x2="26" y2="20" className="stroke-white/40" strokeWidth="2.5" strokeLinecap="round" />
        <motion.line variants={item} x1="62" y1="11" x2="62" y2="20" className="stroke-white/40" strokeWidth="2.5" strokeLinecap="round" />
        {[36, 44, 52, 60].map((y) =>
          [24, 34, 44, 54, 64].map((x) => {
            const isCircled = x === 44 && y === 44
            if (isCircled) return null
            return <circle key={`${x}-${y}`} cx={x} cy={y} r="1.6" className="fill-white/20" />
          })
        )}
        {/* Dia circulado piscando */}
        <motion.circle
          variants={item}
          cx="44"
          cy="44"
          r="5.5"
          className="fill-transparent stroke-accent"
          strokeWidth="2"
          animate={reduced ? undefined : { scale: [1, 1.18, 1], opacity: [1, 0.65, 1] }}
          transition={reduced ? undefined : { duration: 2.2, repeat: Infinity, ease: IDLE_EASE }}
          style={{ transformOrigin: '44px 44px' }}
        />
        {/* Relógio sobreposto */}
        <motion.circle variants={item} cx="94" cy="54" r="16" className="fill-surface-2 stroke-accent-2/60" strokeWidth="2" />
        <motion.line
          variants={item}
          x1="94"
          y1="54"
          x2="94"
          y2="44"
          className="stroke-white/60"
          strokeWidth="2"
          strokeLinecap="round"
          style={{ transformOrigin: '94px 54px' }}
          animate={reduced ? undefined : { rotate: 360 }}
          transition={reduced ? undefined : { duration: 8, repeat: Infinity, ease: 'linear' }}
        />
        <motion.line
          variants={item}
          x1="94"
          y1="54"
          x2="101"
          y2="54"
          className="stroke-white/40"
          strokeWidth="2"
          strokeLinecap="round"
          style={{ transformOrigin: '94px 54px' }}
          animate={reduced ? undefined : { rotate: 360 }}
          transition={reduced ? undefined : { duration: 48, repeat: Infinity, ease: 'linear' }}
        />
      </motion.g>
    </Canvas>
  )
}
