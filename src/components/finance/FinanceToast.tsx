import { AnimatePresence, motion } from 'framer-motion'
import { CircleCheck } from 'lucide-react'

interface FinanceToastProps {
  message: string | null
}

/**
 * Feedback discreto e local ao financeiro (não existe toast global no app).
 * Renderizado fixo no canto inferior direito, some sozinho via timeout do caller.
 */
export default function FinanceToast({ message }: FinanceToastProps) {
  return (
    <AnimatePresence>
      {message && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.2 }}
          role="status"
          className="fixed bottom-6 right-6 z-[60] inline-flex items-center gap-2 rounded-lg border border-emerald-400/25 bg-surface-1 px-4 py-3 text-sm font-medium text-ink shadow-[0_16px_48px_-16px_rgba(0,0,0,0.6)]"
        >
          <CircleCheck aria-hidden className="h-4 w-4 text-emerald-400" />
          {message}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
