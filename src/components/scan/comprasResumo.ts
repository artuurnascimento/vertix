import { formatBRL } from '../../lib/commercial'
import type { ScanCompra } from './comprasData'

/**
 * Contas e rótulos da visão de vendas do Vertix Scan. Funções PURAS — sem
 * rede, sem banco, sem React —, testadas em comprasResumo.test.ts e usadas
 * por ScanVendasTab.tsx e ScanComprasTable.tsx.
 */

/**
 * Quanto tempo depois do pagamento a entrega vira problema. O plano é gerado
 * pelo worker logo após o webhook confirmar o pagamento; passada uma hora sem
 * `plano_gerado_em` o cliente pagou e não recebeu — o estado mais grave que a
 * tela precisa denunciar.
 */
export const ATRASO_ENTREGA_MS = 60 * 60 * 1000

/** 19700 → "R$ 197,00". O banco guarda centavos; a tela mostra reais. */
export function formatCentavos(centavos: number): string {
  return formatBRL(centavos / 100)
}

export interface ResumoVendas {
  /** Compras com status 'pago' no período. */
  pagas: number
  /** Soma dos valores das compras pagas, em centavos. */
  receitaCentavos: number
  /** Checkouts abandonados: ainda em 'aguardando_pagamento'. */
  aguardando: number
}

export function resumoDasCompras(compras: ScanCompra[]): ResumoVendas {
  return compras.reduce<ResumoVendas>(
    (acc, c) => ({
      pagas: acc.pagas + (c.status === 'pago' ? 1 : 0),
      receitaCentavos:
        acc.receitaCentavos + (c.status === 'pago' ? c.valor_centavos : 0),
      aguardando: acc.aguardando + (c.status === 'aguardando_pagamento' ? 1 : 0),
    }),
    { pagas: 0, receitaCentavos: 0, aguardando: 0 }
  )
}

/**
 * Quantos leads do período viraram venda paga. É a taxa que decide se o
 * tráfego se paga. Sem lead nenhum no período não existe taxa — devolve "—"
 * em vez de 0%, que seria uma afirmação falsa sobre um funil vazio.
 */
export function taxaDeConversao(pagas: number, leads: number): string {
  if (leads <= 0) return '—'
  return `${((pagas / leads) * 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`
}

export type EstadoEntrega =
  | 'entregue'
  | 'recibo_pendente'
  | 'gerando'
  | 'atrasada'
  | 'sem_pagamento'

export interface EntregaMeta {
  estado: EstadoEntrega
  label: string
  className: string
  /** Pagou e não recebeu: a linha inteira ganha destaque de alerta. */
  alerta: boolean
}

/**
 * Em que pé está a entrega do plano. A referência de tempo é `pago_em`; nas
 * linhas antigas em que ele não foi preenchido caímos em `criado_em`, que no
 * checkout do Scan nasce segundos antes do pagamento.
 */
export function entregaDaCompra(
  compra: ScanCompra,
  agora: Date = new Date()
): EntregaMeta {
  if (compra.plano_gerado_em && compra.recibo_enviado_em) {
    return {
      estado: 'entregue',
      label: 'Entregue',
      className: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300',
      alerta: false,
    }
  }
  if (compra.plano_gerado_em) {
    return {
      estado: 'recibo_pendente',
      label: 'Plano ok, sem recibo',
      className: 'border-sky-400/25 bg-sky-400/10 text-sky-300',
      alerta: false,
    }
  }
  if (compra.status !== 'pago') {
    return {
      estado: 'sem_pagamento',
      label: 'Nada a entregar',
      className: 'border-white/10 text-muted',
      alerta: false,
    }
  }

  const referencia = new Date(compra.pago_em ?? compra.criado_em).getTime()
  const atrasada =
    !Number.isNaN(referencia) && agora.getTime() - referencia > ATRASO_ENTREGA_MS
  if (atrasada) {
    return {
      estado: 'atrasada',
      label: 'Pagou e não recebeu',
      className: 'border-red-400/40 bg-red-500/15 text-red-200',
      alerta: true,
    }
  }
  return {
    estado: 'gerando',
    label: 'Gerando plano',
    className: 'border-amber-400/25 bg-amber-400/10 text-amber-300',
    alerta: false,
  }
}

/** Pill do status da compra — os quatro do check constraint da tabela. */
export function compraStatusMeta(status: string): {
  label: string
  className: string
} {
  const meta: Record<string, { label: string; className: string }> = {
    pago: {
      label: 'Pago',
      className: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300',
    },
    aguardando_pagamento: {
      label: 'Aguardando pagamento',
      className: 'border-amber-400/25 bg-amber-400/10 text-amber-300',
    },
    cancelado: {
      label: 'Cancelado',
      className: 'border-white/10 bg-white/5 text-muted',
    },
    reembolsado: {
      label: 'Reembolsado',
      className: 'border-red-400/25 bg-red-400/10 text-red-300',
    },
  }
  return (
    meta[status] ?? { label: status, className: 'border-white/10 bg-white/5 text-muted' }
  )
}

/** O bônus só está completo com os DOIS concorrentes informados. */
export function concorrentesInformados(compra: ScanCompra): boolean {
  return (compra.concorrentes ?? []).filter((c) => c.trim() !== '').length >= 2
}
