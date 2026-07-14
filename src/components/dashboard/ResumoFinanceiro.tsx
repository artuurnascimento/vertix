import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
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

interface ExpenseRow {
  valor: number
  data: string
}

/** 'YYYY-MM' do mês corrente no fuso local. */
function currentMonthKey(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

/** Query própria do card (chave ['dashboard','expenses']) — não mexe em useDashboardData.ts. */
function useDashboardExpenses() {
  return useQuery({
    queryKey: ['dashboard', 'expenses'],
    queryFn: async (): Promise<ExpenseRow[]> => {
      const { data, error } = await supabase.from('expenses').select('valor, data')
      if (error) throw new Error(error.message)
      return data
    },
  })
}

/** Faturamento (propostas aceitas) / Recebido (pagas) / Pendente / Despesas do mês / Resultado. */
export default function ResumoFinanceiro() {
  const proposals = useDashboardProposals()
  const receivables = useDashboardReceivables()
  const expenses = useDashboardExpenses()

  const isLoading =
    proposals.isLoading || receivables.isLoading || expenses.isLoading
  const isError = proposals.isError || receivables.isError || expenses.isError

  const rows = useMemo<SummaryRow[]>(() => {
    const monthKey = currentMonthKey()

    const faturamento = (proposals.data ?? [])
      .filter((p) => p.status === 'aceita')
      .reduce((sum, p) => sum + p.valor_total, 0)

    const recebido = (receivables.data ?? [])
      .filter((r) => r.status === 'pago')
      .reduce((sum, r) => sum + r.valor, 0)

    const pendente = (receivables.data ?? [])
      .filter((r) => r.status === 'pendente')
      .reduce((sum, r) => sum + r.valor, 0)

    const recebidoNoMes = (receivables.data ?? [])
      .filter(
        (r) =>
          r.status === 'pago' && r.pago_em && r.pago_em.slice(0, 7) === monthKey
      )
      .reduce((sum, r) => sum + r.valor, 0)

    const despesasNoMes = (expenses.data ?? [])
      .filter((e) => e.data.slice(0, 7) === monthKey)
      .reduce((sum, e) => sum + e.valor, 0)

    const resultado = recebidoNoMes - despesasNoMes

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
      {
        key: 'despesas',
        label: 'Despesas do mês',
        value: despesasNoMes,
        valueClass: 'text-red-300',
      },
      {
        key: 'resultado',
        label: 'Resultado',
        value: resultado,
        valueClass: resultado >= 0 ? 'text-emerald-300' : 'text-red-300',
      },
    ]
  }, [proposals.data, receivables.data, expenses.data])

  return (
    <DashboardCard
      title="Resumo financeiro"
      subtitle="Consolidado de propostas e recebíveis"
      action={{ label: 'ver financeiro', to: '/admin/financeiro' }}
      variant="shallow"
    >
      {isLoading && <CardSkeleton rows={3} rowClassName="h-14" />}

      {isError && <CardErrorState />}

      {!isLoading && !isError && (
        <div className="grid grid-cols-2 divide-white/5 sm:grid-cols-3 lg:grid-cols-5 lg:divide-x">
          {rows.map((row) => (
            <div key={row.key} className="px-4 py-1 first:pl-0 sm:px-5">
              <p className="truncate text-[11px] font-medium uppercase tracking-widest text-muted">
                {row.label}
              </p>
              <AnimatedNumber
                value={row.value}
                format={formatBRL}
                className={`mt-1.5 block font-kanit text-xl font-bold leading-none tabular-nums sm:text-2xl ${row.valueClass}`}
              />
            </div>
          ))}
        </div>
      )}
    </DashboardCard>
  )
}
