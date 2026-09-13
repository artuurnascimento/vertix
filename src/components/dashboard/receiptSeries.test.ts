import { describe, expect, it } from 'vitest'
import { monthlyReceipts } from './receiptSeries'
import type { DashboardReceivable } from './useDashboardData'
const row = (overrides: Partial<DashboardReceivable>): DashboardReceivable => ({
  id: '1',
  descricao: 'Serviço',
  valor: 197,
  vencimento: '2026-01-10',
  status: 'pago',
  pago_em: '2026-02-03',
  project_id: 'project-1',
  ...overrides,
})
describe('monthlyReceipts', () => {
  it('uses the payment date, excludes pending and undated payments, and crosses the year boundary', () => {
    const series = monthlyReceipts(
      [
        row({}),
        row({ valor: 50, pago_em: '2025-12-30' }),
        row({ status: 'pendente', valor: 999 }),
        row({ pago_em: null, valor: 888 }),
      ],
      new Date(2026, 1, 15)
    )
    expect(series.map((m) => m.key)).toEqual([
      '2025-09',
      '2025-10',
      '2025-11',
      '2025-12',
      '2026-01',
      '2026-02',
    ])
    expect(series.map((m) => m.total)).toEqual([0, 0, 0, 50, 0, 197])
  })
})
