import { useEffect, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { urlDoCheckout } from './checkoutsData'

const AVISO_MS = 1600

/**
 * Mostra o endereço final da oferta (/c/<slug>) com botão de copiar — é o
 * link que a equipe manda para o cliente, então ele precisa estar visível
 * antes de salvar, não escondido no banco.
 */
export default function LinkCheckout({
  slug,
  compacto = false,
}: {
  slug: string
  compacto?: boolean
}) {
  const [copiado, setCopiado] = useState(false)

  useEffect(() => {
    if (!copiado) return
    const timer = window.setTimeout(() => setCopiado(false), AVISO_MS)
    return () => window.clearTimeout(timer)
  }, [copiado])

  if (slug.trim() === '') {
    return (
      <span className="text-xs font-light text-muted/70">
        O link aparece assim que o slug for preenchido.
      </span>
    )
  }

  const url = urlDoCheckout(slug)

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopiado(true)
    } catch {
      // Sem permissão de área de transferência: o link segue visível na tela.
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <code
        className={[
          'truncate rounded-md border border-white/5 bg-surface-2 px-2 py-1 font-mono text-xs text-muted',
          compacto ? 'max-w-[16rem]' : '',
        ].join(' ')}
      >
        /c/{slug}
      </code>
      <button
        type="button"
        onClick={copiar}
        title={`Copiar ${url}`}
        aria-label={`Copiar link do checkout ${slug}`}
        className="rounded-lg p-1.5 text-muted/70 transition-colors duration-150 hover:bg-white/5 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
      >
        {copiado ? (
          <Check aria-hidden className="h-3.5 w-3.5 text-emerald-400" />
        ) : (
          <Copy aria-hidden className="h-3.5 w-3.5" />
        )}
      </button>
      {copiado && <span className="text-xs text-emerald-400">Copiado</span>}
    </span>
  )
}
