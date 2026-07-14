import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { Banknote, CircleCheck, TriangleAlert, Wallet } from 'lucide-react'
import type { Tables } from '../../lib/database.types'
import { formatBRL, isOverdue } from '../../lib/commercial'

export type ReceivableRow = Tables<'receivables'> & {
  clients: Pick<Tables<'clients'>, 'id' | 'nome' | 'empresa' | 'telefone'> | null
  projects: Pick<Tables<'projects'>, 'id' | 'nome'> | null
}

const SKELETON_CARDS = 4

interface FinanceSummary {
  aReceber: number
  atrasado: number
  recebidoNoMes: number
  recebidoTotal: number
}

/** 'YYYY-MM' do mês corrente no fuso local. */
function currentMonthKey(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function computeSummary(rows: readonly ReceivableRow[]): FinanceSummary {
  const monthKey = currentMonthKey()
  let aReceber = 0
  let atrasado = 0
  let recebidoNoMes = 0
  let recebidoTotal = 0
  for (const row of rows) {
    if (row.status === 'pendente') {
      if (isOverdue(row.status, row.vencimento)) atrasado += row.valor
      else aReceber += row.valor
    }
    if (row.status === 'pago') {
      recebidoTotal += row.valor
      if (row.pago_em && row.pago_em.slice(0, 7) === monthKey) {
        recebidoNoMes += row.valor
      }
    }
  }
  return { aReceber, atrasado, recebidoNoMes, recebidoTotal }
}

interface SummaryCard {
  label: string
  value: number
  icon: ReactNode
  valueClass: string
}

function buildSummaryCards(summary: FinanceSummary): SummaryCard[] {
  return [
    {
      label: 'A receber',
      value: summary.aReceber,
      icon: <Wallet aria-hidden className="h-4 w-4 text-accent/80" />,
      valueClass: 'text-ink',
    },
    {
      label: 'Atrasado',
      value: summary.atrasado,
      icon: <TriangleAlert aria-hidden className="h-4 w-4 text-red-400/70" />,
      valueClass: summary.atrasado > 0 ? 'text-red-300' : 'text-ink',
    },
    {
      label: 'Recebido no mês',
      value: summary.recebidoNoMes,
      icon: <CircleCheck aria-hidden className="h-4 w-4 text-emerald-400/70" />,
      valueClass: 'text-emerald-300',
    },
    {
      label: 'Recebido total',
      value: summary.recebidoTotal,
      icon: <Banknote aria-hidden className="h-4 w-4 text-muted/60" />,
      valueClass: 'text-ink',
    },
  ]
}

interface ReceivablesSummaryCardsProps {
  receivables: readonly ReceivableRow[] | undefined
  isLoading: boolean
  isError: boolean
}

/** 4 cards de resumo do "A receber" — extraído para manter AReceberTab enxuto. */
export default function ReceivablesSummaryCards({
  receivables,
  isLoading,
  isError,
}: ReceivablesSummaryCardsProps) {
  const hasReceivables = (receivables?.length ?? 0) > 0
  const summaryCards = buildSummaryCards(computeSummary(receivables ?? []))

  if (isLoading) {
    return (
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: SKELETON_CARDS }, (_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-white/5 bg-surface-1 p-5"
          >
            <div className="h-3 w-24 animate-pulse rounded bg-surface-2" />
            <div className="mt-4 h-7 w-32 animate-pulse rounded bg-surface-2" />
          </div>
        ))}
      </div>
    )
  }

  if (isError || !hasReceivables) return null

  return (
    <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {summaryCards.map((card, index) => (
        <motion.div
          key={card.label}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: index * 0.05 }}
          className="rounded-2xl border border-white/5 bg-surface-1 p-5"
        >
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-medium uppercase tracking-widest text-muted/70">
              {card.label}
            </p>
            {card.icon}
          </div>
          <p
            className={`mt-3 font-kanit text-2xl font-semibold leading-none ${card.valueClass}`}
          >
            {formatBRL(card.value)}
          </p>
        </motion.div>
      ))}
    </div>
  )
}
