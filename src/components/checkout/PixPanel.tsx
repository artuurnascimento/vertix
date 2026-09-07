import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CheckCircle2, Copy, Loader2 } from 'lucide-react'
import { formatarCentavos } from './checkoutTotal'
import type { PixCheckout } from './checkoutApi'

interface Props {
  pix: PixCheckout
  totalCentavos: number
  /** Página de acompanhamento do pedido, já com o id. */
  linkPedido: string | null
}

/**
 * O QR pode chegar de três jeitos diferentes conforme o backend: base64 puro,
 * data URL já pronta ou URL de imagem. Normalizamos aqui em vez de exigir um
 * formato — é a diferença entre a tela funcionar e mostrar um ícone quebrado.
 */
function fonteImagem(qr: string): string {
  if (qr.startsWith('data:') || qr.startsWith('http')) return qr
  return `data:image/png;base64,${qr}`
}

/**
 * Painel do Pix. A confirmação chega pelo webhook do lado do servidor; esta
 * página não tem endpoint para consultar o status do pedido, então em vez de
 * fingir que "detectou" o pagamento, ela entrega o caminho honesto: o QR e o
 * link para acompanhar o pedido.
 */
export default function PixPanel({ pix, totalCentavos, linkPedido }: Props) {
  const [copiado, setCopiado] = useState(false)

  const copiar = async () => {
    if (!pix.copiaCola) return
    try {
      await navigator.clipboard.writeText(pix.copiaCola)
      setCopiado(true)
      window.setTimeout(() => setCopiado(false), 2000)
    } catch {
      // Clipboard bloqueado (http, permissão negada): o código segue visível
      // logo abaixo para seleção manual.
      setCopiado(false)
    }
  }

  return (
    <div className="flex flex-col items-center text-center">
      <h2 className="text-lg font-semibold text-ink">
        Pague {formatarCentavos(totalCentavos)} no Pix
      </h2>
      <p className="mt-1 text-xs font-light text-muted">
        Escaneie o QR code ou copie o código no app do seu banco.
      </p>

      {pix.qr && (
        <img
          src={fonteImagem(pix.qr)}
          alt="QR code do Pix"
          width={220}
          height={220}
          className="mt-5 h-[220px] w-[220px] rounded-xl bg-white p-3"
        />
      )}

      {pix.copiaCola && (
        <>
          <button
            type="button"
            onClick={() => void copiar()}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-ink transition-colors hover:border-accent/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          >
            {copiado ? (
              <>
                <CheckCircle2 aria-hidden className="h-4 w-4 text-emerald-400" />
                Código copiado!
              </>
            ) : (
              <>
                <Copy aria-hidden className="h-4 w-4" />
                Copiar código Pix
              </>
            )}
          </button>
          <p className="sr-only" aria-live="polite">
            {copiado ? 'Código Pix copiado.' : ''}
          </p>
          <p className="mt-3 w-full select-all break-all rounded-lg border border-white/5 bg-surface-2 px-3 py-2 text-left text-[11px] font-light text-muted">
            {pix.copiaCola}
          </p>
        </>
      )}

      <p className="mt-5 flex items-center gap-2 text-xs font-light text-muted">
        <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin text-accent" />
        A confirmação é automática assim que o banco liquidar.
      </p>

      {linkPedido && (
        <Link
          to={linkPedido}
          className="mt-4 inline-flex items-center gap-1.5 text-sm text-accent underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        >
          Já paguei — acompanhar meu pedido
          <ArrowRight aria-hidden className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  )
}
