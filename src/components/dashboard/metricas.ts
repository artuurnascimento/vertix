import type {
  DashboardPedido,
  DashboardProposal,
} from './useDashboardData'

/**
 * Cálculos dos quatro cards do topo do painel — puros, sem React, para os
 * testes cobrirem cada regra sem montar nada.
 */

export interface PontoMensal {
  /** 'AAAA-MM'. */
  key: string
  /** 'set', 'out'… como o pt-BR abrevia. */
  label: string
  total: number
}

const MESES = 6

/**
 * Série dos últimos 6 meses (o atual incluído). `mesDe` devolve 'AAAA-MM'
 * — ou null para linhas sem data, que ficam de fora em vez de cair num mês
 * errado.
 */
export function serieMensal<T>(
  linhas: readonly T[],
  agora: Date,
  mesDe: (linha: T) => string | null | undefined,
  valorDe: (linha: T) => number
): PontoMensal[] {
  return Array.from({ length: MESES }, (_, i) => {
    const data = new Date(agora.getFullYear(), agora.getMonth() - (MESES - 1) + i, 1)
    const key = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`
    return {
      key,
      label: data.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''),
      total: linhas
        .filter((l) => mesDe(l) === key)
        .reduce((soma, l) => soma + valorDe(l), 0),
    }
  })
}

/** Variação em % contra o mês anterior, inteira; null sem base de comparação. */
export function variacaoPercentual(atual: number, anterior: number): number | null {
  if (anterior <= 0) return null
  return Math.round(((atual - anterior) / anterior) * 100)
}

/** Propostas enviadas, somadas pelo mês do envio (ou da criação, sem envio). */
export function negociacaoMensal(
  propostas: readonly DashboardProposal[],
  agora: Date
): PontoMensal[] {
  return serieMensal(
    propostas.filter((p) => p.status === 'enviada'),
    agora,
    (p) => (p.sent_at ?? p.created_at)?.slice(0, 7),
    (p) => p.valor_total
  )
}

/**
 * Planos vendidos: pedidos PAGOS do checkout próprio, contados pelo mês da
 * compra. `pedidos` não guarda a hora do pagamento; como o checkout cobra na
 * hora (cartão) ou em minutos (Pix), a criação é o mês certo.
 */
export function planosMensal(
  pedidos: readonly DashboardPedido[],
  agora: Date
): PontoMensal[] {
  return serieMensal(
    pedidos.filter((p) => p.status === 'pago'),
    agora,
    (p) => p.created_at.slice(0, 7),
    () => 1
  )
}

export interface DistribuicaoProjetos {
  /** Da captação ao desenvolvimento. */
  andamento: number
  revisao: number
  concluidos: number
}

const EM_ANDAMENTO = new Set([
  'lead',
  'briefing_enviado',
  'briefing_recebido',
  'em_desenvolvimento',
])

/**
 * As três fatias do donut. Um status desconhecido não entra em nenhuma —
 * melhor um projeto a menos no gráfico do que um contado no lugar errado.
 */
export function distribuicaoProjetos(status: readonly string[]): DistribuicaoProjetos {
  return status.reduce<DistribuicaoProjetos>(
    (d, s) => ({
      andamento: d.andamento + (EM_ANDAMENTO.has(s) ? 1 : 0),
      revisao: d.revisao + (s === 'revisao' ? 1 : 0),
      concluidos: d.concluidos + (s === 'entregue' ? 1 : 0),
    }),
    { andamento: 0, revisao: 0, concluidos: 0 }
  )
}
