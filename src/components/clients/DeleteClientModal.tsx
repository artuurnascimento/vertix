import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Trash2 } from 'lucide-react'

interface DeleteClientModalProps {
  open: boolean
  clientName: string
  isDeleting: boolean
  onConfirm: () => void
  onClose: () => void
}

/** Confirmação pequena de exclusão de cliente (só admin chega aqui). */
export default function DeleteClientModal({
  open,
  clientName,
  isDeleting,
  onConfirm,
  onClose,
}: DeleteClientModalProps) {
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
            if (event.target === event.currentTarget) onClose()
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
            role="alertdialog"
            aria-modal="true"
            aria-label="Excluir cliente"
            className="w-full max-w-sm rounded-2xl border border-white/5 bg-surface-1 p-6 font-kanit shadow-[0_24px_80px_-32px_rgba(0,0,0,0.8)]"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-red-500/20 bg-red-500/10">
                <Trash2 className="h-4 w-4 text-red-400" />
              </span>
              <h2 className="text-base font-semibold text-ink">
                Excluir cliente?
              </h2>
            </div>
            <p className="mt-3 text-sm font-light leading-relaxed text-muted">
              <span className="font-medium text-ink">{clientName}</span> será
              removido permanentemente. Projetos vinculados serão excluídos.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-muted transition-colors duration-200 hover:bg-white/5 hover:text-ink"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={isDeleting}
                className="rounded-lg bg-red-500/90 px-4 py-2 text-sm font-semibold text-white transition-colors duration-200 hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isDeleting ? 'Excluindo…' : 'Excluir'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}
