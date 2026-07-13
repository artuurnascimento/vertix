import { useEffect, useRef, useState } from 'react'
import { Trash2 } from 'lucide-react'

interface ConfirmDeleteButtonProps {
  label: string
  onConfirm: () => void
  isPending?: boolean
  className?: string
}

const CONFIRM_TIMEOUT_MS = 3000

/** Exclusão com dois cliques — primeiro clique arma a confirmação, some sozinho após 3s. */
export default function ConfirmDeleteButton({
  label,
  onConfirm,
  isPending = false,
  className = '',
}: ConfirmDeleteButtonProps) {
  const [armed, setArmed] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  if (armed) {
    return (
      <button
        type="button"
        onClick={() => {
          if (timeoutRef.current) clearTimeout(timeoutRef.current)
          setArmed(false)
          onConfirm()
        }}
        disabled={isPending}
        aria-label={`Confirmar: ${label}`}
        className={`rounded-lg border border-red-500/30 bg-red-500/15 px-2.5 py-1.5 text-xs font-semibold text-red-300 transition-colors duration-150 hover:bg-red-500/25 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
      >
        {isPending ? 'Excluindo…' : 'Confirmar?'}
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={() => {
        setArmed(true)
        timeoutRef.current = setTimeout(() => setArmed(false), CONFIRM_TIMEOUT_MS)
      }}
      aria-label={label}
      title={label}
      className={`rounded-lg p-2 text-muted/50 opacity-0 transition-all duration-150 hover:bg-red-500/10 hover:text-red-400 focus-visible:opacity-100 group-hover:opacity-100 ${className}`}
    >
      <Trash2 className="h-4 w-4" />
    </button>
  )
}
