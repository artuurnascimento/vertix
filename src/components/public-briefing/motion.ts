import type { Transition, Variants } from 'framer-motion'

/**
 * Constantes de motion compartilhadas pelo wizard público. Só
 * transform/opacity (compositor-friendly) — nunca width/height/padding.
 * Toda duration/spring aqui respeita a janela 150-400ms de interação
 * definida no design system; springs são usados para movimento físico.
 */

/** Spring padrão para transições de tela (perguntas, revisão). */
export const SPRING_SCREEN: Transition = {
  type: 'spring',
  stiffness: 300,
  damping: 30,
  mass: 0.9,
}

/** Spring mais ágil para micro-interações (cards, botões, check). */
export const SPRING_SNAPPY: Transition = {
  type: 'spring',
  stiffness: 420,
  damping: 26,
}

/** Deslocamento horizontal do slide entre perguntas. */
export const SLIDE_PX = 56

/**
 * Variants de slide direcional para AnimatePresence custom=dir.
 * dir 1 = avançar (entra da direita, sai pela esquerda).
 * dir -1 = voltar (entra da esquerda, sai pela direita).
 */
export function slideVariants(reducedMotion: boolean | null): Variants {
  return {
    enter: (dir: number) => ({
      opacity: 0,
      x: reducedMotion ? 0 : dir * SLIDE_PX,
    }),
    center: { opacity: 1, x: 0 },
    exit: (dir: number) => ({
      opacity: 0,
      x: reducedMotion ? 0 : dir * -SLIDE_PX,
    }),
  }
}

/** Stagger container para listas de elementos que entram em sequência. */
export function staggerContainer(reducedMotion: boolean | null): Variants {
  return {
    hidden: {},
    show: {
      transition: reducedMotion
        ? { staggerChildren: 0 }
        : { staggerChildren: 0.07, delayChildren: 0.05 },
    },
  }
}

/** Item filho de staggerContainer: sobe e aparece. */
export function staggerItem(reducedMotion: boolean | null): Variants {
  return {
    hidden: { opacity: 0, y: reducedMotion ? 0 : 10 },
    show: {
      opacity: 1,
      y: 0,
      transition: reducedMotion
        ? { duration: 0.01 }
        : { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] },
    },
  }
}
