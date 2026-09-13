import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { formatRelativeTime, getProjectStatusMeta } from '../../lib/format'
import WorkspacePanel from './WorkspacePanel'
import type { WorkspaceItem } from './WorkspacePanel'

const NEXT_ACTION: Record<string, string> = {
  lead: 'Qualificar o projeto e preparar o briefing.',
  briefing_enviado: 'Acompanhar o preenchimento do briefing com o cliente.',
  briefing_recebido: 'Revisar o escopo e organizar as próximas entregas.',
  em_desenvolvimento: 'Acompanhar as tarefas e preparar a próxima entrega.',
  revisao: 'Consolidar o retorno do cliente e finalizar os ajustes.',
  entregue: 'Consultar a entrega e acompanhar o pós-venda.',
}
export default function ProjectsWorkspace() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['dashboard', 'workspace-projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select(
          'id, nome, status, created_at, updated_at, clients(nome, empresa)'
        )
        .order('updated_at', { ascending: false })
      if (error) throw new Error(error.message)
      return data
    },
  })
  const items: WorkspaceItem[] = (data ?? []).map((p) => ({
    id: p.id,
    title: p.nome,
    subtitle: p.clients?.empresa ?? p.clients?.nome ?? 'Projeto sem cliente',
    value: getProjectStatusMeta(p.status).label,
    meta: formatRelativeTime(p.updated_at),
    steps: [
      {
        label: 'Projeto cadastrado',
        detail: new Date(p.created_at).toLocaleDateString('pt-BR'),
        done: true,
      },
      {
        label: 'Etapa atual',
        detail: getProjectStatusMeta(p.status).label,
        done: p.status === 'entregue',
      },
      {
        label: 'Última atualização',
        detail: formatRelativeTime(p.updated_at),
        done: false,
      },
    ],
    nextAction:
      NEXT_ACTION[p.status] ??
      'Consultar os detalhes e definir a próxima ação.',
    actionLabel: 'Abrir projeto',
    to: `/admin/projetos/${p.id}`,
  }))
  return (
    <WorkspacePanel
      title="Projetos"
      items={items}
      loading={isLoading}
      error={isError}
      emptyText="Nenhum projeto cadastrado"
    />
  )
}
