import { motion, useReducedMotion } from 'framer-motion'

/**
 * Cartão de aviso de tela cheia (link inválido, pagamento em análise). Mesma
 * moldura do StatusCard da página de cobrança, para quem chega aqui vindo de
 * lá não sentir que trocou de produto.
 */
export default function AvisoCheckout({
  icone,
  titulo,
  texto,
}: {
  icone: React.ReactNode
  titulo: string
  texto: string
}) {
  const semMovimento = useReducedMotion()

  return (
    <motion.div
      initial={semMovimento ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mt-16 flex flex-col items-center rounded-2xl border border-white/5 bg-surface-1 px-6 py-14 text-center"
    >
      {icone}
      <h1 className="hero-heading mt-5 text-2xl font-bold">{titulo}</h1>
      <p className="mt-3 max-w-sm text-sm font-light leading-relaxed text-muted">
        {texto}
      </p>
    </motion.div>
  )
}
