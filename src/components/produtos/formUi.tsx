import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'

/**
 * Casca de modal e classes de campo compartilhadas pelos formulários de
 * produto, checkout e cupom. Mesmo visual e mesma animação dos modais que já
 * existem no painel (ClientFormModal / ConfirmacaoModal) — só extraído para
 * não repetir a mesma marcação três vezes.
 */

export const inputClass =
  'w-full rounded-lg border border-white/5 bg-surface-2 px-4 py-3 text-base text-ink placeholder:text-muted/50 outline-none transition-colors duration-200 focus:border-accent/60 focus:ring-2 focus:ring-accent/25 sm:py-2.5 sm:text-sm'

export const labelClass = 'text-xs font-medium uppercase tracking-widest text-muted'

export const botaoPrimario =
  'rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_24px_-8px_rgba(108,91,242,0.6)] transition-all duration-200 hover:bg-accent-2 disabled:cursor-not-allowed disabled:opacity-60'

export const botaoSecundario =
  'rounded-lg border border-white/10 px-4 py-2.5 text-sm font-medium text-muted transition-colors duration-200 hover:bg-white/5 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent'

interface ModalBaseProps {
  open: boolean
  titulo: string
  descricao?: string
  /** Modais largos (checkout) usam 'max-w-3xl'; os curtos, o padrão. */
  larguraClass?: string
  onClose: () => void
  children: ReactNode
}

export function ModalBase({
  open,
  titulo,
  descricao,
  larguraClass = 'max-w-md',
  onClose,
  children,
}: ModalBaseProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-bg/70 px-4 py-10 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) onClose()
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
            role="dialog"
            aria-modal="true"
            aria-label={titulo}
            className={`w-full ${larguraClass} rounded-2xl border border-white/5 bg-surface-1 p-7 font-kanit shadow-[0_24px_80px_-32px_rgba(108,91,242,0.35)]`}
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold text-ink">{titulo}</h2>
                {descricao && (
                  <p className="mt-0.5 text-xs font-light text-muted">{descricao}</p>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Fechar"
                className="rounded-lg p-1.5 text-muted transition-colors duration-200 hover:bg-white/5 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}

/** Bloco de configuração com título — usado nas seções do checkout. */
export function Bloco({
  titulo,
  ajuda,
  children,
}: {
  titulo: string
  ajuda?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="rounded-xl border border-white/5 bg-surface-2/40 p-5">
      <h3 className="text-sm font-semibold text-ink">{titulo}</h3>
      {ajuda && (
        <p className="mt-1 text-xs font-light leading-relaxed text-muted">{ajuda}</p>
      )}
      <div className="mt-4 flex flex-col gap-4">{children}</div>
    </section>
  )
}

/** Interruptor de "ativo" no padrão do painel. */
export function CampoAtivo({
  ativo,
  onChange,
  rotuloLigado,
  rotuloDesligado,
}: {
  ativo: boolean
  onChange: (valor: boolean) => void
  rotuloLigado: string
  rotuloDesligado: string
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-white/5 bg-surface-2 px-4 py-3">
      <input
        type="checkbox"
        checked={ativo}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 accent-[#6C5BF2]"
      />
      <span className="text-sm text-ink">
        {ativo ? rotuloLigado : rotuloDesligado}
      </span>
    </label>
  )
}
