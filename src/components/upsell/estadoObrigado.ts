/**
 * Estado de navegação entregue pela tela de upsell à tela de obrigado.
 *
 * Existe porque a confirmação precisa mostrar o que ACABOU de ser somado ao
 * pedido, e a leitura do pedido no banco pode não ter esse item ainda (ou nem
 * existir — ver checkoutDados.usePedido). É complemento, nunca fonte da
 * verdade: quem chega pelo e-mail não tem estado nenhum e a tela funciona.
 *
 * `location.state` é `unknown` e vem do histórico do navegador, que a pessoa
 * pode manipular. Por isso ele é LIDO com validação (lerEstadoObrigado) em vez
 * de sofrer um cast — nada aqui decide preço, mas texto errado na confirmação
 * gera chamado de suporte.
 */

import type { UpsellAceito } from './pedidoResumo'

export interface EstadoObrigado {
  upsellAceito?: UpsellAceito | null
  /** total_centavos devolvido pela edge function após cobrar o upsell. */
  totalCentavos?: number | null
}

function ehObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null
}

function lerUpsell(valor: unknown): UpsellAceito | null {
  if (!ehObjeto(valor)) return null
  const { produtoId, nome, precoCentavos } = valor
  if (typeof produtoId !== 'string' || typeof nome !== 'string') return null
  return {
    produtoId,
    nome,
    precoCentavos:
      typeof precoCentavos === 'number' && Number.isFinite(precoCentavos)
        ? precoCentavos
        : null,
  }
}

export function lerEstadoObrigado(estado: unknown): EstadoObrigado {
  if (!ehObjeto(estado)) return {}
  const total = estado.totalCentavos
  return {
    upsellAceito: lerUpsell(estado.upsellAceito),
    totalCentavos:
      typeof total === 'number' && Number.isFinite(total) ? total : null,
  }
}
