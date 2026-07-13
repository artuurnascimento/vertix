import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Plus, Search, Trash2, UserRound, Users } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import type { Tables } from '../lib/database.types'
import { formatRelativeTime, isActiveStatus } from '../lib/format'
import ClientFormModal from '../components/clients/ClientFormModal'
import DeleteClientModal from '../components/clients/DeleteClientModal'

type ProjectSummary = Pick<Tables<'projects'>, 'id' | 'status' | 'updated_at'>

type ClientWithProjects = Tables<'clients'> & {
  projects: ProjectSummary[]
}

const SKELETON_ROWS = 4
const ROW_STAGGER_S = 0.04
const MAX_STAGGER_ROWS = 10

function lastActivity(projects: ProjectSummary[]): string | null {
  if (projects.length === 0) return null
  return projects.reduce(
    (max, p) => (p.updated_at > max ? p.updated_at : max),
    projects[0].updated_at
  )
}

export default function Clientes() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'

  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [clientToDelete, setClientToDelete] =
    useState<ClientWithProjects | null>(null)

  const { data: clients, isLoading, isError } = useQuery({
    queryKey: ['clients'],
    queryFn: async (): Promise<ClientWithProjects[]> => {
      const { data, error } = await supabase
        .from('clients')
        .select('*, projects(id, status, updated_at)')
        .order('created_at', { ascending: false })
      if (error) throw new Error(error.message)
      return data
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (clientId: string) => {
      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', clientId)
      if (error) throw new Error(error.message)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['clients'] })
      setClientToDelete(null)
    },
  })

  const filtered = useMemo(() => {
    if (!clients) return []
    const term = search.trim().toLowerCase()
    if (term === '') return clients
    return clients.filter((client) =>
      [client.nome, client.empresa ?? '', client.email ?? '']
        .join(' ')
        .toLowerCase()
        .includes(term)
    )
  }, [clients, search])

  const hasClients = (clients?.length ?? 0) > 0

  return (
    <div>
      {/* Header da página */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="hero-heading font-kanit text-4xl font-bold leading-tight sm:text-5xl">
            Clientes
          </h1>
          <p className="mt-2 text-sm font-light text-muted">
            Contas, contatos e histórico de projetos em um só lugar.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setFormOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-[0_8px_24px_-8px_rgba(108,91,242,0.6)] transition-all duration-200 hover:bg-accent-2 hover:shadow-[0_10px_28px_-8px_rgba(85,70,224,0.7)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <Plus className="h-4 w-4" />
          Novo cliente
        </button>
      </div>

      {/* Busca */}
      {hasClients && (
        <div className="relative mt-8 max-w-sm">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted/60" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, empresa ou email…"
            aria-label="Buscar clientes"
            className="w-full rounded-lg border border-white/5 bg-surface-2 py-2.5 pl-10 pr-4 text-sm text-ink placeholder:text-muted/50 outline-none transition-colors duration-200 focus:border-accent/60 focus:ring-2 focus:ring-accent/25"
          />
        </div>
      )}

      {/* Conteúdo */}
      <div className="mt-6 overflow-x-auto rounded-2xl border border-white/5 bg-surface-1">
        {isLoading && (
          <div className="divide-y divide-white/5" aria-label="Carregando clientes">
            {Array.from({ length: SKELETON_ROWS }, (_, i) => (
              <div key={i} className="flex items-center gap-6 px-6 py-5">
                <div className="h-4 w-40 animate-pulse rounded bg-surface-2" />
                <div className="h-4 w-52 animate-pulse rounded bg-surface-2" />
                <div className="ml-auto h-4 w-24 animate-pulse rounded bg-surface-2" />
              </div>
            ))}
          </div>
        )}

        {isError && (
          <p className="px-6 py-10 text-center text-sm text-red-400">
            Não foi possível carregar os clientes. Recarregue a página.
          </p>
        )}

        {!isLoading && !isError && !hasClients && (
          <div className="flex flex-col items-center px-6 py-16 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full border border-accent/20 bg-accent/10">
              <Users className="h-6 w-6 text-accent" />
            </span>
            <h2 className="mt-5 text-lg font-semibold text-ink">
              Nenhum cliente ainda
            </h2>
            <p className="mt-2 max-w-xs text-sm font-light leading-relaxed text-muted">
              Cadastre o primeiro cliente para começar a acompanhar contatos e
              projetos da Vertix.
            </p>
            <button
              type="button"
              onClick={() => setFormOpen(true)}
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-accent-2"
            >
              <Plus className="h-4 w-4" />
              Criar primeiro cliente
            </button>
          </div>
        )}

        {!isLoading && !isError && hasClients && (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/5 text-[11px] uppercase tracking-widest text-muted/70">
                <th className="px-6 py-4 font-medium">Nome</th>
                <th className="hidden px-4 py-4 font-medium md:table-cell">
                  Contato
                </th>
                <th className="hidden px-4 py-4 font-medium lg:table-cell">
                  Origem
                </th>
                <th className="px-4 py-4 font-medium">Projetos</th>
                <th className="hidden px-4 py-4 font-medium sm:table-cell">
                  Última atividade
                </th>
                <th className="px-4 py-4 text-right font-medium">
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-10 text-center text-sm font-light text-muted"
                  >
                    Nenhum cliente encontrado para “{search.trim()}”.
                  </td>
                </tr>
              )}
              {filtered.map((client, index) => {
                const activeCount = client.projects.filter((p) =>
                  isActiveStatus(p.status)
                ).length
                const activity = lastActivity(client.projects)
                return (
                  <motion.tr
                    key={client.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.25,
                      delay: Math.min(index, MAX_STAGGER_ROWS) * ROW_STAGGER_S,
                    }}
                    onClick={() => navigate(`/admin/clientes/${client.id}`)}
                    className="group cursor-pointer border-b border-white/5 transition-colors duration-150 last:border-b-0 hover:bg-white/[0.03]"
                  >
                    <td className="px-6 py-4">
                      <p className="font-medium text-ink">{client.nome}</p>
                      {client.empresa && (
                        <p className="mt-0.5 text-xs font-light text-muted">
                          {client.empresa}
                        </p>
                      )}
                    </td>
                    <td className="hidden px-4 py-4 md:table-cell">
                      <p className="text-ink/90">{client.email ?? '—'}</p>
                      {client.telefone && (
                        <p className="mt-0.5 text-xs font-light text-muted">
                          {client.telefone}
                        </p>
                      )}
                    </td>
                    <td className="hidden px-4 py-4 lg:table-cell">
                      {client.origem ? (
                        <span className="inline-flex rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[11px] font-medium text-muted">
                          {client.origem}
                        </span>
                      ) : (
                        <span className="text-muted/50">—</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <span className="font-medium tabular-nums text-ink">
                        {client.projects.length}
                      </span>
                      {activeCount > 0 && (
                        <span className="ml-1.5 text-xs tabular-nums text-accent">
                          · {activeCount} ativo{activeCount > 1 ? 's' : ''}
                        </span>
                      )}
                    </td>
                    <td className="hidden px-4 py-4 tabular-nums text-muted sm:table-cell">
                      {activity ? formatRelativeTime(activity) : '—'}
                    </td>
                    <td className="px-4 py-4 text-right">
                      {isAdmin && (
                        <button
                          type="button"
                          aria-label={`Excluir ${client.nome}`}
                          title="Excluir cliente"
                          onClick={(event) => {
                            event.stopPropagation()
                            setClientToDelete(client)
                          }}
                          className="rounded-lg p-2 text-muted/50 opacity-0 transition-all duration-150 hover:bg-red-500/10 hover:text-red-400 focus-visible:opacity-100 group-hover:opacity-100"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                      {!isAdmin && (
                        <UserRound
                          aria-hidden
                          className="ml-auto h-4 w-4 text-muted/25"
                        />
                      )}
                    </td>
                  </motion.tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <ClientFormModal open={formOpen} onClose={() => setFormOpen(false)} />

      <DeleteClientModal
        open={clientToDelete !== null}
        clientName={clientToDelete?.nome ?? ''}
        isDeleting={deleteMutation.isPending}
        onConfirm={() => {
          if (clientToDelete) deleteMutation.mutate(clientToDelete.id)
        }}
        onClose={() => setClientToDelete(null)}
      />
    </div>
  )
}
