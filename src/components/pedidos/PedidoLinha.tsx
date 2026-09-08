import { AlertTriangle, RotateCcw } from 'lucide-react'
import { formatRelativeTime } from '../../lib/format'
import {
  METODO_LABEL,
  dataHora,
  entregaDoPedido,
  formatCentavos,
  metodoDoPedido,
  pedidoStatusMeta,
  podeReembolsar,
  resumoDosItens,
  temRecebivel,
} from './pedidosResumo'
import type { Pedido } from './pedidosData'

/**
 * Uma linha da lista de pedidos.
 *
 * A ordem do que aparece é a ordem em que a pessoa decide um reembolso: quem
 * é o cliente, o que ele comprou, quanto pagou, em que estado está o pedido e
 * se o material já saiu. O rodapé só existe quando há algo a ponderar
 * (recebível no Financeiro, reembolso já feito, código do pagamento).
 */

interface PedidoLinhaProps {
  pedido: Pedido
  /** Ausente quando a coluna reembolsado_em ainda não existe no ambiente. */
  temColunaReembolso: boolean
  onReembolsar: (pedido: Pedido) => void
  /** Só para o teste conseguir fixar "agora" ao julgar o atraso da entrega. */
  agora?: Date
}

export default function PedidoLinha({
  pedido,
  temColunaReembolso,
  onReembolsar,
  agora,
}: PedidoLinhaProps) {
  const status = pedidoStatusMeta(pedido.status)
  const entrega = entregaDoPedido(pedido, agora)
  const metodo = METODO_LABEL[metodoDoPedido(pedido)]
  const comRecebivel = temRecebivel(pedido)
  const reembolsadoEm = pedido.reembolsado_em
  const rodape =
    comRecebivel || reembolsadoEm !== null || pedido.origem !== null

  return (
    <li
      className={
        entrega.alerta
          ? 'rounded-xl border border-red-400/40 bg-red-500/10'
          : 'rounded-xl border border-white/5 bg-surface-1'
      }
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-4 sm:px-5">
        <div className="min-w-0 flex-1 basis-56">
          <p className="truncate text-sm font-medium text-ink">
            {pedido.cliente_nome}
          </p>
          <p className="mt-0.5 truncate text-xs font-light text-muted">
            {pedido.cliente_email}
          </p>
        </div>

        <div className="min-w-0 flex-1 basis-48">
          <p className="truncate text-sm font-light text-ink">
            {resumoDosItens(pedido)}
          </p>
          {pedido.checkout_titulo && (
            <p className="mt-0.5 truncate text-xs font-light text-muted">
              {pedido.checkout_titulo}
            </p>
          )}
        </div>

        <div className="shrink-0">
          <span className="block tabular-nums text-sm font-semibold text-ink">
            {formatCentavos(pedido.total_centavos)}
          </span>
          <span className="block text-xs font-light text-muted">{metodo}</span>
        </div>

        <span
          className={`inline-flex shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${status.className}`}
        >
          {status.label}
        </span>

        <span
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${entrega.className}`}
          title={
            pedido.entregue_em || pedido.plano_gerado_em
              ? `Entregue em ${dataHora(pedido.entregue_em ?? pedido.plano_gerado_em ?? '')}`
              : undefined
          }
        >
          {entrega.alerta && <AlertTriangle aria-hidden className="h-3 w-3" />}
          {entrega.label}
        </span>

        <span
          className="shrink-0 tabular-nums text-xs font-light text-muted"
          title={dataHora(pedido.criado_em)}
        >
          {formatRelativeTime(pedido.criado_em)}
        </span>

        {podeReembolsar(pedido) && (
          <button
            type="button"
            onClick={() => onReembolsar(pedido)}
            className="ml-auto inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg border border-red-400/30 px-3 py-1.5 text-xs font-medium text-red-300 transition-colors duration-150 hover:bg-red-500/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-400"
          >
            <RotateCcw aria-hidden className="h-3.5 w-3.5" />
            Reembolsar
            <span className="sr-only">
              {` ${formatCentavos(pedido.total_centavos)} de ${pedido.cliente_nome}`}
            </span>
          </button>
        )}
      </div>

      {rodape && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-white/5 px-4 py-2.5 text-[11px] font-light text-muted sm:px-5">
          {reembolsadoEm !== null && (
            <span className="text-red-300">
              {`Reembolsado em ${dataHora(reembolsadoEm)}`}
            </span>
          )}
          {reembolsadoEm === null && pedido.status === 'reembolsado' && !temColunaReembolso && (
            <span className="text-red-300">Reembolsado (data não registrada)</span>
          )}
          {comRecebivel && (
            <>
              {reembolsadoEm !== null && <span aria-hidden className="h-3 w-px bg-white/10" />}
              <span>Gerou recebível no Financeiro</span>
            </>
          )}
          {pedido.origem && (
            <>
              {(comRecebivel || reembolsadoEm !== null) && (
                <span aria-hidden className="h-3 w-px bg-white/10" />
              )}
              <span>{`Origem: ${pedido.origem}`}</span>
            </>
          )}
        </div>
      )}
    </li>
  )
}
