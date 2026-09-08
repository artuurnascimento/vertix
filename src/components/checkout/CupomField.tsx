import { useId, useState } from 'react'
import { Check, ChevronDown, Loader2, Tag, X } from 'lucide-react'
import Revelar from './Revelar'
import { formatarCentavos } from './checkoutTotal'
import { validarCupom } from './checkoutApi'

import type { MetodoPagamento } from './MetodoPagamento'
import type { RespostaCupom } from './checkoutApi'

interface Props {
  slug: string
  /** Código já aplicado, ou null. */
  aplicado: string | null
  /** Estado atual do bump: o desconto percentual depende dele. */
  bumpMarcado: boolean
  /** Método escolhido: o total do servidor depende dele também. */
  metodo: MetodoPagamento
  onAplicar: (codigo: string, resposta: RespostaCupom) => void
  onRemover: () => void
  descontoCentavos: number
}

/**
 * Campo de cupom escondido atrás de um clique.
 *
 * A caixa de cupom ABERTA é um dos vazamentos mais caros de um checkout: quem
 * não tem código vê um campo vazio, conclui que existe um desconto que só ele
 * não recebeu, e sai para o Google atrás dele. Muitos não voltam. Quem tem
 * cupom procura onde digitar de qualquer jeito — para esse, um toque a mais
 * não custa nada.
 *
 * Por isso o padrão é uma linha discreta. Ela vira `<button aria-expanded>` de
 * verdade: teclado abre com Enter/Espaço e o leitor de tela anuncia recolhido
 * ou expandido, o que uma div com onClick não faria.
 *
 * Cupom inválido ou serviço fora do ar NUNCA trava o pagamento: a mensagem
 * aparece, o pedido segue pelo valor cheio.
 */
export default function CupomField({
  slug,
  aplicado,
  bumpMarcado,
  metodo,
  onAplicar,
  onRemover,
  descontoCentavos,
}: Props) {
  const [aberto, setAberto] = useState(false)
  const [codigo, setCodigo] = useState('')
  const [validando, setValidando] = useState(false)
  const [mensagem, setMensagem] = useState<string | null>(null)
  const painelId = useId()

  const aplicar = async () => {
    const limpo = codigo.trim()
    if (limpo === '' || validando) return

    setValidando(true)
    setMensagem(null)
    try {
      const resposta = await validarCupom(slug, limpo, bumpMarcado, metodo)
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

  // Cupom aceito: a linha vira confirmação e o gatilho sai de cena. Esconder
  // um desconto que já pegou atrás de um clique seria esconder a boa notícia.
  if (aplicado !== null) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-3">
        <p className="flex min-w-0 items-center gap-2 text-sm text-emerald-200">
          <Check aria-hidden className="h-4 w-4 shrink-0" strokeWidth={3} />
          <span className="truncate font-semibold tracking-wide">{aplicado}</span>
          <span className="shrink-0 tabular-nums">
            − {formatarCentavos(descontoCentavos)}
          </span>
        </p>
        <button
          type="button"
          onClick={() => {
            onRemover()
            setCodigo('')
            setAberto(false)
          }}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs text-emerald-200/80 transition-colors hover:text-emerald-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        >
          <X aria-hidden className="h-3.5 w-3.5" />
          Remover
        </button>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-white/[0.07] bg-surface-1/60">
      <button
        type="button"
        aria-expanded={aberto}
        aria-controls={painelId}
        onClick={() => setAberto((atual) => !atual)}
        className="flex w-full items-center gap-2 rounded-xl px-4 py-3 text-left text-sm font-light text-muted transition-colors hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <Tag aria-hidden className="h-3.5 w-3.5 shrink-0 text-accent" />
        <span className="flex-1">Tem um cupom de desconto?</span>
        <ChevronDown
          aria-hidden
          className={[
            'h-4 w-4 shrink-0 transition-transform duration-200 motion-reduce:transition-none',
            aberto ? 'rotate-180' : '',
          ].join(' ')}
        />
      </button>

      <Revelar aberto={aberto} id={painelId}>
        <div className="px-4 pb-4">
          <label htmlFor="cupom-codigo" className="sr-only">
            Código do cupom
          </label>
          <div className="flex gap-2.5">
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
            <p id="cupom-erro" role="alert" className="mt-2.5 text-xs text-amber-300">
              {mensagem}
            </p>
          )}
        </div>
      </Revelar>
    </div>
  )
}
