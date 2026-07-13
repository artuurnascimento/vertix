import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, LifeBuoy } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { Tables } from '../../lib/database.types'
import { formatRelativeTime } from '../../lib/format'

type TicketRow = Tables<'support_tickets'> & {
  projects:
    | (Pick<Tables<'projects'>, 'id' | 'nome'> & {
        clients: Pick<Tables<'clients'>, 'id' | 'nome' | 'empresa'> | null
      })
    | null
}

type Filtro = 'todos' | 'abertos' | 'em_andamento' | 'resolvidos'

const FILTROS: { valor: Filtro; label: string }[] = [
  { valor: 'todos', label: 'Todos' },
  { valor: 'abertos', label: 'Abertos' },
  { valor: 'em_andamento', label: 'Em andamento' },
  { valor: 'resolvidos', label: 'Resolvidos' },
]

const STATUS_ORDER: Record<string, number> = {
  aberto: 0,
  em_andamento: 1,
  resolvido: 2,
}

const PRIORIDADE_ORDER: Record<string, number> = {
  alta: 0,
  media: 1,
  baixa: 2,
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  aberto: {
    label: 'Aberto',
    className: 'border-sky-400/20 bg-sky-400/10 text-sky-300',
  },
  em_andamento: {
    label: 'Em andamento',
    className: 'border-amber-400/20 bg-amber-400/10 text-amber-300',
  },
  resolvido: {
    label: 'Resolvido',
    className: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300',
  },
}

const PRIORIDADE_BADGE: Record<string, { label: string; className: string }> = {
  alta: { label: 'Alta', className: 'border-red-400/25 bg-red-400/10 text-red-300' },
  media: {
    label: 'Média',
    className: 'border-amber-400/20 bg-amber-400/10 text-amber-300',
  },
  baixa: {
    label: 'Baixa',
    className: 'border-white/10 bg-white/5 text-muted',
  },
}

const UNKNOWN_BADGE = { label: 'Desconhecido', className: 'border-white/10 bg-white/5 text-muted' }

function matchesFilter(row: TicketRow, filtro: Filtro): boolean {
  if (filtro === 'todos') return true
  if (filtro === 'abertos') return row.status === 'aberto'
  if (filtro === 'em_andamento') return row.status === 'em_andamento'
  return row.status === 'resolvido'
}

/** Fila de chamados de suporte — filtros por status, prioridade e mudança de status inline. */
export default function TicketsList() {
  const queryClient = useQueryClient()
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [abertoId, setAbertoId] = useState<string | null>(null)

  const { data: tickets, isLoading, isError } = useQuery({
    queryKey: ['tickets'],
    queryFn: async (): Promise<TicketRow[]> => {
      const { data, error } = await supabase
        .from('support_tickets')
        .select('*, projects(id, nome, clients(id, nome, empresa))')
      if (error) throw new Error(error.message)
      return data as TicketRow[]
    },
  })

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from('support_tickets')
        .update({
          status,
          resolved_at: status === 'resolvido' ? new Date().toISOString() : null,
        })
        .eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['tickets'] })
    },
  })

  const ordenados = useMemo(() => {
    const lista = [...(tickets ?? [])]
    lista.sort((a, b) => {
      const statusDiff =
        (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99)
      if (statusDiff !== 0) return statusDiff
      const prioridadeDiff =
        (PRIORIDADE_ORDER[a.prioridade] ?? 99) -
        (PRIORIDADE_ORDER[b.prioridade] ?? 99)
      if (prioridadeDiff !== 0) return prioridadeDiff
      return b.created_at.localeCompare(a.created_at)
    })
    return lista.filter((t) => matchesFilter(t, filtro))
  }, [tickets, filtro])

  if (isLoading) {
    return (
      <div className="mt-6 space-y-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div
            key={i}
            className="h-20 animate-pulse rounded-xl bg-surface-1"
            style={{ opacity: 1 - i * 0.3 }}
          />
        ))}
      </div>
    )
  }

  if (isError) {
    return (
      <p className="mt-6 rounded-xl border border-white/5 bg-surface-1 px-6 py-8 text-center text-sm text-red-400">
        Não foi possível carregar os chamados. Recarregue a página.
      </p>
    )
  }

  return (
    <div className="mt-6">
      {/* Filtros com contadores */}
      <div className="flex flex-wrap gap-2">
        {FILTROS.map(({ valor, label }) => {
          const total = (tickets ?? []).filter((t) => matchesFilter(t, valor)).length
          const ativo = filtro === valor
          return (
            <button
              key={valor}
              type="button"
              onClick={() => setFiltro(valor)}
              className={[
                'inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent',
                ativo
                  ? 'border-accent/40 bg-accent/15 text-ink'
                  : 'border-white/10 bg-white/5 text-muted hover:text-ink',
              ].join(' ')}
            >
              {label}
              <span className={`tabular-nums ${ativo ? 'text-accent' : 'text-muted/70'}`}>
                {total}
              </span>
            </button>
          )
        })}
      </div>

      {ordenados.length === 0 ? (
        <div className="mt-6 rounded-xl border border-white/5 bg-surface-1 px-6 py-12 text-center">
          <LifeBuoy className="mx-auto h-8 w-8 text-muted/50" />
          <p className="mt-3 text-sm font-light text-muted">
            Nenhum chamado por aqui. A fila de suporte aparece assim que um
            cliente abrir um chamado.
          </p>
        </div>
      ) : (
        <ul className="mt-6 flex list-none flex-col gap-3 p-0">
          {ordenados.map((ticket) => {
            const projeto = ticket.projects
            const cliente = projeto?.clients
            const statusBadge = STATUS_BADGE[ticket.status] ?? UNKNOWN_BADGE
            const prioridadeBadge =
              PRIORIDADE_BADGE[ticket.prioridade] ?? UNKNOWN_BADGE
            const aberto = abertoId === ticket.id

            return (
              <li
                key={ticket.id}
                className="rounded-xl border border-white/5 bg-surface-1"
              >
                <div className="flex flex-wrap items-center gap-3 px-5 py-4">
                  <div className="min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => setAbertoId(aberto ? null : ticket.id)}
                      aria-expanded={aberto}
                      className="text-left text-sm font-medium text-ink transition-colors duration-200 hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                    >
                      {ticket.titulo}
                    </button>
                    <p className="mt-0.5 truncate text-xs font-light text-muted">
                      {projeto ? (
                        <Link
                          to={`/admin/projetos/${projeto.id}`}
                          className="hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                        >
                          {projeto.nome}
                        </Link>
                      ) : (
                        'Projeto removido'
                      )}
                      {cliente ? ` · ${cliente.nome}` : ''}
                    </p>
                  </div>

                  <span
                    className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${prioridadeBadge.className}`}
                  >
                    {prioridadeBadge.label}
                  </span>
                  <span
                    className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${statusBadge.className}`}
                  >
                    {statusBadge.label}
                  </span>

                  <span className="text-xs font-light tabular-nums text-muted">
                    aberto {formatRelativeTime(ticket.created_at)}
                  </span>

                  <select
                    value={ticket.status}
                    onChange={(e) =>
                      updateStatus.mutate({ id: ticket.id, status: e.target.value })
                    }
                    aria-label={`Alterar status do chamado ${ticket.titulo}`}
                    disabled={updateStatus.isPending}
                    className="rounded-lg border border-white/10 bg-surface-2 px-3 py-1.5 text-xs font-medium text-ink outline-none transition-colors duration-200 focus:border-accent/60 focus:ring-2 focus:ring-accent/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-50"
                  >
                    <option value="aberto">Aberto</option>
                    <option value="em_andamento">Em andamento</option>
                    <option value="resolvido">Resolvido</option>
                  </select>

                  <button
                    type="button"
                    onClick={() => setAbertoId(aberto ? null : ticket.id)}
                    aria-expanded={aberto}
                    aria-label={aberto ? 'Recolher chamado' : 'Expandir chamado'}
                    className="rounded-lg p-1.5 text-muted transition-colors duration-150 hover:bg-white/5 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                  >
                    <ChevronDown
                      className={`h-4 w-4 transition-transform duration-200 ${aberto ? 'rotate-180' : ''}`}
                    />
                  </button>
                </div>

                <AnimatePresence initial={false}>
                  {aberto && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: 'easeOut' }}
                      className="overflow-hidden"
                    >
                      <div className="border-t border-white/5 px-5 py-5">
                        <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink/90">
                          {ticket.descricao ?? 'Sem descrição.'}
                        </p>
                        <p className="mt-3 text-xs font-light text-muted">
                          Aberto há {formatRelativeTime(ticket.created_at)}
                          {ticket.resolved_at
                            ? ` · resolvido ${formatRelativeTime(ticket.resolved_at)}`
                            : ''}
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
