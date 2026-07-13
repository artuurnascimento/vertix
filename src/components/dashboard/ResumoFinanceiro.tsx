import { useMemo } from 'react'
import { formatBRL } from '../../lib/commercial'
import AnimatedNumber from './AnimatedNumber'
import DashboardCard from './DashboardCard'
import { CardErrorState, CardSkeleton } from './CardStates'
import { useDashboardProposals, useDashboardReceivables } from './useDashboardData'

interface SummaryRow {
  key: string
  label: string
  value: number
  valueClass: string
}

/** Faturamento (propostas aceitas) / Recebido (pagas) / Pendente (pendentes + atrasadas). */
export default function ResumoFinanceiro() {
  const proposals = useDashboardProposals()
  const receivables = useDashboardReceivables()

  const isLoading = proposals.isLoading || receivables.isLoading
  const isError = proposals.isError || receivables.isError

  const rows = useMemo<SummaryRow[]>(() => {
    const faturamento = (proposals.data ?? [])
      .filter((p) => p.status === 'aceita')
      .reduce((sum, p) => sum + p.valor_total, 0)

    const recebido = (receivables.data ?? [])
      .filter((r) => r.status === 'pago')
      .reduce((sum, r) => sum + r.valor, 0)

    const pendente = (receivables.data ?? [])
      .filter((r) => r.status === 'pendente')
      .reduce((sum, r) => sum + r.valor, 0)

    return [
      {
        key: 'faturamento',
        label: 'Faturamento',
        value: faturamento,
        valueClass: 'text-ink',
      },
      {
        key: 'recebido',
        label: 'Recebido',
        value: recebido,
        valueClass: 'text-emerald-300',
      },
      {
        key: 'pendente',
        label: 'Pendente',
        value: pendente,
        valueClass: 'text-amber-300',
      },
    ]
  }, [proposals.data, receivables.data])

  return (
    <DashboardCard
      title="Resumo financeiro"
      subtitle="Consolidado de propostas e recebíveis"
      action={{ label: 'ver financeiro', to: '/admin/financeiro' }}
    >
      {isLoading && <CardSkeleton rows={3} rowClassName="h-14" />}

      {isError && <CardErrorState />}

      {!isLoading && !isError && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {rows.map((row) => (
            <div
              key={row.key}
              className="rounded-xl border border-white/5 bg-surface-2 px-4 py-4"
            >
              <p className="text-[11px] font-medium uppercase tracking-widest text-muted/70">
                {row.label}
              </p>
              <AnimatedNumber
                value={row.value}
                format={formatBRL}
                className={`mt-2 block font-kanit text-xl font-bold leading-none sm:text-2xl ${row.valueClass}`}
              />
            </div>
          ))}
        </div>
      )}
    </DashboardCard>
  )
}
