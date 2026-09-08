import ReembolsoDialog from '../pedidos/ReembolsoDialog'
import type { ScanCompra } from './comprasData'

/**
 * Confirmação do reembolso de uma COMPRA do Vertix Scan.
 *
 * O diálogo em si (armadilha de foco, campo do valor digitado, botão que nasce
 * travado) é o ReembolsoDialog, o mesmo da tela de Pedidos — dois fluxos que
 * devolvem dinheiro não podem ter confirmações de forças diferentes por
 * descuido de cópia. O que este arquivo faz é traduzir uma `ScanCompra` no que
 * aquele diálogo precisa dizer.
 *
 * O que muda em relação ao pedido:
 *   • o produto é o Plano de Correção, e o que morre é o link /plano/:code —
 *     dito com essas palavras, porque é o link que o cliente tem no e-mail;
 *   • a reanálise cortesia de 30 dias vai junto, e quem só leu "reembolso"
 *     não pensaria nisso;
 *   • o nome do comprador pode não existir (compra sem lead casado), e aí o
 *     diálogo não pode dizer "para null".
 */

interface ScanReembolsoModalProps {
  /** null = fechado. A compra carrega tudo que a confirmação precisa dizer. */
  compra: ScanCompra | null
  isPending?: boolean
  erro?: string | null
  onConfirm: () => void
  onClose: () => void
}

export default function ScanReembolsoModal({
  compra,
  isPending = false,
  erro = null,
  onConfirm,
  onClose,
}: ScanReembolsoModalProps) {
  if (!compra) return null

  const jaEntregue = compra.plano_gerado_em !== null

  return (
    <ReembolsoDialog
      chave={compra.id}
      valorCentavos={compra.valor_centavos}
      // Compra sem lead casado não tem nome. "este comprador" é feio e é
      // honesto; inventar um nome numa tela de devolver dinheiro, não.
      nome={compra.comprador ?? 'este comprador'}
      contato={compra.email}
      acesso={
        <>
          O acesso ao Plano de Correção é{' '}
          <strong className="font-medium text-ink">revogado na hora</strong>
          {jaEntregue
            ? ' — e este plano já foi gerado: o link que o cliente recebeu por e-mail para de abrir.'
            : '. O link do plano para de abrir para ele.'}{' '}
          A reanálise de 30 dias também não acontece. Não tem como devolver o
          acesso depois.
        </>
      }
      aviso={
        compra.receivable_id
          ? 'A cobrança desta venda vira "cancelado" no Financeiro e sai da receita do mês.'
          : null
      }
      isPending={isPending}
      erro={erro}
      onConfirm={onConfirm}
      onClose={onClose}
    />
  )
}
