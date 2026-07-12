import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { CalendarClock } from 'lucide-react'
import {
  formatBRL,
  formatDateBR,
  getReceivableStatusMeta,
  isOverdue,
} from '../../lib/commercial'
import DashboardCard from './DashboardCard'
import { CardEmptyState, CardErrorState, CardSkeleton } from './CardStates'
import { useDashboardReceivables } from './useDashboardData'

/** Janela de vencimentos exibida (dias à frente), incluindo atrasados. */
const DUE_WINDOW_DAYS = 15
/** Vencendo em até 7 dias ganha destaque âmbar. */
const URGENT_DAYS = 7
const MAX_ITEMS = 6
const MS_PER_DAY = 86_400_000
const ROW_STAGGER_S = 0.04

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export default function UpcomingDues() {
  const { data: receivables, isLoading, isError } = useDashboardReceivables()

  const dues = useMemo(() => {
    const now = new Date()
    const limitKey = toDateKey(
      new Date(now.getTime() + DUE_WINDOW_DAYS * MS_PER_DAY)
    )
    const urgentKey = toDateKey(
      new Date(now.getTime() + URGENT_DAYS * MS_PER_DAY)
    )
    return (receivables ?? [])
      .filter((r) => r.status === 'pendente' && r.vencimento <= limitKey)
      .sort((a, b) => a.vencimento.localeCompare(b.vencimento))
      .slice(0, MAX_ITEMS)
      .map((r) => ({
        ...r,
        overdue: isOverdue(r.status, r.vencimento, now),
        urgent: r.vencimento <= urgentKey,
      }))
  }, [receivables])

  return (
    <DashboardCard
      title="Vencimentos próximos"
      subtitle={`Pendências dos próximos ${DUE_WINDOW_DAYS} dias`}
      action={{ label: 'ver financeiro', to: '/admin/financeiro' }}
    >
      {isLoading && <CardSkeleton rows={4} rowClassName="h-10" />}

      {isError && <CardErrorState />}

      {!isLoading && !isError && dues.length === 0 && (
        <CardEmptyState
          icon={CalendarClock}
          title="Nada vencendo por aqui"
          description={`Nenhuma cobrança pendente nos próximos ${DUE_WINDOW_DAYS} dias.`}
        />
      )}

      {!isLoading && !isError && dues.length > 0 && (
        <ul className="flex flex-col">
          {dues.map((due, index) => {
            const meta = getReceivableStatusMeta(due.status, due.vencimento)
            return (
              <motion.li
                key={due.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: index * ROW_STAGGER_S }}
                className="flex items-center justify-between gap-4 border-b border-white/5 py-3 first:pt-0 last:border-b-0 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm text-ink">{due.descricao}</p>
                  <p className="mt-0.5 flex items-center gap-2 text-xs font-light">
                    <span
                      className={
                        due.overdue
                          ? 'text-red-400'
                          : due.urgent
                            ? 'text-amber-300'
                            : 'text-muted'
                      }
                    >
                      vence {formatDateBR(due.vencimento)}
                    </span>
                    {due.overdue && (
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium ${meta.badgeClass}`}
                      >
                        {meta.label}
                      </span>
                    )}
                  </p>
                </div>
                <p className="shrink-0 font-kanit text-sm font-semibold text-ink">
                  {formatBRL(due.valor)}
                </p>
              </motion.li>
            )
          })}
        </ul>
      )}
    </DashboardCard>
  )
}
