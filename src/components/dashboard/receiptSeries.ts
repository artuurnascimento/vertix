import type { DashboardReceivable } from './useDashboardData'

/** Cash receipt date is authoritative; undated legacy payments cannot be assigned a month. */
export function monthlyReceipts(
  rows: readonly DashboardReceivable[],
  now: Date
) {
  return Array.from({ length: 6 }, (_, i) => {
    const date = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1)
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    return {
      key,
      label: date
        .toLocaleDateString('pt-BR', { month: 'short' })
        .replace('.', ''),
      total: rows
        .filter((r) => r.status === 'pago' && r.pago_em?.slice(0, 7) === key)
        .reduce((sum, r) => sum + r.valor, 0),
    }
  })
}
