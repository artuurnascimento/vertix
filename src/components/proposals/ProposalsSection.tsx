import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Check, FileText, Link2, Plus } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { formatBRL, getProposalStatusMeta } from '../../lib/commercial'
import ProposalFormModal from './ProposalFormModal'
import { copyToClipboard, proposalUrl } from './proposalData'
import type { Proposal } from './proposalData'

interface ProposalsSectionProps {
  projectId: string
}

const SKELETON_ROWS = 2
const COPIED_FEEDBACK_MS = 2500

/**
 * Seção de propostas de um projeto (plugada no ProjectDetail pelo
 * orquestrador). Lista compacta + criação com projeto pré-travado.
 */
export default function ProposalsSection({ projectId }: ProposalsSectionProps) {
  const [formOpen, setFormOpen] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null)
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (copiedTimer.current) clearTimeout(copiedTimer.current)
    }
  }, [])

  const { data: proposals, isLoading, isError } = useQuery({
    queryKey: ['proposals', projectId],
    queryFn: async (): Promise<Proposal[]> => {
      const { data, error } = await supabase
        .from('proposals')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
      if (error) throw new Error(error.message)
      return data
    },
  })

  const handleCopy = async (proposal: Proposal) => {
    const url = proposalUrl(proposal.token)
    const didCopy = await copyToClipboard(url)
    if (didCopy) {
      setFallbackUrl(null)
      setCopiedId(proposal.id)
      if (copiedTimer.current) clearTimeout(copiedTimer.current)
      copiedTimer.current = setTimeout(
        () => setCopiedId(null),
        COPIED_FEEDBACK_MS
      )
    } else {
      setFallbackUrl(url)
    }
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      aria-label="Propostas do projeto"
      className="rounded-2xl border border-white/5 bg-surface-1 p-6"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
          <FileText className="h-4 w-4 text-accent" />
          Propostas
          {(proposals?.length ?? 0) > 0 && (
            <span className="text-xs font-light text-muted">
              ({proposals?.length})
            </span>
          )}
        </h2>
        <button
          type="button"
          onClick={() => setFormOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-white transition-colors duration-200 hover:bg-accent-2"
        >
          <Plus className="h-3.5 w-3.5" />
          Nova proposta
        </button>
      </div>

      {isLoading && (
        <div
          className="mt-4 flex flex-col gap-2"
          aria-label="Carregando propostas"
        >
          {Array.from({ length: SKELETON_ROWS }, (_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-xl bg-surface-2" />
          ))}
        </div>
      )}

      {isError && (
        <p className="mt-4 text-sm text-red-400">
          Não foi possível carregar as propostas.
        </p>
      )}

      {!isLoading && !isError && (proposals?.length ?? 0) === 0 && (
        <p className="mt-4 text-sm font-light text-muted">
          Nenhuma proposta para este projeto ainda.
        </p>
      )}

      {!isLoading && !isError && (proposals?.length ?? 0) > 0 && (
        <ul className="mt-4 flex flex-col divide-y divide-white/5">
          {(proposals ?? []).map((proposal) => {
            const statusMeta = getProposalStatusMeta(proposal.status)
            const canCopyLink =
              proposal.status === 'enviada' || proposal.status === 'aceita'
            return (
              <li
                key={proposal.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3 first:pt-0 last:pb-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">
                    {proposal.titulo}
                  </p>
                </div>
                <span className="text-sm font-medium tabular-nums text-ink/90">
                  {formatBRL(proposal.valor_total)}
                </span>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${statusMeta.badgeClass}`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${statusMeta.dotClass}`}
                  />
                  {statusMeta.label}
                </span>
                {canCopyLink && (
                  <button
                    type="button"
                    title="Copiar link público"
                    aria-label={`Copiar link da proposta ${proposal.titulo}`}
                    onClick={() => void handleCopy(proposal)}
                    className="rounded-lg p-1.5 text-muted/60 transition-colors duration-150 hover:bg-white/5 hover:text-ink"
                  >
                    {copiedId === proposal.id ? (
                      <Check className="h-4 w-4 text-emerald-300" />
                    ) : (
                      <Link2 className="h-4 w-4" />
                    )}
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {fallbackUrl && (
        <p className="mt-3 break-all rounded-lg border border-white/10 bg-surface-2 px-3 py-2 text-xs text-muted">
          Não foi possível copiar automaticamente — use o link:{' '}
          <span className="select-all text-ink/90">{fallbackUrl}</span>
        </p>
      )}

      <ProposalFormModal
        open={formOpen}
        lockedProjectId={projectId}
        onClose={() => setFormOpen(false)}
      />
    </motion.section>
  )
}
