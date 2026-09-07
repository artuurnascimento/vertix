import { useId } from 'react'
import { Check, Plus } from 'lucide-react'
import { formatarCentavos } from './checkoutTotal'
import type { BumpCheckout } from './checkoutTypes'

interface Props {
  bump: BumpCheckout
  marcado: boolean
  onChange: (marcado: boolean) => void
}

/**
 * Oferta adicional marcável — o item de maior retorno da página.
 *
 * O destaque vem da forma (borda tracejada, fundo próprio, área clicável
 * inteira), não de gritaria: sem contagem falsa, sem "ÚLTIMA CHANCE". Título e
 * texto são os configurados pelo dono do checkout; aqui só damos moldura.
 *
 * O <label> envolve tudo, então o card inteiro é o alvo do clique — no celular
 * isso é a diferença entre marcar e errar o quadradinho.
 */
export default function OrderBump({ bump, marcado, onChange }: Props) {
  const id = useId()
  const descricaoId = `${id}-descricao`

  return (
    <label
      htmlFor={id}
      className={[
        'block cursor-pointer rounded-2xl border-2 border-dashed p-4 transition-colors duration-150 sm:p-5',
        marcado
          ? 'border-accent/70 bg-accent/10'
          : 'border-accent/35 bg-accent/[0.04] hover:border-accent/60',
        'focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent',
      ].join(' ')}
    >
      <div className="flex items-start gap-3">
        <span className="relative mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center">
          <input
            id={id}
            type="checkbox"
            checked={marcado}
            onChange={(e) => onChange(e.target.checked)}
            aria-describedby={bump.descricao ? descricaoId : undefined}
            className="peer h-5 w-5 appearance-none rounded border-2 border-accent/60 bg-transparent checked:border-accent checked:bg-accent"
          />
          <Check
            aria-hidden
            className="pointer-events-none absolute h-3.5 w-3.5 text-white opacity-0 peer-checked:opacity-100"
          />
        </span>

        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 text-[11px] font-medium uppercase tracking-[0.2em] text-accent">
            <Plus aria-hidden className="h-3 w-3" />
            Adicione ao pedido
          </p>
          <p className="mt-1.5 text-sm font-semibold leading-snug text-ink">
            {bump.titulo}
          </p>
          {bump.descricao && (
            <p
              id={descricaoId}
              className="mt-1.5 text-xs font-light leading-relaxed text-muted"
            >
              {bump.descricao}
            </p>
          )}
          <p className="mt-2.5 flex items-baseline gap-2">
            {bump.ancoraCentavos !== null && (
              <span className="text-xs font-light text-muted line-through">
                {formatarCentavos(bump.ancoraCentavos)}
              </span>
            )}
            <span className="text-base font-bold tabular-nums text-ink">
              + {formatarCentavos(bump.precoCentavos)}
            </span>
          </p>
        </div>
      </div>
    </label>
  )
}
