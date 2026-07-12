import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { PROJECT_STATUS_ORDER } from '../lib/format'
import KanbanBoard from '../components/projects/kanban/KanbanBoard'
import { PROJECTS_QUERY_KEY } from '../components/projects/kanban/types'
import type { ProjectWithClient } from '../components/projects/kanban/types'

/** Altura do board: viewport menos header do layout + título da página. */
const BOARD_HEIGHT_CLASS = 'h-[calc(100vh-15rem)] min-h-[440px]'
const SKELETON_CARDS_PER_COLUMN = 2

export default function Projetos() {
  const { data: projects, isLoading, isError } = useQuery({
    queryKey: PROJECTS_QUERY_KEY,
    queryFn: async (): Promise<ProjectWithClient[]> => {
      const { data, error } = await supabase
        .from('projects')
        .select('*, clients(id, nome, empresa)')
        .order('updated_at', { ascending: false })
      if (error) throw new Error(error.message)
      return data
    },
  })

  return (
    <div>
      {/* Header da página */}
      <div>
        <h1 className="hero-heading font-kanit text-4xl font-bold leading-tight sm:text-5xl">
          Projetos
        </h1>
        <p className="mt-2 text-sm font-light text-muted">
          Pipeline de entregas por etapa — arraste os cards para atualizar o
          status.
        </p>
      </div>

      {/* Board */}
      <div className={`mt-8 ${BOARD_HEIGHT_CLASS}`}>
        {isLoading && (
          <div
            aria-label="Carregando projetos"
            className="flex h-full items-stretch gap-4 overflow-hidden pb-2"
          >
            {PROJECT_STATUS_ORDER.map((status) => (
              <div
                key={status}
                className="flex h-full w-[300px] shrink-0 flex-col rounded-2xl border border-white/5 bg-surface-1 p-3"
              >
                <div className="h-4 w-28 animate-pulse rounded bg-surface-2" />
                {Array.from({ length: SKELETON_CARDS_PER_COLUMN }, (_, i) => (
                  <div
                    key={i}
                    className="mt-3 h-24 animate-pulse rounded-xl bg-surface-2"
                    style={{ opacity: 1 - i * 0.4 }}
                  />
                ))}
              </div>
            ))}
          </div>
        )}

        {isError && (
          <div className="flex h-full items-center justify-center rounded-2xl border border-white/5 bg-surface-1">
            <p className="text-sm text-red-400">
              Não foi possível carregar os projetos. Recarregue a página.
            </p>
          </div>
        )}

        {!isLoading && !isError && <KanbanBoard projects={projects ?? []} />}
      </div>
    </div>
  )
}
