import { PackageCheck } from 'lucide-react'
import { formatarCentavos } from './upsellFluxo'
import { rotuloDoTipo } from './pedidoResumo'
import type { PedidoResumo } from './pedidoResumo'

/**
 * O que foi comprado, com o total. Cada linha diz de onde veio (produto, item
 * adicional, adicionado depois) para que o upsell aceito na tela anterior
 * apareça explicitamente — a pessoa precisa reconhecer no extrato do cartão o
 * que ela vê aqui.
 */
export function ResumoPedido({ resumo }: { resumo: PedidoResumo }) {
  if (resumo.itens.length === 0) {
    return (
      <section
        aria-label="Resumo do pedido"
        className="mt-5 rounded-2xl border border-white/5 bg-surface-1 p-5 text-sm font-light leading-relaxed text-muted sm:p-6"
      >
        O detalhamento completo do seu pedido vai no e-mail de confirmação.
      </section>
    )
  }

  return (
    <section
      aria-label="Resumo do pedido"
      className="mt-5 rounded-2xl border border-white/5 bg-surface-1 p-5 sm:p-6"
    >
      <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-muted">
        <PackageCheck aria-hidden className="h-4 w-4 text-accent" />
        Seu pedido
      </h2>

      <ul className="mt-4 flex flex-col divide-y divide-white/5">
        {resumo.itens.map((item) => (
          <li
            key={`${item.tipo}-${item.id}`}
            className="flex items-baseline justify-between gap-4 py-3 first:pt-0"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink">{item.nome}</p>
              <p className="mt-0.5 text-xs font-light text-muted">
                {rotuloDoTipo(item.tipo)}
              </p>
            </div>
            <p className="shrink-0 text-sm tabular-nums text-ink">
              {formatarCentavos(item.precoCentavos)}
            </p>
          </li>
        ))}
      </ul>

      <div className="mt-1 flex items-baseline justify-between gap-4 border-t border-white/10 pt-4">
        <p className="text-sm font-medium text-muted">Total pago</p>
        <p className="text-2xl font-bold tabular-nums text-ink">
          {formatarCentavos(resumo.totalCentavos)}
        </p>
      </div>

      {resumo.parcial && (
        <p className="mt-3 text-xs font-light leading-relaxed text-muted">
          Este resumo foi montado a partir desta sessão. O e-mail de confirmação
          traz o detalhamento oficial do pedido.
        </p>
      )}
    </section>
  )
}
