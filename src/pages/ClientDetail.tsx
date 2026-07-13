import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  FolderKanban,
  Mail,
  Pencil,
  Phone,
  Plus,
  SearchX,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Tables } from '../lib/database.types'
import {
  formatMonthYear,
  formatRelativeTime,
  getProjectStatusMeta,
  getTipoServicoMeta,
} from '../lib/format'
import ClientFormModal from '../components/clients/ClientFormModal'
import ProjectFormModal from '../components/projects/ProjectFormModal'

type ClientWithProjects = Tables<'clients'> & {
  projects: Tables<'projects'>[]
}

/** Código Postgres para uuid malformado — tratado como "não encontrado". */
const INVALID_UUID_CODE = '22P02'

function NotFound() {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-white/5 bg-surface-1 px-6 py-16 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-white/5">
        <SearchX className="h-6 w-6 text-muted" />
      </span>
      <h1 className="mt-5 text-lg font-semibold text-ink">
        Cliente não encontrado
      </h1>
      <p className="mt-2 max-w-xs text-sm font-light leading-relaxed text-muted">
        Este cliente não existe ou foi removido do CRM.
      </p>
      <Link
        to="/admin/clientes"
        className="mt-6 inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-accent-2"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar para clientes
      </Link>
    </div>
  )
}

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>()
  const [editOpen, setEditOpen] = useState(false)
  const [projectFormOpen, setProjectFormOpen] = useState(false)

  const { data: client, isLoading, isError } = useQuery({
    queryKey: ['client', id],
    enabled: Boolean(id),
    queryFn: async (): Promise<ClientWithProjects | null> => {
      const { data, error } = await supabase
        .from('clients')
        .select('*, projects(*)')
        .eq('id', id ?? '')
        .maybeSingle()
      if (error) {
        if (error.code === INVALID_UUID_CODE) return null
        throw new Error(error.message)
      }
      return data
    },
  })

  if (isLoading) {
    return (
      <div aria-label="Carregando cliente">
        <div className="h-5 w-32 animate-pulse rounded bg-surface-2" />
        <div className="mt-6 h-12 w-72 animate-pulse rounded bg-surface-2" />
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="h-24 animate-pulse rounded-2xl bg-surface-1" />
          <div className="h-24 animate-pulse rounded-2xl bg-surface-1" />
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <p className="rounded-2xl border border-red-500/20 bg-red-500/10 px-6 py-8 text-center text-sm text-red-400">
        Não foi possível carregar o cliente. Recarregue a página.
      </p>
    )
  }

  if (!client) return <NotFound />

  const metaLine = [
    client.empresa,
    client.origem ? `Origem: ${client.origem}` : null,
    `Cliente desde ${formatMonthYear(client.created_at)}`,
  ]
    .filter(Boolean)
    .join('  ·  ')

  const sortedProjects = [...client.projects].sort((a, b) =>
    b.updated_at.localeCompare(a.updated_at)
  )

  return (
    <div>
      {/* Voltar */}
      <Link
        to="/admin/clientes"
        className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-muted transition-colors duration-200 hover:text-ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Clientes
      </Link>

      {/* Header */}
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="hero-heading font-kanit text-4xl font-bold leading-tight sm:text-5xl">
            {client.nome}
          </h1>
          <p className="mt-2 text-sm font-light text-muted">{metaLine}</p>
        </div>
        <button
          type="button"
          onClick={() => setEditOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-surface-1 px-4 py-2.5 text-sm font-medium text-ink transition-colors duration-200 hover:border-accent/40 hover:bg-accent/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <Pencil className="h-4 w-4 text-accent" />
          Editar
        </button>
      </div>

      {/* Cards de contato */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="flex items-center gap-4 rounded-2xl border border-white/5 bg-surface-1 p-5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-accent/20 bg-accent/10">
            <Mail className="h-4 w-4 text-accent" />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-widest text-muted">
              Email
            </p>
            <p className="mt-0.5 truncate text-sm text-ink">
              {client.email ?? '—'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-2xl border border-white/5 bg-surface-1 p-5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-accent/20 bg-accent/10">
            <Phone className="h-4 w-4 text-accent" />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-widest text-muted">
              Telefone
            </p>
            <p className="mt-0.5 truncate text-sm text-ink">
              {client.telefone ?? '—'}
            </p>
          </div>
        </div>
      </div>

      {/* Projetos */}
      <section aria-labelledby="projetos-heading" className="mt-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2
            id="projetos-heading"
            className="text-xs font-medium uppercase tracking-widest text-muted"
          >
            Projetos
          </h2>
          <button
            type="button"
            onClick={() => setProjectFormOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-3.5 py-2 text-xs font-semibold text-white shadow-[0_8px_24px_-8px_rgba(108,91,242,0.6)] transition-all duration-200 hover:bg-accent-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <Plus className="h-3.5 w-3.5" />
            Novo projeto
          </button>
        </div>

        {sortedProjects.length === 0 ? (
          <div className="mt-4 flex flex-col items-center rounded-2xl border border-white/5 bg-surface-1 px-6 py-12 text-center">
            <FolderKanban className="h-6 w-6 text-muted/50" />
            <p className="mt-3 max-w-xs text-sm font-light leading-relaxed text-muted">
              Nenhum projeto para este cliente ainda. Crie o primeiro para
              iniciar o pipeline.
            </p>
            <button
              type="button"
              onClick={() => setProjectFormOpen(true)}
              className="mt-5 inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-accent-2"
            >
              <Plus className="h-4 w-4" />
              Criar primeiro projeto
            </button>
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-white/5 overflow-hidden rounded-2xl border border-white/5 bg-surface-1">
            {sortedProjects.map((project, index) => {
              const statusMeta = getProjectStatusMeta(project.status)
              const tipoMeta = getTipoServicoMeta(project.tipo_servico)
              return (
                <motion.li
                  key={project.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: index * 0.05 }}
                >
                  <Link
                    to={`/admin/projetos/${project.id}`}
                    className="flex flex-wrap items-center gap-3 px-6 py-4 transition-colors duration-150 hover:bg-white/[0.03] focus-visible:bg-white/[0.03] focus-visible:outline-none"
                  >
                    <p className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
                      {project.nome}
                    </p>
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${tipoMeta.badgeClass}`}
                    >
                      {tipoMeta.label}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${statusMeta.badgeClass}`}
                    >
                      <span
                        aria-hidden
                        className={`h-1.5 w-1.5 rounded-full ${statusMeta.dotClass}`}
                      />
                      {statusMeta.label}
                    </span>
                    <span className="w-24 text-right text-xs font-light tabular-nums text-muted">
                      {formatRelativeTime(project.updated_at)}
                    </span>
                  </Link>
                </motion.li>
              )
            })}
          </ul>
        )}
      </section>

      <ClientFormModal
        open={editOpen}
        client={client}
        onClose={() => setEditOpen(false)}
      />

      <ProjectFormModal
        open={projectFormOpen}
        onClose={() => setProjectFormOpen(false)}
        lockedClient={{ id: client.id, nome: client.nome }}
      />
    </div>
  )
}
