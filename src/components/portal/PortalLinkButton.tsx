import { useEffect, useRef, useState } from 'react'
import { Check, Link2, TriangleAlert } from 'lucide-react'

/**
 * Botão discreto do admin para copiar o link público do portal do cliente.
 * Clipboard API com fallback via textarea para contextos sem permissão.
 * O orquestrador pluga este componente no ProjectDetail.
 */

const FEEDBACK_MS = 2000

type CopyState = 'idle' | 'copied' | 'error'

function buildPortalUrl(portalToken: string): string {
  return `${window.location.origin}/portal/${portalToken}`
}

/** Fallback para navegadores/contextos sem navigator.clipboard. */
function copyWithFallback(text: string): boolean {
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  let didCopy = false
  try {
    didCopy = document.execCommand('copy')
  } catch {
    didCopy = false
  }
  document.body.removeChild(textarea)
  return didCopy
}

async function copyToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // Sem permissão / contexto inseguro — tenta o fallback abaixo.
    }
  }
  return copyWithFallback(text)
}

const STATE_LABEL: Record<CopyState, string> = {
  idle: 'Copiar link do portal',
  copied: 'Link copiado!',
  error: 'Não foi possível copiar',
}

const STATE_CLASS: Record<CopyState, string> = {
  idle: 'border-white/10 bg-white/5 text-muted hover:border-white/20 hover:text-ink',
  copied: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300',
  error: 'border-red-400/25 bg-red-400/10 text-red-400',
}

interface PortalLinkButtonProps {
  portalToken: string
}

export default function PortalLinkButton({ portalToken }: PortalLinkButtonProps) {
  const [copyState, setCopyState] = useState<CopyState>('idle')
  const timeoutRef = useRef<number | null>(null)

  useEffect(
    () => () => {
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current)
    },
    []
  )

  const handleCopy = async () => {
    const didCopy = await copyToClipboard(buildPortalUrl(portalToken))
    setCopyState(didCopy ? 'copied' : 'error')
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current)
    timeoutRef.current = window.setTimeout(() => {
      setCopyState('idle')
    }, FEEDBACK_MS)
  }

  const Icon =
    copyState === 'copied' ? Check : copyState === 'error' ? TriangleAlert : Link2

  return (
    <button
      type="button"
      onClick={() => void handleCopy()}
      aria-live="polite"
      className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${STATE_CLASS[copyState]}`}
    >
      <Icon aria-hidden className="h-3.5 w-3.5" />
      {STATE_LABEL[copyState]}
    </button>
  )
}
