import ReembolsoDialog from './ReembolsoDialog'
import { entregueEm, temRecebivel } from './pedidosResumo'
import type { Pedido } from './pedidosData'

/**
 * Confirmação do reembolso de um PEDIDO do checkout próprio.
 *
 * O diálogo em si (armadilha de foco, campo do valor, botão que nasce travado)
 * é o ReembolsoDialog, compartilhado com a aba de vendas do Scan — dois fluxos
 * que devolvem dinheiro não podem ter confirmações de forças diferentes por
 * descuido de cópia. O que este arquivo faz é traduzir um `Pedido` no que
 * aquele diálogo precisa dizer: quanto volta, para quem, o que exatamente para
 * de abrir e se o Financeiro fica com uma ponta solta.
 */

interface ReembolsoModalProps {
  /** null = fechado. O pedido carrega tudo que a confirmação precisa dizer. */
  pedido: Pedido | null
  isPending?: boolean
  erro?: string | null
  onConfirm: () => void
  onClose: () => void
}

export default function ReembolsoModal({
  pedido,
  isPending = false,
  erro = null,
  onConfirm,
  onClose,
}: ReembolsoModalProps) {
  if (!pedido) return null

  const jaEntregue = entregueEm(pedido) !== null

  return (
    <ReembolsoDialog
      chave={pedido.id}
      valorCentavos={pedido.total_centavos}
      nome={pedido.cliente_nome}
      contato={pedido.cliente_email}
      acesso={
        <>
          O acesso ao material é{' '}
          <strong className="font-medium text-ink">revogado na hora</strong>
          {jaEntregue
            ? ' — e este pedido já foi entregue: o link que o cliente tem em mãos para de abrir.'
            : '. O link do pedido para de abrir para ele.'}{' '}
          Não tem como devolver o acesso depois.
        </>
      }
      aviso={
        temRecebivel(pedido)
          ? 'Este pedido gerou recebível no Financeiro. O estorno não apaga a parcela — alguém precisa acertá-la à mão.'
          : null
      }
      isPending={isPending}
      erro={erro}
      onConfirm={onConfirm}
      onClose={onClose}
    />
  )
}
