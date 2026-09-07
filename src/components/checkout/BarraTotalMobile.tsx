import { ArrowDown } from 'lucide-react'
import { formatarCentavos } from './checkoutTotal'

interface Props {
  totalCentavos: number
  /** Id da seção de pagamento — o botão rola até ela. */
  alvoId: string
}

/**
 * Barra fixa no rodapé, só no celular. Existe por um motivo: no telefone o
 * total sai da tela assim que a pessoa desce, e o botão de pagar fica a três
 * rolagens de distância. Aqui o valor acompanha e o caminho é um toque.
 */
export default function BarraTotalMobile({ totalCentavos, alvoId }: Props) {
  const irParaPagamento = () => {
    const alvo = document.getElementById(alvoId)
    if (!alvo) return
    // `scroll-behavior: smooth` do html já respeita prefers-reduced-motion
    // (index.css desliga o smooth nesse caso), então não repetimos a checagem.
    alvo.scrollIntoView({ block: 'start' })
    alvo.focus({ preventScroll: true })
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-surface-1/95 px-4 py-3 backdrop-blur md:hidden">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted">
            Total
          </p>
          <p
            aria-live="polite"
            className="text-lg font-bold tabular-nums text-ink"
          >
            {formatarCentavos(totalCentavos)}
          </p>
        </div>
        <button
          type="button"
          onClick={irParaPagamento}
          className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Ir para pagamento
          <ArrowDown aria-hidden className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
