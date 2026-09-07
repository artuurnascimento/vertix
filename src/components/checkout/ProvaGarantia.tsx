import { BadgeCheck, Quote, ShieldCheck, Star } from 'lucide-react'
import type { GarantiaCheckout, ProvaCheckout } from './checkoutTypes'

interface Props {
  prova: ProvaCheckout | null
  garantia: GarantiaCheckout | null
}

/**
 * Depoimentos, selos e garantia — tudo vindo da configuração do checkout.
 * Sem nada configurado, a seção inteira não existe: prova social inventada é
 * pior que nenhuma, porque é a primeira coisa que o comprador vai checar.
 */
export default function ProvaGarantia({ prova, garantia }: Props) {
  if (prova === null && garantia === null) return null

  return (
    <section aria-label="Garantia e depoimentos" className="flex flex-col gap-4">
      {garantia && (
        <div className="flex items-start gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.06] p-4 sm:p-5">
          <ShieldCheck
            aria-hidden
            className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300"
          />
          <div>
            <p className="text-sm font-semibold text-ink">
              Garantia de {garantia.dias}{' '}
              {garantia.dias === 1 ? 'dia' : 'dias'}
            </p>
            <p className="mt-1 text-xs font-light leading-relaxed text-muted">
              {garantia.texto ??
                `Não gostou? Peça o reembolso em até ${garantia.dias} ${
                  garantia.dias === 1 ? 'dia' : 'dias'
                } e devolvemos tudo, sem perguntas.`}
            </p>
          </div>
        </div>
      )}

      {prova && prova.depoimentos.length > 0 && (
        <ul className="flex flex-col gap-3">
          {prova.depoimentos.map((depoimento, indice) => (
            <li
              key={`${depoimento.nome}-${indice}`}
              className="rounded-2xl border border-white/5 bg-surface-1 p-4"
            >
              <Quote aria-hidden className="h-4 w-4 text-accent/70" />
              <p className="mt-2 text-sm font-light leading-relaxed text-ink/90">
                {depoimento.texto}
              </p>
              <div className="mt-3 flex items-center gap-2.5">
                {depoimento.fotoUrl && (
                  <img
                    src={depoimento.fotoUrl}
                    alt=""
                    width={28}
                    height={28}
                    className="h-7 w-7 rounded-full object-cover"
                  />
                )}
                {/* Nome e loja na mesma linha: a loja é o que dá lastro ao
                    depoimento para quem está decidindo a compra. */}
                <span className="min-w-0 text-xs text-muted">
                  <span className="font-medium text-ink/80">
                    {depoimento.nome}
                  </span>
                  {depoimento.loja && (
                    <span className="text-muted"> · {depoimento.loja}</span>
                  )}
                </span>
                {depoimento.nota !== null && (
                  <span
                    className="flex items-center gap-0.5"
                    aria-label={`Nota ${depoimento.nota} de 5`}
                  >
                    {Array.from({ length: depoimento.nota }, (_, i) => (
                      <Star
                        key={i}
                        aria-hidden
                        className="h-3 w-3 fill-amber-300 text-amber-300"
                      />
                    ))}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {prova && prova.selos.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {prova.selos.map((selo) => (
            <li
              key={selo}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-muted"
            >
              <BadgeCheck aria-hidden className="h-3.5 w-3.5 text-accent" />
              {selo}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
