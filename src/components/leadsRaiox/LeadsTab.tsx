import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ExternalLink, MessageCircle, Users } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { formatRelativeTime } from '../../lib/format'
import { reportUrl, updateLeadStatus, whatsappLinkForLead } from './raioxData'
import type { LeadComAnalise, LeadStatus } from './raioxTypes'
import LeadStatusPicker from './LeadStatusPicker'
import ScoreBadge from './ScoreBadge'

/**
 * Aba Leads — lista de quem desbloqueou o relatório do Raio-X.
 * Cada linha: nome, WhatsApp, domínio, nota, data, status editável,
 * link do relatório e botão WhatsApp com mensagem contextualizada.
 */

interface LeadsTabProps {
  leads: LeadComAnalise[]
  statusFilter: LeadStatus | 'todos'
  search: string
}

export default function LeadsTab({ leads, statusFilter, search }: LeadsTabProps) {
  const queryClient = useQueryClient()
  const prefersReducedMotion = useReducedMotion()

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: LeadStatus }) =>
      updateLeadStatus(id, status),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['raiox-leads'] }),
  })

  const termo = search.trim().toLowerCase()
  const visiveis = leads.filter((lead) => {
    if (statusFilter !== 'todos' && lead.status !== statusFilter) return false
    if (termo === '') return true
    const alvo = `${lead.name} ${lead.analyses?.domain ?? ''}`.toLowerCase()
    return alvo.includes(termo)
  })

  if (leads.length === 0) {
    return (
      <div className="rounded-xl border border-white/5 bg-surface-1 px-6 py-14 text-center">
        <Users className="mx-auto h-8 w-8 text-muted/50" />
        <p className="mt-3 text-sm font-light text-muted">
          Nenhum lead ainda — divulgue a ferramenta.
        </p>
      </div>
    )
  }

  if (visiveis.length === 0) {
    return (
      <div className="rounded-xl border border-white/5 bg-surface-1 px-6 py-10 text-center">
        <p className="text-sm font-light text-muted">
          Nenhum lead com esse filtro.
        </p>
      </div>
    )
  }

  return (
    <ul className="flex list-none flex-col gap-3 p-0">
      <AnimatePresence initial={false}>
        {visiveis.map((lead) => {
          const waLink = whatsappLinkForLead(lead)
          const salvando =
            statusMutation.isPending &&
            statusMutation.variables?.id === lead.id

          return (
            <motion.li
              key={lead.id}
              initial={prefersReducedMotion ? undefined : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={prefersReducedMotion ? undefined : { opacity: 0 }}
              className="rounded-xl border border-white/5 bg-surface-1"
            >
              <div className="flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-4">
                <div className="min-w-0 flex-1 basis-48">
                  <p className="truncate text-sm font-medium text-ink">
                    {lead.name}
                  </p>
                  <p className="mt-0.5 truncate font-mono text-xs font-light text-muted">
                    {lead.whatsapp}
                    {lead.analyses ? ` · ${lead.analyses.domain}` : ''}
                  </p>
                </div>

                <ScoreBadge score={lead.analyses?.score ?? null} />

                <span className="tabular-nums text-xs font-light text-muted">
                  {formatRelativeTime(lead.created_at)}
                </span>

                <LeadStatusPicker
                  value={lead.status}
                  disabled={salvando}
                  onChange={(status) =>
                    statusMutation.mutate({ id: lead.id, status })
                  }
                />

                <div className="flex items-center gap-2">
                  {lead.analyses && reportUrl(lead.analyses.id, lead.report_token, lead.report_code) && (
                    <a
                      href={
                        reportUrl(lead.analyses.id, lead.report_token, lead.report_code) ?? undefined
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-muted transition-colors duration-150 hover:bg-white/5 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Abrir relatório
                    </a>
                  )}
                  {waLink && (
                    <a
                      href={waLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-300 transition-colors duration-150 hover:bg-emerald-500/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                      WhatsApp
                    </a>
                  )}
                </div>
              </div>

              {statusMutation.isError &&
                statusMutation.variables?.id === lead.id && (
                  <p className="border-t border-white/5 px-5 py-2 text-xs font-light text-red-300">
                    Não deu para salvar o status. Tente de novo.
                  </p>
                )}
            </motion.li>
          )
        })}
      </AnimatePresence>
    </ul>
  )
}
