import type { ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import VertixCheckoutLogo from '../checkout/VertixCheckoutLogo'
import RodapeCheckout from '../checkout/RodapeCheckout'

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
        {/*
          O lockup "VERTIX | CHECKOUT", o mesmo do cabeçalho da página de
          pagamento. Aqui havia só o símbolo com a palavra VERTIX, e o efeito
          era o comprador terminar a compra numa tela que não se identificava
          como a mesma em que ele acabou de digitar o cartão.
        */}
        <header className="flex items-center justify-center">
          <VertixCheckoutLogo symbolSize="clamp(24px, 6vw, 32px)" />
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
/**
 * Rodapé da confirmação e do upsell — o MESMO do checkout.
 *
 * Antes era um rodapé próprio, com apenas o e-mail de contato e o CNPJ. O
 * efeito é que a compra começava numa página com marca, selo de ambiente
 * seguro e as regras à mão, e terminava numa visivelmente mais pobre — logo
 * onde a pessoa mais procura suporte e quer reler o que contratou.
 *
 * O nome se manteve para não mexer nas duas páginas que já o importam.
 * `comAceite` fica de fora: aqui a compra já aconteceu, e pedir aceite de quem
 * já pagou sugere uma pendência que não existe.
 */
export function RodapeVertix() {
  return <RodapeCheckout />
}
