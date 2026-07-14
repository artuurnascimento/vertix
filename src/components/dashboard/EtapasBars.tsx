import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { FolderKanban } from 'lucide-react'
import { PROJECT_STATUS, PROJECT_STATUS_ORDER } from '../../lib/format'
import DashboardCard from './DashboardCard'
import { CardEmptyState, CardErrorState, CardSkeleton } from './CardStates'
import { useDashboardProjects } from './useDashboardData'

const BAR_STAGGER_S = 0.05
const BAR_DURATION_S = 0.6
/** Barra mínima visível quando a etapa tem ao menos 1 projeto. */
const MIN_BAR_PERCENT = 4

/** Projetos por etapa do kanban — barras horizontais com contagem real. */
export default function EtapasBars() {
  const navigate = useNavigate()
  const { data: projects, isLoading, isError } = useDashboardProjects()

  const stages = useMemo(() => {
    const rows = projects ?? []
    return PROJECT_STATUS_ORDER.map((status) => ({
      status,
      meta: PROJECT_STATUS[status],
      count: rows.filter((p) => p.status === status).length,
    }))
  }, [projects])

  const total = stages.reduce((sum, s) => sum + s.count, 0)
  const maxCount = Math.max(...stages.map((s) => s.count), 1)

  return (
    <DashboardCard
      title="Projetos por etapa"
      subtitle={
        total > 0
          ? `${total} projeto${total === 1 ? '' : 's'} no pipeline`
          : 'Distribuição por etapa do kanban'
      }
      action={{ label: 'ver board', to: '/admin/projetos' }}
      variant="shallow"
    >
      {isLoading && <CardSkeleton rows={6} rowClassName="h-7" />}

      {isError && <CardErrorState />}

      {!isLoading && !isError && total === 0 && (
        <CardEmptyState
          icon={FolderKanban}
          title="Pipeline vazio"
          description="Crie o primeiro projeto para acompanhar as etapas por aqui."
        />
      )}

      {!isLoading && !isError && total > 0 && (
        <ol className="flex flex-col gap-3">
          {stages.map((stage, index) => {
            const percent =
              stage.count === 0
                ? 0
                : Math.max((stage.count / maxCount) * 100, MIN_BAR_PERCENT)
            return (
              <li key={stage.status}>
                <button
                  type="button"
                  onClick={() => navigate('/admin/projetos')}
                  aria-label={`${stage.meta.label}: ${stage.count} projeto${
                    stage.count === 1 ? '' : 's'
                  } — abrir board`}
                  className="group flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors duration-150 hover:bg-white/[0.03] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  <span className="flex w-32 shrink-0 items-center gap-2 sm:w-36">
                    <span
                      aria-hidden
                      className={`h-2 w-2 shrink-0 rounded-full ${stage.meta.dotClass}`}
                    />
                    <span className="truncate text-xs text-ink/90 transition-colors duration-150 group-hover:text-ink sm:text-sm">
                      {stage.meta.label}
                    </span>
                  </span>
                  <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-white/5">
                    <motion.span
                      initial={{ width: 0 }}
                      animate={{ width: `${percent}%` }}
                      transition={{
                        duration: BAR_DURATION_S,
                        ease: 'easeOut',
                        delay: index * BAR_STAGGER_S,
                      }}
                      className="block h-full rounded-full bg-gradient-to-r from-accent to-accent-2 opacity-80 shadow-[0_0_8px_rgba(108,91,242,0.45)] transition-opacity duration-150 group-hover:opacity-100"
                    />
                  </span>
                  <span className="w-6 shrink-0 text-right font-kanit text-sm font-semibold tabular-nums text-ink">
                    {stage.count}
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
      )}
    </DashboardCard>
  )
}
