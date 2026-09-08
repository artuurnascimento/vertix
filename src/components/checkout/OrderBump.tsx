import { useId } from 'react'
import { Check, Plus } from 'lucide-react'
import { formatarCentavos } from './checkoutTotal'
import { textoDoBump } from './conteudoCheckout'
import type { BumpCheckout } from './checkoutTypes'

interface Props {
  bump: BumpCheckout
  marcado: boolean
  onChange: (marcado: boolean) => void
}

/**
 * Oferta adicional marcável — o bloco mais chamativo da página, e o primeiro
 * do fluxo. Borda roxa cheia e fundo arroxeado dão o destaque; a copy continua
 * sendo só a que o dono do checkout escreveu.
 *
 * A lista da direita é RECORTE do texto configurado (ver `textoDoBump`): quando
 * ele não se deixa quebrar em itens, a coluna some e o texto vira parágrafo.
 * Nenhum benefício é inventado para preencher espaço.
 *
 * O <label> envolve tudo, então o card inteiro é o alvo do clique — no celular
 * isso é a diferença entre marcar e errar o quadradinho.
 */
export default function OrderBump({ bump, marcado, onChange }: Props) {
  const id = useId()
  const descricaoId = `${id}-descricao`
  const { paragrafo, beneficios } = textoDoBump(bump.descricao)

  return (
    <label
      htmlFor={id}
      className={[
        'group relative block cursor-pointer overflow-hidden rounded-2xl border-2 p-4 transition-colors duration-150 sm:p-5',
        marcado
          ? 'border-accent bg-accent/[0.12]'
          : 'border-accent/60 bg-accent/[0.05] hover:border-accent hover:bg-accent/[0.09]',
        'focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent',
      ].join(' ')}
    >
      {/* Brilho de canto: dá volume ao card sem competir com o texto. */}
      <span
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-20 h-40 w-40 rounded-full bg-accent/20 blur-3xl"
      />

      <div className="relative grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-5">
        <div className="flex items-start gap-3.5">
          <span className="relative mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center">
            <input
              id={id}
              type="checkbox"
              checked={marcado}
              onChange={(e) => onChange(e.target.checked)}
              aria-describedby={paragrafo ? descricaoId : undefined}
              className="peer h-6 w-6 cursor-pointer appearance-none rounded-md border-2 border-accent/70 bg-transparent transition-colors checked:border-accent checked:bg-accent"
            />
            <Check
              aria-hidden
              strokeWidth={3}
              className="pointer-events-none absolute h-4 w-4 text-white opacity-0 transition-opacity peer-checked:opacity-100"
            />
          </span>

          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-accent">
              <Plus aria-hidden className="h-3 w-3" />
              Adicione ao pedido
            </p>
            <p className="mt-2 text-[15px] font-bold leading-snug text-ink sm:text-base">
              {bump.titulo}
            </p>
            {paragrafo && (
              <p
                id={descricaoId}
                className="mt-2 text-xs font-light leading-relaxed text-muted"
              >
                {paragrafo}
              </p>
            )}
            <p className="mt-3 flex flex-wrap items-baseline gap-2">
              {bump.ancoraCentavos !== null && (
                <>
                  <span className="text-xs font-light text-muted line-through">
                    {formatarCentavos(bump.ancoraCentavos)}
                  </span>
                  <span aria-hidden className="text-accent">
                    ·
                  </span>
                </>
              )}
              <span className="text-lg font-extrabold tabular-nums text-ink">
                {formatarCentavos(bump.precoCentavos)}
              </span>
            </p>
          </div>
        </div>

        {beneficios.length > 0 && (
          <ul className="flex flex-col justify-center gap-2.5 border-t border-accent/20 pt-4 sm:max-w-[15rem] sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0">
            {beneficios.map((beneficio, indice) => (
              <li
                key={`${beneficio}-${indice}`}
                className="flex items-start gap-2.5 text-xs font-light leading-snug text-ink/85"
              >
                <span
                  aria-hidden
                  className="mt-px flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-accent/25"
                >
                  <Check strokeWidth={3} className="h-2.5 w-2.5 text-accent" />
                </span>
                {beneficio}
              </li>
            ))}
          </ul>
        )}
      </div>
    </label>
  )
}
