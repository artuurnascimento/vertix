import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { MessageCircle, Users } from 'lucide-react'
import { formatRelativeTime } from '../../lib/format'
import ScoreBadge from '../leadsRaiox/ScoreBadge'
import { mensagemFollowUp, scanStatusMeta, whatsappLink } from './scanProxy'
import type { ScanLead } from './scanProxy'

/**
 * Tabela de leads do Vertix Scan (padrão visual da LeadsTab do Raio-X).
 * Cada linha: nome, WhatsApp (wa.me), loja (domínio com a URL completa no
 * tooltip), score, status e data — ordenada por data desc pela página.
 */

interface ScanLeadsTableProps {
  leads: ScanLead[]
}

export default function ScanLeadsTable({ leads }: ScanLeadsTableProps) {
  const prefersReducedMotion = useReducedMotion()

  if (leads.length === 0) {
    return (
      <div className="rounded-xl border border-white/5 bg-surface-1 px-6 py-14 text-center">
        <Users className="mx-auto h-8 w-8 text-muted/50" />
        <p className="mt-3 text-sm font-light text-muted">
          Nenhum lead ainda — divulgue o Vertix Scan.
        </p>
      </div>
    )
  }

  return (
    <ul className="flex list-none flex-col gap-3 p-0">
      <AnimatePresence initial={false}>
        {leads.map((lead) => {
          // Follow-up em 1 clique: abre o WhatsApp do lead com o link do relatório
          const waLink = whatsappLink(lead.whatsapp, mensagemFollowUp(lead))
          const statusMeta = scanStatusMeta(lead.status)

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
                    {lead.nome}
                  </p>
                  <p className="mt-0.5 truncate font-mono text-xs font-light text-muted">
                    {lead.whatsapp}
                    <span title={lead.loja_url}>{` · ${lead.dominio}`}</span>
                  </p>
                </div>

                <ScoreBadge score={lead.score} />

                <span
                  className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${statusMeta.className}`}
                >
                  {statusMeta.label}
                </span>

                <span className="tabular-nums text-xs font-light text-muted">
                  {formatRelativeTime(lead.criado_em)}
                </span>

                {/* Leitura do relatório: o melhor momento para chamar é logo depois. */}
                {lead.relatorio_aberto_em ? (
                  <span
                    className="inline-flex rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-300"
                    title={`Relatório aberto em ${new Date(lead.relatorio_aberto_em).toLocaleString('pt-BR')}`}
                  >
                    leu {formatRelativeTime(lead.relatorio_aberto_em)}
                  </span>
                ) : (
                  <span className="inline-flex rounded-full border border-white/10 px-2.5 py-0.5 text-[11px] font-light text-muted">
                    não abriu
                  </span>
                )}

                {waLink && (
                  <a
                    href={waLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-300 transition-colors duration-150 hover:bg-emerald-500/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    {lead.relatorio_url ? 'Enviar relatório' : 'WhatsApp'}
                  </a>
                )}
              </div>
            </motion.li>
          )
        })}
      </AnimatePresence>
    </ul>
  )
}
