import { describe, expect, it } from 'vitest'
import {
  distribuicaoProjetos,
  negociacaoMensal,
  planosMensal,
  serieMensal,
  variacaoPercentual,
} from './metricas'
import type { DashboardPedido, DashboardProposal } from './useDashboardData'

const AGORA = new Date(2026, 8, 12) // 12 de setembro de 2026

const proposta = (o: Partial<DashboardProposal>): DashboardProposal => ({
  id: 'p',
  status: 'enviada',
  valor_total: 1000,
  sent_at: '2026-09-01T10:00:00Z',
  accepted_at: null,
  created_at: '2026-08-30T10:00:00Z',
  ...o,
})

const pedido = (o: Partial<DashboardPedido>): DashboardPedido => ({
  id: 'x',
  status: 'pago',
  created_at: '2026-09-05T10:00:00Z',
  total_centavos: 19700,
  ...o,
})

describe('serieMensal', () => {
  it('cobre os últimos 6 meses, cruzando o ano, e soma só o que cai em cada mês', () => {
    const serie = serieMensal(
      [
        { mes: '2026-02', valor: 10 },
        { mes: '2025-12', valor: 5 },
        { mes: null, valor: 999 },
        { mes: '2024-02', valor: 777 },
      ],
      new Date(2026, 1, 15),
      (r) => r.mes,
      (r) => r.valor
    )
    expect(serie.map((m) => m.key)).toEqual([
      '2025-09',
      '2025-10',
      '2025-11',
      '2025-12',
      '2026-01',
      '2026-02',
    ])
    expect(serie.map((m) => m.total)).toEqual([0, 0, 0, 5, 0, 10])
    expect(serie.map((m) => m.label)).toEqual(['set', 'out', 'nov', 'dez', 'jan', 'fev'])
  })
})

describe('variacaoPercentual', () => {
  it('compara com o mês anterior e fica sem base quando ele é zero', () => {
    expect(variacaoPercentual(24800, 22143)).toBe(12)
    expect(variacaoPercentual(900, 1000)).toBe(-10)
    expect(variacaoPercentual(500, 0)).toBeNull()
    expect(variacaoPercentual(0, 0)).toBeNull()
  })
})

describe('negociacaoMensal', () => {
  it('soma as propostas enviadas pelo mês do envio, ignorando as outras', () => {
    const serie = negociacaoMensal(
      [
        proposta({ valor_total: 300 }),
        proposta({ valor_total: 200, sent_at: '2026-09-20T00:00:00Z' }),
        // Sem sent_at: vale a criação.
        proposta({ valor_total: 50, sent_at: null, created_at: '2026-08-02T00:00:00Z' }),
        proposta({ valor_total: 9000, status: 'aceita' }),
        proposta({ valor_total: 9000, status: 'rascunho' }),
      ],
      AGORA
    )
    expect(serie.at(-1)?.total).toBe(500)
    expect(serie.at(-2)?.total).toBe(50)
  })
})

describe('planosMensal', () => {
  it('conta só pedidos pagos, pelo mês da compra', () => {
    const serie = planosMensal(
      [
        pedido({}),
        pedido({ id: 'y' }),
        pedido({ id: 'z', created_at: '2026-08-10T00:00:00Z' }),
        pedido({ id: 'w', status: 'aguardando' }),
        pedido({ id: 'v', status: 'reembolsado' }),
      ],
      AGORA
    )
    expect(serie.at(-1)?.total).toBe(2)
    expect(serie.at(-2)?.total).toBe(1)
  })
})

describe('distribuicaoProjetos', () => {
  it('separa em andamento, em revisão e concluídos; ativos = andamento + revisão', () => {
    const d = distribuicaoProjetos([
      'lead',
      'briefing_enviado',
      'briefing_recebido',
      'em_desenvolvimento',
      'revisao',
      'revisao',
      'entregue',
      'status_que_nao_existe',
    ])
    expect(d).toEqual({ andamento: 4, revisao: 2, concluidos: 1 })
  })
})
