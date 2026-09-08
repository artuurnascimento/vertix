import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, X } from 'lucide-react'
import { confirmacaoConfere, formatCentavos, valorParaConfirmar } from './pedidosResumo'

/**
 * Confirmação forte de reembolso — o diálogo, sem saber de qual venda.
 *
 * Existe separado do ConfirmacaoModal genérico por dois motivos concretos:
 * este diálogo PRENDE O FOCO (dinheiro saindo não pode ter Tab escapando para
 * a página atrás) e a confirmação é o VALOR, digitado, e não uma palavra curta
 * em caixa alta — o campo do modal genérico foi desenhado para "EXCLUIR".
 *
 * É COMPARTILHADO por dois fluxos: o pedido do checkout (ReembolsoModal, aqui
 * ao lado) e a compra do Vertix Scan (ScanReembolsoModal). Os dois devolvem
 * dinheiro e revogam acesso, e a confirmação de um não pode ficar mais fraca
 * que a do outro por descuido de cópia. O que muda entre eles — de onde vem o
 * nome do cliente, o que exatamente para de abrir, que aviso o Financeiro
 * merece — entra por prop, e é a única coisa que entra.
 *
 * A descrição diz, sem eufemismo, as duas coisas que acontecem: o valor
 * inteiro volta para o cliente e o acesso dele ao material é revogado. A
 * segunda é irreversível para quem comprou, então ela é dita ANTES, não
 * depois.
 */

export interface ReembolsoDialogProps {
  /**
   * null = fechado. Quando muda, o campo digitado é zerado — abrir o diálogo
   * de outra venda não pode herdar o valor já conferido da anterior.
   */
  chave: string | null
  /** Quanto volta, em centavos. É também o que a pessoa terá de digitar. */
  valorCentavos: number
  /** Para quem volta. Aparece no título e na primeira consequência. */
  nome: string
  /** Contato do cliente, entre parênteses. Ausente quando não se sabe. */
  contato?: string | null
  /** Segunda consequência: o que exatamente deixa de funcionar para ele. */
  acesso: ReactNode
  /** Aviso opcional em letra miúda (recebível no Financeiro, por exemplo). */
  aviso?: ReactNode
  isPending?: boolean
  erro?: string | null
  onConfirm: () => void
  onClose: () => void
}

const SELETOR_FOCAVEL =
  'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'

const inputClass =
  'w-full rounded-lg border border-white/5 bg-surface-2 px-4 py-3 font-mono text-base tracking-wider text-ink placeholder:tracking-normal placeholder:text-muted/50 outline-none transition-colors duration-200 focus:border-red-400/60 focus:ring-2 focus:ring-red-400/20 sm:py-2.5 sm:text-sm'

export default function ReembolsoDialog({
  chave,
  valorCentavos,
  nome,
  contato = null,
  acesso,
  aviso = null,
  isPending = false,
  erro = null,
  onConfirm,
  onClose,
}: ReembolsoDialogProps) {
  const [digitado, setDigitado] = useState('')
  const caixaRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const aberto = chave !== null

  useEffect(() => {
    if (!aberto) return
    setDigitado('')
    // O foco entra no campo que libera a ação: quem abriu o diálogo já está
    // onde precisa digitar, e leitores de tela anunciam o rótulo junto.
    inputRef.current?.focus()
  }, [aberto, chave])

  useEffect(() => {
    if (!aberto) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isPending) {
        onClose()
        return
      }
      if (event.key !== 'Tab') return
      // Armadilha de foco: sem ela o Tab sai do diálogo e a próxima tecla pode
      // acionar um botão da lista atrás — inclusive outro reembolso.
      const focaveis = caixaRef.current?.querySelectorAll<HTMLElement>(SELETOR_FOCAVEL)
      if (!focaveis || focaveis.length === 0) return
      const primeiro = focaveis[0]
      const ultimo = focaveis[focaveis.length - 1]
      const ativo = document.activeElement
      if (event.shiftKey && (ativo === primeiro || !caixaRef.current?.contains(ativo))) {
        event.preventDefault()
        ultimo.focus()
      } else if (!event.shiftKey && ativo === ultimo) {
        event.preventDefault()
        primeiro.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [aberto, isPending, onClose])

  if (!aberto) return null

  const valor = formatCentavos(valorCentavos)
  const esperado = valorParaConfirmar(valorCentavos)
  const liberado = !isPending && confirmacaoConfere(digitado, valorCentavos)

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-bg/70 px-4 py-8 backdrop-blur-sm"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget && !isPending) onClose()
        }}
      >
        <motion.div
          ref={caixaRef}
          initial={{ opacity: 0, y: 12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.98 }}
          transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="reembolso-titulo"
          aria-describedby="reembolso-consequencias"
          className="my-auto w-full max-w-lg rounded-2xl border border-white/5 bg-surface-1 p-6 font-kanit shadow-[0_24px_80px_-32px_rgba(0,0,0,0.8)]"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-red-500/20 bg-red-500/10">
                <AlertTriangle aria-hidden className="h-4 w-4 text-red-400" />
              </span>
              <h2 id="reembolso-titulo" className="text-base font-semibold text-ink">
                Reembolsar {valor} para {nome}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              aria-label="Fechar"
              className="rounded-lg p-1.5 text-muted transition-colors duration-200 hover:bg-white/5 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-50"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div
            id="reembolso-consequencias"
            className="mt-4 text-sm font-light leading-relaxed text-muted"
          >
            <p>Ao confirmar, duas coisas acontecem de uma vez:</p>
            <ul className="mt-3 flex list-none flex-col gap-2 p-0">
              <li className="flex gap-2.5 rounded-lg border border-white/5 bg-surface-2 px-3 py-2.5">
                <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />
                <span>
                  <strong className="font-medium text-ink">{valor}</strong> voltam
                  para {nome}
                  {contato ? ` (${contato})` : ''}. É o valor inteiro — reembolso
                  parcial não existe aqui.
                </span>
              </li>
              <li className="flex gap-2.5 rounded-lg border border-white/5 bg-surface-2 px-3 py-2.5">
                <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />
                <span>{acesso}</span>
              </li>
            </ul>
            {aviso && <p className="mt-3 text-xs">{aviso}</p>}
          </div>

          <label className="mt-5 flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-widest text-muted">
              Digite <span className="font-mono text-red-300">{esperado}</span> para
              confirmar o valor
            </span>
            <input
              ref={inputRef}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              spellCheck={false}
              value={digitado}
              onChange={(e) => setDigitado(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && liberado) onConfirm()
              }}
              placeholder={esperado}
              aria-label={`Digite ${esperado} para confirmar o reembolso`}
              className={inputClass}
            />
          </label>

          {erro && (
            <p role="alert" className="mt-3 text-xs font-light text-red-300">
              {erro}
            </p>
          )}

          <div className="mt-5 flex flex-wrap justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-muted transition-colors duration-200 hover:bg-white/5 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={!liberado}
              className={[
                'rounded-lg px-4 py-2 text-sm font-semibold transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400',
                // Travado não é "vermelho mais claro": um botão de devolver
                // dinheiro precisa PARECER travado, ou a pessoa clica, nada
                // acontece e ela conclui que a tela está quebrada.
                liberado
                  ? 'bg-red-500/90 text-white hover:bg-red-500'
                  : 'cursor-not-allowed border border-white/10 bg-white/5 text-muted/70',
              ].join(' ')}
            >
              {isPending ? 'Estornando…' : `Reembolsar ${valor}`}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  )
}
