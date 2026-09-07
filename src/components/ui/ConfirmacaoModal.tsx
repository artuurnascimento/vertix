import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, Trash2, X } from 'lucide-react'

interface ConfirmacaoModalProps {
  open: boolean
  titulo: string
  descricao: ReactNode
  /** Rótulo do botão de confirmar (ex.: "Excluir", "Zerar tudo"). */
  rotuloConfirmar: string
  /** Quando definido, é preciso digitar exatamente esta palavra para liberar o botão. */
  palavraDeConfirmacao?: string
  isPending?: boolean
  erro?: string | null
  onConfirm: () => void
  onClose: () => void
}

const inputClass =
  'w-full rounded-lg border border-white/5 bg-surface-2 px-4 py-3 font-mono text-base uppercase tracking-[0.2em] text-ink placeholder:normal-case placeholder:tracking-normal placeholder:text-muted/50 outline-none transition-colors duration-200 focus:border-red-400/60 focus:ring-2 focus:ring-red-400/20 sm:py-2.5 sm:text-sm'

/**
 * Confirmação de ação destrutiva no padrão do painel (mesmo visual e animação
 * do DeleteClientModal), com opção de exigir uma palavra digitada nas ações
 * sem volta. Fecha no Esc e no clique fora, e mostra o erro real quando falha.
 */
export default function ConfirmacaoModal({
  open,
  titulo,
  descricao,
  rotuloConfirmar,
  palavraDeConfirmacao,
  isPending = false,
  erro = null,
  onConfirm,
  onClose,
}: ConfirmacaoModalProps) {
  const [digitado, setDigitado] = useState('')

  useEffect(() => {
    if (!open) return
    setDigitado('')
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isPending) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, isPending, onClose])

  const liberado =
    !isPending &&
    (palavraDeConfirmacao == null ||
      digitado.trim().toUpperCase() === palavraDeConfirmacao.toUpperCase())

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-bg/70 px-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isPending) onClose()
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
            role="alertdialog"
            aria-modal="true"
            aria-label={titulo}
            className="w-full max-w-md rounded-2xl border border-white/5 bg-surface-1 p-6 font-kanit shadow-[0_24px_80px_-32px_rgba(0,0,0,0.8)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-red-500/20 bg-red-500/10">
                  {palavraDeConfirmacao ? (
                    <AlertTriangle className="h-4 w-4 text-red-400" />
                  ) : (
                    <Trash2 className="h-4 w-4 text-red-400" />
                  )}
                </span>
                <h2 className="text-base font-semibold text-ink">{titulo}</h2>
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

            <div className="mt-3 text-sm font-light leading-relaxed text-muted">
              {descricao}
            </div>

            {palavraDeConfirmacao && (
              <label className="mt-5 flex flex-col gap-1.5">
                <span className="text-xs font-medium uppercase tracking-widest text-muted">
                  Digite{' '}
                  <span className="font-mono text-red-300">
                    {palavraDeConfirmacao}
                  </span>{' '}
                  para confirmar
                </span>
                <input
                  type="text"
                  autoFocus
                  autoComplete="off"
                  spellCheck={false}
                  value={digitado}
                  onChange={(e) => setDigitado(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && liberado) onConfirm()
                  }}
                  placeholder={palavraDeConfirmacao}
                  className={inputClass}
                />
              </label>
            )}

            {erro && (
              <p role="alert" className="mt-3 text-xs font-light text-red-300">
                {erro}
              </p>
            )}

            <div className="mt-5 flex justify-end gap-3">
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
                className="rounded-lg bg-red-500/90 px-4 py-2 text-sm font-semibold text-white transition-colors duration-200 hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400"
              >
                {isPending ? 'Aguarde…' : rotuloConfirmar}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}
