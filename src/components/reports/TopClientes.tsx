import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { Trophy } from 'lucide-react'
import { formatBRL } from '../../lib/commercial'
import DashboardCard from '../dashboard/DashboardCard'
import { CardEmptyState, CardErrorState, CardSkeleton } from '../dashboard/CardStates'
import { useReportReceivables } from './useReportsData'

const TOP_N = 5
const MIN_BAR_PERCENT = 4
const BAR_STAGGER_S = 0.05

interface ClienteReceita {
  id: string
  nome: string
  total: number
}

/** Top 5 clientes por receita já recebida (receivables pagas). */
export default function TopClientes() {
  const { data: receivables, isLoading, isError } = useReportReceivables()

  const top = useMemo((): ClienteReceita[] => {
    const totals = new Map<string, ClienteReceita>()
    for (const row of receivables ?? []) {
      if (row.status !== 'pago' || !row.clients) continue
      const existing = totals.get(row.clients.id)
      if (existing) {
        existing.total += row.valor
      } else {
        totals.set(row.clients.id, {
          id: row.clients.id,
          nome: row.clients.empresa
            ? `${row.clients.nome} · ${row.clients.empresa}`
            : row.clients.nome,
          total: row.valor,
        })
      }
    }
    return [...totals.values()].sort((a, b) => b.total - a.total).slice(0, TOP_N)
  }, [receivables])

  const maxTotal = Math.max(...top.map((c) => c.total), 1)

  return (
    <DashboardCard
      title="Top 5 clientes"
      subtitle="Maior receita já recebida"
    >
      {isLoading && <CardSkeleton rows={5} rowClassName="h-8" />}

      {isError && <CardErrorState />}

      {!isLoading && !isError && top.length === 0 && (
        <CardEmptyState
          icon={Trophy}
          title="Sem receita recebida"
          description="O ranking de clientes aparece assim que houver recebíveis pagas."
        />
      )}

      {!isLoading && !isError && top.length > 0 && (
        <ol className="flex flex-col gap-4">
          {top.map((cliente, index) => {
            const percent = Math.max((cliente.total / maxTotal) * 100, MIN_BAR_PERCENT)
            return (
              <li key={cliente.id}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="flex items-center gap-2 truncate text-sm text-ink/90">
                    <span className="font-kanit text-xs font-semibold text-muted/60">
                      {index + 1}
                    </span>
                    <span className="truncate">{cliente.nome}</span>
                  </span>
                  <span className="shrink-0 font-kanit text-sm font-semibold text-ink">
                    {formatBRL(cliente.total)}
                  </span>
                </div>
                <span className="mt-1.5 block h-2.5 overflow-hidden rounded-full bg-white/5">
                  <motion.span
                    initial={{ width: 0 }}
                    animate={{ width: `${percent}%` }}
                    transition={{
                      duration: 0.6,
                      ease: 'easeOut',
                      delay: index * BAR_STAGGER_S,
                    }}
                    className="block h-full rounded-full bg-gradient-to-r from-accent to-accent-2 opacity-80 shadow-[0_0_8px_rgba(108,91,242,0.45)]"
                  />
                </span>
              </li>
            )
          })}
        </ol>
      )}
    </DashboardCard>
  )
}
