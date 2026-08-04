import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Check,
  FileText,
  Link2,
  Pencil,
  Plus,
  Search,
  Send,
  Trash2,
  Undo2,
  X,
} from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import {
  formatBRL,
  formatDateBR,
  getProposalStatusMeta,
} from '../lib/commercial'
import { formatRelativeTime } from '../lib/format'
import ProposalFormModal from '../components/proposals/ProposalFormModal'
import ProposalViewModal from '../components/proposals/ProposalViewModal'
import DeleteProposalModal from '../components/proposals/DeleteProposalModal'
import {
  copyToClipboard,
  proposalUrl,
} from '../components/proposals/proposalData'
import type { ProposalWithProject } from '../components/proposals/proposalData'

const SKELETON_ROWS = 4
const ROW_STAGGER_S = 0.04
const MAX_STAGGER_ROWS = 10
const COPIED_FEEDBACK_MS = 2500

type CopyFeedback =
  | { kind: 'copied' }
  | { kind: 'fallback'; url: string }
  | { kind: 'error'; message: string }

const iconButtonClass =
  'rounded-lg p-2 text-muted/60 transition-all duration-150 hover:bg-white/5 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent'

export default function Propostas() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<ProposalWithProject | null>(null)
  const [viewing, setViewing] = useState<ProposalWithProject | null>(null)
  const [toDelete, setToDelete] = useState<ProposalWithProject | null>(null)
  const [feedback, setFeedback] = useState<CopyFeedback | null>(null)
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (feedbackTimer.current) clearTimeout(feedbackTimer.current)
    }
  }, [])

  const showCopyFeedback = async (token: string) => {
    const url = proposalUrl(token)
    const didCopy = await copyToClipboard(url)
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current)
    if (didCopy) {
      setFeedback({ kind: 'copied' })
      feedbackTimer.current = setTimeout(
        () => setFeedback(null),
        COPIED_FEEDBACK_MS
      )
    } else {
      setFeedback({ kind: 'fallback', url })
    }
  }

  const { data: proposals, isLoading, isError } = useQuery({
    queryKey: ['proposals'],
    queryFn: async (): Promise<ProposalWithProject[]> => {
      const { data, error } = await supabase
        .from('proposals')
        .select(
          '*, projects(id, nome, tipo_servico, clients(id, nome, empresa))'
        )
        .order('created_at', { ascending: false })
      if (error) throw new Error(error.message)
      return data
    },
  })

  const sendMutation = useMutation({
    mutationFn: async (proposal: ProposalWithProject) => {
      const { error } = await supabase
        .from('proposals')
        .update({ status: 'enviada', sent_at: new Date().toISOString() })
        .eq('id', proposal.id)
      if (error) throw new Error(error.message)

      const { error: logError } = await supabase.from('activity_log').insert({
        project_id: proposal.project_id,
        user_id: user?.id ?? null,
        tipo: 'proposta',
        descricao: `Proposta "${proposal.titulo}" enviada`,
      })
      if (logError) throw new Error(logError.message)
    },
    onSuccess: async (_data, proposal) => {
      await showCopyFeedback(proposal.token)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['proposals'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
        queryClient.invalidateQueries({
          queryKey: ['activity', proposal.project_id],
        }),
      ])
    },
  })

  // Reverte um aceite (teste ou engano): a RPC recusa se houver parcela paga.
  const [pendingRevertId, setPendingRevertId] = useState<string | null>(null)
  const revertMutation = useMutation({
    mutationFn: async (proposal: ProposalWithProject) => {
      const { error } = await supabase.rpc('revert_proposal_acceptance', {
        p_proposal_id: proposal.id,
      })
      if (error) throw new Error(error.message)
    },
    onSuccess: async (_data, proposal) => {
      setPendingRevertId(null)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['proposals'] }),
        queryClient.invalidateQueries({ queryKey: ['receivables'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
        queryClient.invalidateQueries({
          queryKey: ['activity', proposal.project_id],
        }),
      ])
    },
    onError: (error: Error) => {
      setPendingRevertId(null)
      setFeedback({ kind: 'error', message: error.message })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (proposal: ProposalWithProject) => {
      const { error } = await supabase
        .from('proposals')
        .delete()
        .eq('id', proposal.id)
      if (error) throw new Error(error.message)
    },
    onSuccess: async (_data, proposal) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['proposals'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
        queryClient.invalidateQueries({
          queryKey: ['activity', proposal.project_id],
        }),
      ])
      setToDelete(null)
    },
  })

  const filtered = useMemo(() => {
    if (!proposals) return []
    const term = search.trim().toLowerCase()
    if (term === '') return proposals
    return proposals.filter((proposal) =>
      [
        proposal.titulo,
        proposal.projects?.nome ?? '',
        proposal.projects?.clients?.nome ?? '',
        proposal.projects?.clients?.empresa ?? '',
      ]
        .join(' ')
        .toLowerCase()
        .includes(term)
    )
  }, [proposals, search])

  const hasProposals = (proposals?.length ?? 0) > 0

  return (
    <div>
      {/* Header da página */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="hero-heading font-kanit text-4xl font-bold leading-tight sm:text-5xl">
            Propostas
          </h1>
          <p className="mt-2 text-sm font-light text-muted">
            Orçamentos enviados, aceites e rascunhos em negociação.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setFormOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-[0_8px_24px_-8px_rgba(108,91,242,0.6)] transition-all duration-200 hover:bg-accent-2 hover:shadow-[0_10px_28px_-8px_rgba(85,70,224,0.7)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <Plus className="h-4 w-4" />
          Nova proposta
        </button>
      </div>

      {/* Busca */}
      {hasProposals && (
        <div className="relative mt-8 max-w-sm">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted/60" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por título, projeto ou cliente…"
            aria-label="Buscar propostas"
            className="w-full rounded-lg border border-white/5 bg-surface-2 py-2.5 pl-10 pr-4 text-sm text-ink placeholder:text-muted/50 outline-none transition-colors duration-200 focus:border-accent/60 focus:ring-2 focus:ring-accent/25"
          />
        </div>
      )}

      {/* Conteúdo */}
      <div className="mt-6 overflow-x-auto rounded-2xl border border-white/5 bg-surface-1">
        {isLoading && (
          <div
            className="divide-y divide-white/5"
            aria-label="Carregando propostas"
          >
            {Array.from({ length: SKELETON_ROWS }, (_, i) => (
              <div key={i} className="flex items-center gap-6 px-6 py-5">
                <div className="h-4 w-48 animate-pulse rounded bg-surface-2" />
                <div className="h-4 w-24 animate-pulse rounded bg-surface-2" />
                <div className="ml-auto h-4 w-32 animate-pulse rounded bg-surface-2" />
              </div>
            ))}
          </div>
        )}

        {isError && (
          <p className="px-6 py-10 text-center text-sm text-red-400">
            Não foi possível carregar as propostas. Recarregue a página.
          </p>
        )}

        {!isLoading && !isError && !hasProposals && (
          <div className="flex flex-col items-center px-6 py-16 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full border border-accent/20 bg-accent/10">
              <FileText className="h-6 w-6 text-accent" />
            </span>
            <h2 className="mt-5 text-lg font-semibold text-ink">
              Nenhuma proposta ainda
            </h2>
            <p className="mt-2 max-w-xs text-sm font-light leading-relaxed text-muted">
              Monte a primeira proposta comercial e envie o link de aceite para
              o cliente.
            </p>
            <button
              type="button"
              onClick={() => setFormOpen(true)}
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-accent-2"
            >
              <Plus className="h-4 w-4" />
              Criar primeira proposta
            </button>
          </div>
        )}

        {!isLoading && !isError && hasProposals && (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/5 text-[11px] uppercase tracking-widest text-muted/70">
                <th className="px-6 py-4 font-medium">Título</th>
                <th className="px-4 py-4 font-medium">Valor</th>
                <th className="px-4 py-4 font-medium">Status</th>
                <th className="hidden px-4 py-4 font-medium md:table-cell">
                  Validade
                </th>
                <th className="hidden px-4 py-4 font-medium lg:table-cell">
                  Enviada
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
                    Nenhuma proposta encontrada para “{search.trim()}”.
                  </td>
                </tr>
              )}
              {filtered.map((proposal, index) => {
                const statusMeta = getProposalStatusMeta(proposal.status)
                const isRascunho = proposal.status === 'rascunho'
                const canCopyLink =
                  proposal.status === 'enviada' || proposal.status === 'aceita'
                return (
                  <motion.tr
                    key={proposal.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.25,
                      delay: Math.min(index, MAX_STAGGER_ROWS) * ROW_STAGGER_S,
                    }}
                    onClick={() => setViewing(proposal)}
                    className="group cursor-pointer border-b border-white/5 transition-colors duration-150 last:border-b-0 hover:bg-white/[0.03]"
                  >
                    <td className="px-6 py-4">
                      <p className="font-medium text-ink">{proposal.titulo}</p>
                      {proposal.projects && (
                        <p className="mt-0.5 text-xs font-light text-muted">
                          {proposal.projects.nome}
                          {proposal.projects.clients &&
                            ` · ${proposal.projects.clients.nome}`}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-4 font-medium tabular-nums text-ink">
                      {formatBRL(proposal.valor_total)}
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${statusMeta.badgeClass}`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${statusMeta.dotClass}`}
                        />
                        {statusMeta.label}
                      </span>
                    </td>
                    <td className="hidden px-4 py-4 tabular-nums text-muted md:table-cell">
                      {proposal.validade
                        ? formatDateBR(proposal.validade)
                        : '—'}
                    </td>
                    <td className="hidden px-4 py-4 tabular-nums text-muted lg:table-cell">
                      {proposal.sent_at
                        ? formatRelativeTime(proposal.sent_at)
                        : '—'}
                    </td>
                    <td className="px-4 py-4">
                      <div
                        className="flex items-center justify-end gap-2"
                        onClick={(event) => event.stopPropagation()}
                      >
                        {isRascunho && (
                          <>
                            <button
                              type="button"
                              title="Enviar ao cliente"
                              aria-label={`Enviar proposta ${proposal.titulo}`}
                              disabled={sendMutation.isPending}
                              onClick={() => sendMutation.mutate(proposal)}
                              className={`${iconButtonClass} hover:text-accent disabled:cursor-not-allowed disabled:opacity-40`}
                            >
                              <Send className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              title="Editar rascunho"
                              aria-label={`Editar proposta ${proposal.titulo}`}
                              onClick={() => setEditing(proposal)}
                              className={iconButtonClass}
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              title="Excluir rascunho"
                              aria-label={`Excluir proposta ${proposal.titulo}`}
                              onClick={() => setToDelete(proposal)}
                              className="rounded-lg p-2 text-muted/60 transition-all duration-150 hover:bg-red-500/10 hover:text-red-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-400"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </>
                        )}
                        {canCopyLink && (
                          <button
                            type="button"
                            title="Copiar link público"
                            aria-label={`Copiar link da proposta ${proposal.titulo}`}
                            onClick={() => void showCopyFeedback(proposal.token)}
                            className={iconButtonClass}
                          >
                            <Link2 className="h-4 w-4" />
                          </button>
                        )}
                        {proposal.status === 'aceita' && (
                          <button
                            type="button"
                            disabled={revertMutation.isPending}
                            onClick={() => {
                              if (pendingRevertId === proposal.id) {
                                revertMutation.mutate(proposal)
                              } else {
                                setPendingRevertId(proposal.id)
                              }
                            }}
                            onBlur={() => setPendingRevertId(null)}
                            title={
                              pendingRevertId === proposal.id
                                ? 'Clique novamente para confirmar — remove as parcelas em aberto e volta a proposta para "enviada"'
                                : 'Reverter aceite'
                            }
                            aria-label={`Reverter aceite da proposta ${proposal.titulo}`}
                            className={`rounded-lg p-2 transition-all duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400 disabled:cursor-not-allowed disabled:opacity-40 ${
                              pendingRevertId === proposal.id
                                ? 'bg-amber-400/20 text-amber-300'
                                : 'text-muted/60 hover:bg-amber-400/10 hover:text-amber-300'
                            }`}
                          >
                            <Undo2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {sendMutation.isError && (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm text-red-400"
        >
          Não foi possível enviar a proposta. Tente novamente.
        </p>
      )}

      {/* Feedback de cópia de link */}
      <AnimatePresence>
        {feedback && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.2 }}
            role="status"
            className="fixed bottom-6 left-1/2 z-50 w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-xl border border-white/10 bg-surface-1 px-4 py-3 font-kanit shadow-[0_16px_48px_-16px_rgba(0,0,0,0.8)]"
          >
            {feedback.kind === 'copied' ? (
              <span className="flex items-center gap-2 text-sm text-ink">
                <Check className="h-4 w-4 text-emerald-300" />
                Link copiado!
              </span>
            ) : feedback.kind === 'error' ? (
              <span className="flex items-center gap-3 text-sm text-red-300">
                <span>{feedback.message}</span>
                <button
                  type="button"
                  onClick={() => setFeedback(null)}
                  aria-label="Fechar aviso"
                  className="shrink-0 rounded-lg p-2 text-muted transition-colors duration-150 hover:bg-white/5 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            ) : (
              <span className="flex items-center gap-3 text-xs text-muted">
                <span className="break-all">
                  Copie o link:{' '}
                  <span className="select-all text-ink/90">{feedback.url}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setFeedback(null)}
                  aria-label="Fechar aviso"
                  className="shrink-0 rounded-lg p-2 text-muted transition-colors duration-150 hover:bg-white/5 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <ProposalFormModal
        open={formOpen || editing !== null}
        proposal={editing}
        onClose={() => {
          setFormOpen(false)
          setEditing(null)
        }}
      />

      <ProposalViewModal
        open={viewing !== null}
        proposal={viewing}
        onClose={() => setViewing(null)}
      />

      <DeleteProposalModal
        open={toDelete !== null}
        proposalTitle={toDelete?.titulo ?? ''}
        isDeleting={deleteMutation.isPending}
        onConfirm={() => {
          if (toDelete) deleteMutation.mutate(toDelete)
        }}
        onClose={() => setToDelete(null)}
      />
    </div>
  )
}
