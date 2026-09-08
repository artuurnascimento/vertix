interface Props {
  className?: string
}

/**
 * Símbolo do Pix: o losango do Banco Central, formado por quatro pontas que
 * convergem ao centro, no turquesa da marca (#32BCAD).
 *
 * Desenhado inline, e não baixado: a política de segurança da página bloqueia
 * domínio externo, e num checkout nada pode depender de um arquivo de fora
 * carregar. Exibir a marca do meio de pagamento aceito é o uso comum e
 * esperado numa página de compra.
 */
export default function IconePix({ className = 'h-5 w-5' }: Props) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden focusable="false">
      <g fill="#32BCAD">
        {/* As quatro pontas do losango, com folga entre elas: é a folga que
            faz o símbolo ser lido como Pix, e não como um quadrado girado. */}
        <path d="M16 1.8 L22.1 7.9 L16 14 L9.9 7.9 Z" />
        <path d="M24.1 9.9 L30.2 16 L24.1 22.1 L18 16 Z" />
        <path d="M16 18 L22.1 24.1 L16 30.2 L9.9 24.1 Z" />
        <path d="M7.9 9.9 L14 16 L7.9 22.1 L1.8 16 Z" />
      </g>
    </svg>
  )
}
