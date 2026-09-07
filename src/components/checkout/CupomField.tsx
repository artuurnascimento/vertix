import { useState } from 'react'
import { Loader2, Tag, X } from 'lucide-react'
import { formatarCentavos } from './checkoutTotal'
import { validarCupom } from './checkoutApi'

import type { RespostaCupom } from './checkoutApi'

interface Props {
  slug: string
  /** Código já aplicado, ou null. */
  aplicado: string | null
  /** Estado atual do bump: o desconto percentual depende dele. */
  bumpMarcado: boolean
  onAplicar: (codigo: string, resposta: RespostaCupom) => void
  onRemover: () => void
  descontoCentavos: number
}

/**
 * Campo de cupom discreto: fica fechado até alguém clicar em "Tem um cupom?".
 * Quem não tem cupom não precisa ver um campo vazio sugerindo que está pagando
 * mais caro que os outros.
 *
 * Cupom inválido ou serviço fora do ar NUNCA trava o pagamento: a mensagem
 * aparece, o pedido segue pelo valor cheio.
 */
export default function CupomField({
  slug,
  aplicado,
  bumpMarcado,
  onAplicar,
  onRemover,
  descontoCentavos,
}: Props) {
  const [aberto, setAberto] = useState(false)
  const [codigo, setCodigo] = useState('')
  const [validando, setValidando] = useState(false)
  const [mensagem, setMensagem] = useState<string | null>(null)

  const aplicar = async () => {
    const limpo = codigo.trim()
    if (limpo === '' || validando) return

    setValidando(true)
    setMensagem(null)
    try {
      const resposta = await validarCupom(slug, limpo, bumpMarcado)
      if (resposta.valido) {
        onAplicar(limpo.toUpperCase(), resposta)
        setMensagem(null)
      } else {
        setMensagem(resposta.mensagem ?? 'Cupom inválido ou expirado.')
      }
    } catch {
      setMensagem('Não conseguimos validar o cupom agora. Siga sem ele.')
    } finally {
      setValidando(false)
    }
  }

  if (aplicado !== null) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-3">
        <p className="flex min-w-0 items-center gap-2 text-sm text-emerald-200">
          <Tag aria-hidden className="h-4 w-4 shrink-0" />
          <span className="truncate font-medium">{aplicado}</span>
          <span className="shrink-0 tabular-nums">
            − {formatarCentavos(descontoCentavos)}
          </span>
        </p>
        <button
          type="button"
          onClick={() => {
            onRemover()
            setCodigo('')
            setAberto(true)
          }}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs text-emerald-200/80 transition-colors hover:text-emerald-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        >
          <X aria-hidden className="h-3.5 w-3.5" />
          Remover
        </button>
      </div>
    )
  }

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="inline-flex items-center gap-1.5 text-xs font-light text-muted underline-offset-4 transition-colors hover:text-ink hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
      >
        <Tag aria-hidden className="h-3.5 w-3.5" />
        Tem um cupom?
      </button>
    )
  }

  return (
    <div>
      <label
        htmlFor="cupom-codigo"
        className="text-xs font-light text-muted"
      >
        Código do cupom
      </label>
      <div className="mt-1.5 flex gap-2">
        <input
          id="cupom-codigo"
          value={codigo}
          autoCapitalize="characters"
          autoComplete="off"
          aria-invalid={mensagem !== null}
          aria-describedby={mensagem ? 'cupom-erro' : undefined}
          onChange={(e) => setCodigo(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void aplicar()
            }
          }}
          placeholder="EX: VERTIX10"
          className="min-w-0 flex-1 rounded-xl border border-white/10 bg-surface-2 px-3 py-2.5 text-sm uppercase text-ink placeholder:normal-case placeholder:text-muted/60 focus:border-accent/60 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        />
        <button
          type="button"
          onClick={() => void aplicar()}
          disabled={validando || codigo.trim() === ''}
          className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-ink transition-colors hover:border-accent/50 disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        >
          {validando && <Loader2 aria-hidden className="h-4 w-4 animate-spin" />}
          Aplicar
        </button>
      </div>
      {mensagem && (
        <p id="cupom-erro" role="alert" className="mt-2 text-xs text-amber-300">
          {mensagem}
        </p>
      )}
    </div>
  )
}
