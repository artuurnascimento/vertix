import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import PixPanel from './PixPanel'
import type { PixCheckout } from './checkoutApi'

interface Props {
  aberto: boolean
  pix: PixCheckout
  totalCentavos: number
  /** Página de acompanhamento do pedido, já com o id. */
  linkPedido: string | null
  onFechar: () => void
}

/**
 * O Pix por cima do checkout, em vez de trocar a página inteira.
 *
 * Trocar de tela no meio do pagamento apaga o contexto: a pessoa some do
 * formulário que acabou de preencher e, se fechar sem pagar, não tem para onde
 * voltar. Sobreposto, o checkout continua atrás e o caminho de volta é óbvio.
 *
 * DUAS COISAS AQUI EXISTEM PARA NÃO PERDER A VENDA:
 *
 * 1. **Clique fora NÃO fecha.** O gesto de copiar o código costuma terminar em
 *    clique solto na tela, e fechar ali levaria embora o QR de um pedido que já
 *    foi criado no Mercado Pago. Fecha por botão e por Esc, que são gestos
 *    deliberados.
 * 2. **Fechar não descarta nada.** Quem controla o `aberto` mantém o Pix, e o
 *    checkout mostra como reabrir. O código segue valendo pela validade que o
 *    servidor deu.
 *
 * O foco fica preso enquanto está aberto e volta para onde estava ao fechar —
 * quem navega por teclado não pode tabular para dentro do formulário escondido
 * atrás do painel.
 */
export default function PixModal({
  aberto,
  pix,
  totalCentavos,
  linkPedido,
  onFechar,
}: Props) {
  const caixa = useRef<HTMLDivElement>(null)
  const focoAnterior = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!aberto) return

    focoAnterior.current = document.activeElement as HTMLElement | null

    // Trava a rolagem do fundo: rolar a página atrás do painel é o tipo de
    // coisa que faz a pessoa achar que perdeu o código.
    const overflowAnterior = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') {
        onFechar()
        return
      }
      if (evento.key !== 'Tab' || !caixa.current) return

      const focaveis = caixa.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
      )
      if (focaveis.length === 0) return

      const primeiro = focaveis[0]
      const ultimo = focaveis[focaveis.length - 1]
      const atual = document.activeElement

      if (evento.shiftKey && atual === primeiro) {
        evento.preventDefault()
        ultimo.focus()
      } else if (!evento.shiftKey && atual === ultimo) {
        evento.preventDefault()
        primeiro.focus()
      }
    }

    document.addEventListener('keydown', aoTeclar)
    // Leva o foco para dentro logo ao abrir, senão o leitor de tela continua
    // narrando o formulário de trás.
    caixa.current?.focus()

    return () => {
      document.removeEventListener('keydown', aoTeclar)
      document.body.style.overflow = overflowAnterior
      focoAnterior.current?.focus()
    }
  }, [aberto, onFechar])

  if (!aberto) return null

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/80 px-4 py-6 backdrop-blur-sm sm:items-center sm:py-10"
      // Sem onClick de fechar aqui: ver a nota 1 no cabeçalho do arquivo.
      role="presentation"
    >
      <div
        ref={caixa}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pix-modal-titulo"
        tabIndex={-1}
        className="relative w-full max-w-md rounded-2xl border border-white/10 bg-surface-1 p-5 shadow-2xl outline-none sm:p-7"
      >
        <h2 id="pix-modal-titulo" className="sr-only">
          Pague com Pix
        </h2>

        <button
          type="button"
          onClick={onFechar}
          aria-label="Fechar e voltar ao checkout"
          className="absolute right-3 top-3 rounded-lg p-2 text-muted/70 transition-colors duration-150 hover:bg-white/5 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        >
          <X aria-hidden className="h-4 w-4" />
        </button>

        <PixPanel
          pix={pix}
          totalCentavos={totalCentavos}
          linkPedido={linkPedido}
        />
      </div>
    </div>,
    document.body
  )
}
