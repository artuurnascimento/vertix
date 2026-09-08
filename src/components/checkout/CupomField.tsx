import { useState } from 'react'
import { Check, Loader2, Tag, X } from 'lucide-react'
import CartaoSecao from './CartaoSecao'
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
 * Campo de cupom. Card próprio, sempre visível: no desenho aprovado ele é uma
 * das quatro paradas do fluxo, e esconder atrás de um link fazia quem tinha
 * cupom procurar onde digitar.
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

  return (
    <CartaoSecao
      icone={<Tag className="h-3.5 w-3.5" />}
      titulo="Código do cupom"
      aside={
        <span className="text-xs font-light text-accent">
          {aplicado === null
            ? 'Tem um cupom de desconto?'
            : 'Desconto aplicado ao total'}
        </span>
      }
    >
      {aplicado !== null ? (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-3">
          <p className="flex min-w-0 items-center gap-2 text-sm text-emerald-200">
            <Check aria-hidden className="h-4 w-4 shrink-0" strokeWidth={3} />
            <span className="truncate font-semibold tracking-wide">
              {aplicado}
            </span>
            <span className="shrink-0 tabular-nums">
              − {formatarCentavos(descontoCentavos)}
            </span>
          </p>
          <button
            type="button"
            onClick={() => {
              onRemover()
              setCodigo('')
            }}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs text-emerald-200/80 transition-colors hover:text-emerald-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          >
            <X aria-hidden className="h-3.5 w-3.5" />
            Remover
          </button>
        </div>
      ) : (
        <>
          <label htmlFor="cupom-codigo" className="sr-only">
            Código do cupom
          </label>
          <div className="mt-4 flex gap-2.5">
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
              placeholder="Ex.: VERTIX10"
              className="min-w-0 flex-1 rounded-xl border border-white/10 bg-surface-2 px-4 py-3 text-sm uppercase tracking-wide text-ink transition-colors placeholder:normal-case placeholder:tracking-normal placeholder:text-muted/60 focus:border-accent/60 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
            />
            <button
              type="button"
              onClick={() => void aplicar()}
              disabled={validando || codigo.trim() === ''}
              className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-5 py-3 text-sm font-semibold text-ink transition-colors hover:border-accent/60 hover:bg-accent/10 disabled:opacity-40 disabled:hover:border-white/10 disabled:hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
            >
              {validando && (
                <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
              )}
              Aplicar
            </button>
          </div>
          {mensagem && (
            <p
              id="cupom-erro"
              role="alert"
              className="mt-2.5 text-xs text-amber-300"
            >
              {mensagem}
            </p>
          )}
        </>
      )}
    </CartaoSecao>
  )
}
