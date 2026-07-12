import type { Tables } from '../../../lib/database.types'

/**
 * Query key canônica da lista de projetos — DEVE permanecer ['projects']:
 * outros fluxos (ProjectFormModal, ProjectDetail) invalidam exatamente essa key.
 */
export const PROJECTS_QUERY_KEY = ['projects'] as const

export type ProjectClient = Pick<Tables<'clients'>, 'id' | 'nome' | 'empresa'>

/** Linha de projects com o cliente embutido (select `*, clients(id, nome, empresa)`). */
export type ProjectWithClient = Tables<'projects'> & {
  clients: ProjectClient
}
