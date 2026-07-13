import type { ReactNode, SVGProps } from 'react'
import { useReducedMotion, type Variants } from 'framer-motion'

/**
 * Infraestrutura compartilhada do catálogo de ilustrações do briefing.
 *
 * Linguagem visual: fundo surface-2, traço fino branco (10–30%),
 * preenchimentos accent (10–40%) e detalhes em accent-2. Sem texto
 * renderizado — apenas <title> acessível (aria-hidden na raiz do SVG).
 *
 * Animação: framer-motion. Entrada em stagger (opacity + scale/translate)
 * ao montar, depois loop idle contínuo e discreto por elemento (transform /
 * opacity / stroke-dashoffset apenas — nunca layout). Tudo desliga quando
 * `prefers-reduced-motion` está ativo, via useIlluMotion().
 */

export interface CanvasProps extends SVGProps<SVGSVGElement> {
  title: string
  children?: ReactNode
}

/** Moldura comum 120×80: fundo surface-2, borda sutil, cantos arredondados. */
export function Canvas({ title, children, ...props }: CanvasProps) {
  return (
    <svg viewBox="0 0 120 80" fill="none" aria-hidden="true" {...props}>
      <title>{title}</title>
      <rect
        x="1"
        y="1"
        width="118"
        height="78"
        rx="12"
        className="fill-surface-2 stroke-white/10"
        strokeWidth="1"
      />
      {children}
    </svg>
  )
}

/** Estado de animação de uma ilustração: ligada ou estática (reduced motion). */
export interface IlluMotion {
  /** true quando o usuário pediu menos movimento — renderizar tudo estático. */
  reduced: boolean
  /** Variants de entrada para o container (stagger dos filhos). */
  container: Variants
  /** Variants de entrada por elemento (opacity + scale/translate + spring). */
  item: Variants
}

const containerVariants: Variants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.09,
      delayChildren: 0.03,
    },
  },
}

const itemVariants: Variants = {
  hidden: { opacity: 0, scale: 0.85, y: 4 },
  show: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 260, damping: 20 },
  },
}

const staticVariants: Variants = {
  hidden: { opacity: 1, scale: 1, y: 0 },
  show: { opacity: 1, scale: 1, y: 0 },
}

/**
 * Hook central de animação das ilustrações. Retorna variants prontas para
 * `motion.g` / `motion.path` etc. e a flag `reduced` para os loops idle
 * (quando true, cada ilustração deve pular os `animate` de loop contínuo).
 *
 * Uso típico:
 * ```tsx
 * const { reduced, container, item } = useIlluMotion()
 * <motion.g initial="hidden" animate="show" variants={container}>
 *   <motion.rect variants={item} ... />
 *   <motion.circle
 *     variants={item}
 *     animate={reduced ? undefined : { scale: [1, 1.08, 1] }}
 *     transition={reduced ? undefined : { duration: 2.4, repeat: Infinity }}
 *   />
 * </motion.g>
 * ```
 */
export function useIlluMotion(): IlluMotion {
  const reduced = Boolean(useReducedMotion())
  return {
    reduced,
    container: containerVariants,
    item: reduced ? staticVariants : itemVariants,
  }
}

/** Easing suave padrão para loops idle (charmoso, nunca frenético). */
export const IDLE_EASE = [0.45, 0, 0.2, 1] as const

/** Duração padrão (segundos) para loops idle — dentro da faixa 2–4s pedida. */
export const IDLE_DURATION = 3
