import type { ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import LogoMark from '../ui/LogoMark'

/**
 * Moldura das telas públicas pós-compra. Mesmo enquadramento da página de
 * pagamento (fundo `bg`, atmosfera, marca no topo, coluna estreita centrada)
 * para que o pós-compra pareça a continuação da mesma tela, não outro site.
 *
 * A coluna é estreita de propósito: a decisão aqui é sim/não, e largura extra
 * só afasta o botão do polegar no celular.
 */
export function CheckoutShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-bg px-4 py-8 font-kanit sm:px-6 sm:py-12">
      <div
        aria-hidden
        className="app-ambient pointer-events-none fixed inset-0"
      />
      <div className="relative mx-auto w-full max-w-xl">
        <header className="flex items-center justify-center gap-2.5">
          <LogoMark className="h-7 w-7" />
          <span className="text-sm font-semibold tracking-[0.35em] text-ink">
            VERTIX
          </span>
        </header>
        {children}
      </div>
    </div>
  )
}

/**
 * Entrada suave dos blocos. `useReducedMotion` respeita a preferência do
 * sistema: quem pediu menos movimento recebe o conteúdo já posicionado, sem
 * deslocamento — importante numa tela que aparece logo depois de um pagamento.
 */
export function Entrada({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode
  delay?: number
  className?: string
}) {
  const semMovimento = useReducedMotion()
  return (
    <motion.div
      initial={semMovimento ? { opacity: 0 } : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: semMovimento ? 0.15 : 0.35,
        delay: semMovimento ? 0 : delay,
        ease: [0.25, 0.1, 0.25, 1],
      }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

/** Rodapé institucional idêntico ao da página de pagamento. */
export function RodapeVertix() {
  return (
    <footer className="mt-10 flex flex-col items-center gap-1.5 text-center text-xs font-light text-muted">
      <p>
        Precisa de ajuda com o seu pedido?{' '}
        <a
          href="mailto:contato@vertix.studio"
          className="rounded text-accent underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          contato@vertix.studio
        </a>
      </p>
      <p className="text-[11px] text-muted/80">
        Vertix Studio · CNPJ 54.203.421/0001-49
      </p>
    </footer>
  )
}
