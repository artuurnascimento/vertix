import { Quote, Star } from 'lucide-react'
import type { DepoimentoCheckout } from './checkoutTypes'

/**
 * Depoimentos vindos da configuração. Nenhum é escrito aqui: prova social
 * inventada é pior que nenhuma, porque é a primeira coisa que o comprador
 * confere. Lista vazia, seção inexistente.
 */
export default function Depoimentos({
  depoimentos,
}: {
  depoimentos: DepoimentoCheckout[]
}) {
  if (depoimentos.length === 0) return null

  return (
    <ul aria-label="Depoimentos" className="flex flex-col gap-3">
      {depoimentos.map((depoimento, indice) => (
        <li
          key={`${depoimento.nome}-${indice}`}
          className="rounded-2xl border border-white/[0.07] bg-surface-1/70 p-4"
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
              <span className="font-medium text-ink/80">{depoimento.nome}</span>
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
  )
}
