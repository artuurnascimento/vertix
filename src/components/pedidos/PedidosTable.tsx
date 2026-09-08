import { Receipt } from 'lucide-react'
import PedidoLinha from './PedidoLinha'
import type { Pedido } from './pedidosData'

/**
 * Lista dos pedidos do checkout, no mesmo padrão visual da ScanComprasTable:
 * cartões empilhados em vez de `<table>`, porque a linha tem oito informações
 * e uma tabela real com oito colunas não cabe num celular sem virar rolagem
 * horizontal. O `flex-wrap` quebra os campos em duas ou três faixas na tela
 * estreita e mantém uma linha só no desktop.
 */

interface PedidosTableProps {
  pedidos: readonly Pedido[]
  temColunaReembolso: boolean
  onReembolsar: (pedido: Pedido) => void
  /** Só para o teste conseguir fixar "agora" ao julgar o atraso da entrega. */
  agora?: Date
}

export default function PedidosTable({
  pedidos,
  temColunaReembolso,
  onReembolsar,
  agora,
}: PedidosTableProps) {
  if (pedidos.length === 0) {
    return (
      <div className="rounded-xl border border-white/5 bg-surface-1 px-6 py-14 text-center">
        <Receipt aria-hidden className="mx-auto h-8 w-8 text-muted/50" />
        <p className="mt-3 text-sm font-light text-muted">
          Nenhum pedido neste período.
        </p>
        <p className="mt-1 text-xs font-light text-muted/70">
          Quando alguém comprar por um checkout, o pedido aparece aqui com o
          estado do pagamento e da entrega.
        </p>
      </div>
    )
  }

  return (
    <ul
      aria-label="Pedidos do checkout"
      className="flex list-none flex-col gap-3 p-0"
    >
      {pedidos.map((pedido) => (
        <PedidoLinha
          key={pedido.id}
          pedido={pedido}
          temColunaReembolso={temColunaReembolso}
          onReembolsar={onReembolsar}
          agora={agora}
        />
      ))}
    </ul>
  )
}
