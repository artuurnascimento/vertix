import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../lib/auth'
import { getProjectStatusMeta } from '../../../lib/format'
import type { ProjectStatus } from '../../../lib/format'
import { PROJECTS_QUERY_KEY } from './types'
import type { ProjectWithClient } from './types'

export interface MoveProjectInput {
  project: ProjectWithClient
  toStatus: ProjectStatus
}

interface MoveProjectContext {
  previousProjects: ProjectWithClient[] | undefined
}

/**
 * Mutação do drop no Kanban:
 * 1. otimista — move o card no cache de ['projects'] imediatamente;
 * 2. UPDATE projects.status (trigger do banco cuida de updated_at);
 * 3. INSERT em activity_log ("Movido de X para Y");
 * 4. onError — restaura o snapshot do cache;
 * 5. onSettled — invalida ['projects'], ['clients'] e ['client', clientId].
 */
export function useMoveProject() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation<void, Error, MoveProjectInput, MoveProjectContext>({
    mutationFn: async ({ project, toStatus }) => {
      const { error: updateError } = await supabase
        .from('projects')
        .update({ status: toStatus })
        .eq('id', project.id)
      if (updateError) throw new Error(updateError.message)

      const fromLabel = getProjectStatusMeta(project.status).label
      const toLabel = getProjectStatusMeta(toStatus).label
      const { error: logError } = await supabase.from('activity_log').insert({
        project_id: project.id,
        user_id: user?.id ?? null,
        tipo: 'status_change',
        descricao: `Movido de ${fromLabel} para ${toLabel}`,
      })
      if (logError) throw new Error(logError.message)
    },

    onMutate: async ({ project, toStatus }) => {
      await queryClient.cancelQueries({ queryKey: PROJECTS_QUERY_KEY })
      const previousProjects =
        queryClient.getQueryData<ProjectWithClient[]>(PROJECTS_QUERY_KEY)

      queryClient.setQueryData<ProjectWithClient[]>(
        PROJECTS_QUERY_KEY,
        (old) =>
          old?.map((item) =>
            item.id === project.id
              ? { ...item, status: toStatus, updated_at: new Date().toISOString() }
              : item
          )
      )

      return { previousProjects }
    },

    onError: (_error, _input, context) => {
      if (context?.previousProjects) {
        queryClient.setQueryData(PROJECTS_QUERY_KEY, context.previousProjects)
      }
    },

    onSettled: async (_data, _error, { project }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: PROJECTS_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: ['clients'] }),
        queryClient.invalidateQueries({
          queryKey: ['client', project.client_id],
        }),
      ])
    },
  })
}
