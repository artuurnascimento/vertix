import { motion } from 'framer-motion'
import { ArrowRightLeft, Check, MessageSquare } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { Tables } from '../../lib/database.types'
import { formatRelativeTime } from '../../lib/format'

type ActivityEntry = Tables<'activity_log'> & {
  profiles: Pick<Tables<'profiles'>, 'nome'> | null
}

interface ActivityVisual {
  icon: LucideIcon
  /** Classe do círculo do ícone (borda + fundo). */
  wrapClass: string
  /** Cor do ícone em si. */
  iconClass: string
}

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
}

const DEFAULT_VISUAL: ActivityVisual = ACTIVITY_VISUALS.nota

const STAGGER_STEP_S = 0.04
const STAGGER_MAX_S = 0.4

function getActivityVisual(tipo: string): ActivityVisual {
  return ACTIVITY_VISUALS[tipo] ?? DEFAULT_VISUAL
}

function getAuthorLabel(entry: ActivityEntry): string {
  if (entry.user_id === null) return 'Automático'
  return entry.profiles?.nome ?? 'Equipe'
}

interface ActivityTimelineProps {
  projectId: string
}

export default function ActivityTimeline({ projectId }: ActivityTimelineProps) {
  const {
    data: entries,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['activity', projectId],
    queryFn: async (): Promise<ActivityEntry[]> => {
      const { data, error } = await supabase
        .from('activity_log')
        .select('*, profiles(nome)')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
      if (error) throw new Error(error.message)
      return data
    },
  })

  if (isLoading) {
    return (
      <div aria-label="Carregando atividade" className="flex flex-col gap-4">
        <div className="h-10 animate-pulse rounded-xl bg-surface-2" />
        <div className="h-10 animate-pulse rounded-xl bg-surface-2" />
      </div>
    )
  }

  if (isError) {
    return (
      <p className="text-sm font-light text-red-400" role="alert">
        Não foi possível carregar a atividade. Recarregue a página.
      </p>
    )
  }

  if (!entries || entries.length === 0) {
    return (
      <p className="text-sm font-light text-muted">Nenhuma atividade ainda.</p>
    )
  }

  return (
    <ol className="flex flex-col">
      {entries.map((entry, index) => {
        const visual = getActivityVisual(entry.tipo)
        const Icon = visual.icon
        const isLast = index === entries.length - 1
        return (
          <motion.li
            key={entry.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.25,
              delay: Math.min(index * STAGGER_STEP_S, STAGGER_MAX_S),
            }}
            className="relative flex gap-4 pb-6 last:pb-0"
          >
            {/* Linha conectora */}
            {!isLast && (
              <span
                aria-hidden
                className="absolute left-4 top-9 h-[calc(100%-2.25rem)] w-px -translate-x-1/2 bg-white/5"
              />
            )}
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${visual.wrapClass}`}
            >
              <Icon className={`h-3.5 w-3.5 ${visual.iconClass}`} />
            </span>
            <div className="min-w-0 pt-1">
              <p className="whitespace-pre-line text-sm leading-relaxed text-ink">
                {entry.descricao}
              </p>
              <p className="mt-1 text-xs font-light text-muted">
                {getAuthorLabel(entry)} · {formatRelativeTime(entry.created_at)}
              </p>
            </div>
          </motion.li>
        )
      })}
    </ol>
  )
}
