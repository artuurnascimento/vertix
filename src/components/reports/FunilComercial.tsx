import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { Filter } from 'lucide-react'
import DashboardCard from '../dashboard/DashboardCard'
import { CardEmptyState, CardErrorState, CardSkeleton } from '../dashboard/CardStates'
import { useReportProjects, useReportProposals } from './useReportsData'

interface FunilEtapa {
  label: string
  count: number
  /** % de conversão em relação à etapa anterior — null na primeira etapa. */
  conversao: number | null
}

const BAR_STAGGER_S = 0.06
const MIN_BAR_PERCENT = 4

/** Funil: projetos criados → propostas enviadas → propostas aceitas. */
export default function FunilComercial() {
  const { data: projects, isLoading: loadingProjects, isError: errorProjects } =
    useReportProjects()
  const { data: proposals, isLoading: loadingProposals, isError: errorProposals } =
    useReportProposals()

  const isLoading = loadingProjects || loadingProposals
  const isError = errorProjects || errorProposals

  const etapas = useMemo((): FunilEtapa[] => {
    const totalProjetos = projects?.length ?? 0
    const enviadas = (proposals ?? []).filter((p) => p.sent_at !== null).length
    const aceitas = (proposals ?? []).filter((p) => p.status === 'aceita').length

    return [
      { label: 'Projetos criados', count: totalProjetos, conversao: null },
      {
        label: 'Propostas enviadas',
        count: enviadas,
        conversao: totalProjetos > 0 ? (enviadas / totalProjetos) * 100 : null,
      },
      {
        label: 'Propostas aceitas',
        count: aceitas,
        conversao: enviadas > 0 ? (aceitas / enviadas) * 100 : null,
      },
    ]
  }, [projects, proposals])

  const maxCount = Math.max(...etapas.map((e) => e.count), 1)
  const total = etapas[0]?.count ?? 0

  return (
    <DashboardCard
      title="Funil comercial"
      subtitle="Da criação do projeto até a proposta aceita"
    >
      {isLoading && <CardSkeleton rows={3} rowClassName="h-8" />}

      {isError && <CardErrorState />}

      {!isLoading && !isError && total === 0 && (
        <CardEmptyState
          icon={Filter}
          title="Sem projetos ainda"
          description="O funil comercial aparece assim que houver projetos e propostas cadastrados."
        />
      )}

      {!isLoading && !isError && total > 0 && (
        <ol className="flex flex-col gap-4">
          {etapas.map((etapa, index) => {
            const percent =
              etapa.count === 0
                ? 0
                : Math.max((etapa.count / maxCount) * 100, MIN_BAR_PERCENT)
            return (
              <li key={etapa.label}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm text-ink/90">{etapa.label}</span>
                  <span className="flex items-baseline gap-2">
                    {etapa.conversao !== null && (
                      <span className="text-xs font-light text-muted">
                        {etapa.conversao.toFixed(0)}%
                      </span>
                    )}
                    <span className="font-kanit text-sm font-semibold text-ink">
                      {etapa.count}
                    </span>
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
