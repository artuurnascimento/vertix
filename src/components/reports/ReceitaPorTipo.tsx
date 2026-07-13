import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { PieChart } from 'lucide-react'
import { formatBRL } from '../../lib/commercial'
import { getTipoServicoMeta } from '../../lib/format'
import DashboardCard from '../dashboard/DashboardCard'
import { CardEmptyState, CardErrorState, CardSkeleton } from '../dashboard/CardStates'
import { useReportReceivables } from './useReportsData'

const TIPO_ORDER = ['ecommerce', 'sistema', 'site'] as const
const MIN_BAR_PERCENT = 4
const BAR_STAGGER_S = 0.06

interface TipoReceita {
  tipo: string
  label: string
  total: number
}

/** Receita já recebida (receivables pagas), agrupada pelo tipo_servico do projeto. */
export default function ReceitaPorTipo() {
  const { data: receivables, isLoading, isError } = useReportReceivables()

  const { rows, maxTotal, total } = useMemo(() => {
    const pagas = (receivables ?? []).filter((r) => r.status === 'pago')
    const totals = new Map<string, number>()
    for (const row of pagas) {
      const tipo = row.projects?.tipo_servico ?? 'outro'
      totals.set(tipo, (totals.get(tipo) ?? 0) + row.valor)
    }

    const knownTipos = TIPO_ORDER.filter((tipo) => totals.has(tipo))
    const otherTipos = [...totals.keys()].filter(
      (tipo) => !TIPO_ORDER.includes(tipo as (typeof TIPO_ORDER)[number])
    )
    const orderedTipos = [...knownTipos, ...otherTipos]

    const rows: TipoReceita[] = orderedTipos.map((tipo) => ({
      tipo,
      label: getTipoServicoMeta(tipo).label,
      total: totals.get(tipo) ?? 0,
    }))

    const total = pagas.reduce((sum, r) => sum + r.valor, 0)
    const maxTotal = Math.max(...rows.map((r) => r.total), 1)

    return { rows, maxTotal, total }
  }, [receivables])

  return (
    <DashboardCard
      title="Receita por tipo de serviço"
      subtitle="Recebíveis pagas, agrupadas pelo tipo do projeto"
    >
      {isLoading && <CardSkeleton rows={3} rowClassName="h-8" />}

      {isError && <CardErrorState />}

      {!isLoading && !isError && total === 0 && (
        <CardEmptyState
          icon={PieChart}
          title="Sem receita recebida"
          description="Assim que houver recebíveis pagas, a distribuição por tipo aparece aqui."
        />
      )}

      {!isLoading && !isError && total > 0 && (
        <ol className="flex flex-col gap-4">
          {rows.map((row, index) => {
            const percent =
              row.total === 0
                ? 0
                : Math.max((row.total / maxTotal) * 100, MIN_BAR_PERCENT)
            return (
              <li key={row.tipo}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm text-ink/90">{row.label}</span>
                  <span className="font-kanit text-sm font-semibold tabular-nums text-ink">
                    {formatBRL(row.total)}
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
                    className="block h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 opacity-80 shadow-[0_0_8px_rgba(52,211,153,0.4)]"
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
