import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  Activity,
  ArrowRightLeft,
  Check,
  MessageSquare,
  Receipt,
  Send,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { formatRelativeTime } from '../../lib/format'
import DashboardCard from './DashboardCard'
import { CardEmptyState, CardErrorState, CardSkeleton } from './CardStates'
import { useDashboardActivity } from './useDashboardData'
import type { DashboardActivityEntry } from './useDashboardData'

interface ActivityVisual {
  icon: LucideIcon
  wrapClass: string
  iconClass: string
}

/** Vocabulário visual por tipo de activity_log — mesma paleta do detalhe do projeto. */
const ACTIVITY_VISUALS: Record<string, ActivityVisual> = {
  status_change: {
    icon: ArrowRightLeft,
    wrapClass: 'border-accent/25 bg-accent/10',
    iconClass: 'text-accent',
  },
  briefing_submitted: {
    icon: Check,
    wrapClass: 'border-emerald-400/25 bg-emerald-400/10',
    iconClass: 'text-emerald-300',
  },
  nota: {
    icon: MessageSquare,
    wrapClass: 'border-white/10 bg-white/5',
    iconClass: 'text-muted',
  },
  proposta: {
    icon: Send,
    wrapClass: 'border-sky-400/25 bg-sky-400/10',
    iconClass: 'text-sky-300',
  },
  financeiro: {
    icon: Receipt,
    wrapClass: 'border-amber-400/25 bg-amber-400/10',
    iconClass: 'text-amber-300',
  },
}

const DEFAULT_VISUAL: ActivityVisual = ACTIVITY_VISUALS.nota

const STAGGER_STEP_S = 0.05

function getActivityVisual(tipo: string): ActivityVisual {
  return ACTIVITY_VISUALS[tipo] ?? DEFAULT_VISUAL
}

function getAuthorLabel(entry: DashboardActivityEntry): string {
  if (entry.user_id === null) return 'Automático'
  return entry.profiles?.nome ?? 'Equipe'
}

/** Últimas 6 atividades globais — feed compacto com link para o módulo de projetos. */
export default function AtividadesCard() {
  const { data: entries, isLoading, isError } = useDashboardActivity()

  const hasEntries = (entries?.length ?? 0) > 0

  return (
    <DashboardCard
      title="Atividades recentes"
      subtitle="Últimos movimentos em todos os projetos"
      action={{ label: 'ver todas', to: '/admin/projetos' }}
    >
      {isLoading && <CardSkeleton rows={5} rowClassName="h-10" />}

      {isError && <CardErrorState />}

      {!isLoading && !isError && !hasEntries && (
        <CardEmptyState
          icon={Activity}
          title="Nenhuma atividade ainda"
          description="Mudanças de status, briefings e notas dos projetos aparecem aqui."
        />
      )}

      {!isLoading && !isError && hasEntries && (
        <ol className="flex flex-col">
          {(entries ?? []).map((entry, index) => {
            const visual = getActivityVisual(entry.tipo)
            const Icon = visual.icon
            const isLast = index === (entries?.length ?? 0) - 1
            return (
              <motion.li
                key={entry.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: index * STAGGER_STEP_S }}
                className="relative"
              >
                {!isLast && (
                  <span
                    aria-hidden
                    className="absolute left-4 top-9 h-[calc(100%-2.25rem)] w-px -translate-x-1/2 bg-white/5"
                  />
                )}
                <Link
                  to={`/admin/projetos/${entry.project_id}`}
                  className="group flex gap-3 rounded-lg pb-4 transition-colors duration-150 last:pb-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${visual.wrapClass}`}
                  >
                    <Icon className={`h-3.5 w-3.5 ${visual.iconClass}`} />
                  </span>
                  <span className="min-w-0 pt-1">
                    <span className="block truncate text-sm leading-relaxed text-ink transition-colors duration-150 group-hover:text-accent">
                      {entry.descricao}
                    </span>
                    <span className="mt-1 block text-xs font-light text-muted">
                      {getAuthorLabel(entry)}
                      {entry.projects?.nome ? ` · ${entry.projects.nome}` : ''}
                      {' · '}
                      {formatRelativeTime(entry.created_at)}
                    </span>
                  </span>
                </Link>
              </motion.li>
            )
          })}
        </ol>
      )}
    </DashboardCard>
  )
}
