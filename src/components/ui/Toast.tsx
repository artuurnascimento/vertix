import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CircleCheck, CircleX } from 'lucide-react'

export interface ToastMensagem {
  texto: string
  tipo?: 'sucesso' | 'erro'
}

const TOAST_TIMEOUT_MS = 4000

/** Estado de toast que some sozinho; chame `mostrar(...)` depois de uma ação. */
export function useToast(): {
  toast: ToastMensagem | null
  mostrar: (m: ToastMensagem) => void
} {
  const [toast, setToast] = useState<ToastMensagem | null>(null)
  const timer = useRef<number | null>(null)
  const mostrar = useCallback((m: ToastMensagem) => {
    setToast(m)
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setToast(null), TOAST_TIMEOUT_MS)
  }, [])
  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current)
    },
    []
  )
  return { toast, mostrar }
}

/**
 * Feedback discreto no canto inferior direito (mesmo visual do FinanceToast),
 * com variante de erro.
 */
export default function Toast({ mensagem }: { mensagem: ToastMensagem | null }) {
  const erro = mensagem?.tipo === 'erro'
  return (
    <AnimatePresence>
      {mensagem && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.2 }}
          role="status"
          className={[
            'fixed bottom-6 right-6 z-[60] inline-flex items-center gap-2 rounded-lg border bg-surface-1 px-4 py-3 text-sm font-medium text-ink shadow-[0_16px_48px_-16px_rgba(0,0,0,0.6)]',
            erro ? 'border-red-400/30' : 'border-emerald-400/25',
          ].join(' ')}
        >
          {erro ? (
            <CircleX aria-hidden className="h-4 w-4 text-red-400" />
          ) : (
            <CircleCheck aria-hidden className="h-4 w-4 text-emerald-400" />
          )}
          {mensagem.texto}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
