import type { DashboardReceivable } from './useDashboardData'
import { serieMensal } from './metricas'
import type { PontoMensal } from './metricas'

/** Cash receipt date is authoritative; undated legacy payments cannot be assigned a month. */
export function monthlyReceipts(
  rows: readonly DashboardReceivable[],
  now: Date
): PontoMensal[] {
  return serieMensal(
    rows.filter((r) => r.status === 'pago'),
    now,
    (r) => r.pago_em?.slice(0, 7),
    (r) => r.valor
  )
}
