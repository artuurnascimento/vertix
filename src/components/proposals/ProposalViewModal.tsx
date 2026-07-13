import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, Link2, X } from 'lucide-react'
import {
  formatBRL,
  formatDateBR,
  getProposalStatusMeta,
} from '../../lib/commercial'
import { formatRelativeTime } from '../../lib/format'
import {
  copyToClipboard,
  parseProposalInstallments,
  parseProposalItems,
  proposalUrl,
} from './proposalData'
import type { ProposalWithProject } from './proposalData'

interface ProposalViewModalProps {
  open: boolean
  proposal: ProposalWithProject | null
  onClose: () => void
}

const COPIED_FEEDBACK_MS = 2500

const sectionLabelClass =
  'text-[11px] font-medium uppercase tracking-widest text-muted/70'

/** Visualização somente leitura de uma proposta (itens, parcelas, aceite). */
export default function ProposalViewModal({
  open,
  proposal,
  onClose,
}: ProposalViewModalProps) {
  const [copied, setCopied] = useState(false)
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null)
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (open) {
      setCopied(false)
      setFallbackUrl(null)
    }
  }, [open])

  useEffect(() => {
    return () => {
      if (copiedTimer.current) clearTimeout(copiedTimer.current)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  const handleCopy = async () => {
    if (!proposal) return
    const url = proposalUrl(proposal.token)
    const didCopy = await copyToClipboard(url)
    if (didCopy) {
      setFallbackUrl(null)
      setCopied(true)
      if (copiedTimer.current) clearTimeout(copiedTimer.current)
      copiedTimer.current = setTimeout(
        () => setCopied(false),
        COPIED_FEEDBACK_MS
      )
    } else {
      setFallbackUrl(url)
    }
  }

  const itens = proposal ? parseProposalItems(proposal.itens) : []
  const parcelas = proposal ? parseProposalInstallments(proposal.parcelas) : []
  const statusMeta = proposal ? getProposalStatusMeta(proposal.status) : null

  return createPortal(
    <AnimatePresence>
      {open && proposal && statusMeta && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-bg/70 px-4 py-6 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) onClose()
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
            role="dialog"
            aria-modal="true"
            aria-label={`Proposta ${proposal.titulo}`}
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/5 bg-surface-1 p-7 font-kanit shadow-[0_24px_80px_-32px_rgba(108,91,242,0.35)]"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h2 className="text-lg font-semibold text-ink">
                    {proposal.titulo}
                  </h2>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${statusMeta.badgeClass}`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${statusMeta.dotClass}`}
                    />
                    {statusMeta.label}
                  </span>
                </div>
                {proposal.projects && (
                  <p className="mt-1 text-xs font-light text-muted">
                    {proposal.projects.nome}
                    {proposal.projects.clients &&
                      ` · ${proposal.projects.clients.nome}`}
                    {proposal.projects.clients?.empresa &&
                      ` (${proposal.projects.clients.empresa})`}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Fechar"
                className="rounded-lg p-1.5 text-muted transition-colors duration-200 hover:bg-white/5 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Itens */}
            <div className="mt-6 overflow-hidden rounded-xl border border-white/5">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/5 bg-surface-2/50 text-[11px] uppercase tracking-widest text-muted/70">
                    <th className="px-4 py-3 font-medium">Item</th>
                    <th className="px-3 py-3 text-center font-medium">Qtd</th>
                    <th className="px-3 py-3 text-right font-medium">
                      Unitário
                    </th>
                    <th className="px-4 py-3 text-right font-medium">
                      Subtotal
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {itens.map((item, index) => (
                    <tr
                      key={index}
                      className="border-b border-white/5 last:border-b-0"
                    >
                      <td className="px-4 py-3 text-ink/90">{item.descricao}</td>
                      <td className="px-3 py-3 text-center tabular-nums text-muted">
                        {item.quantidade}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-muted">
                        {formatBRL(item.valor_unitario)}
                      </td>
                      <td className="px-4 py-3 text-right font-medium tabular-nums text-ink">
                        {formatBRL(item.quantidade * item.valor_unitario)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex flex-col items-end gap-0.5">
              {proposal.desconto > 0 && (
                <p className="text-xs font-light tabular-nums text-muted">
                  Desconto: −{formatBRL(proposal.desconto)}
                </p>
              )}
              <p className="text-xl font-bold tabular-nums text-accent">
                {formatBRL(proposal.valor_total)}
              </p>
            </div>

            {proposal.condicoes && (
              <div className="mt-5">
                <h3 className={sectionLabelClass}>Condições</h3>
                <p className="mt-1.5 whitespace-pre-line text-sm font-light leading-relaxed text-ink/85">
                  {proposal.condicoes}
                </p>
              </div>
            )}

            {parcelas.length > 0 && (
              <div className="mt-5">
                <h3 className={sectionLabelClass}>Parcelas</h3>
                <div className="mt-2 overflow-hidden rounded-xl border border-white/5">
                  <table className="w-full text-left text-sm">
                    <tbody>
                      {parcelas.map((parcela, index) => (
                        <tr
                          key={index}
                          className="border-b border-white/5 last:border-b-0"
                        >
                          <td className="px-4 py-2.5 text-ink/90">
                            {parcela.descricao}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-muted">
                            {formatDateBR(parcela.vencimento)}
                          </td>
                          <td className="px-4 py-2.5 text-right font-medium tabular-nums text-ink">
                            {formatBRL(parcela.valor)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Meta + ações */}
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/5 pt-4">
              <div className="text-xs font-light text-muted">
                {proposal.validade && (
                  <p>Validade: {formatDateBR(proposal.validade)}</p>
                )}
                {proposal.sent_at && (
                  <p>Enviada {formatRelativeTime(proposal.sent_at)}</p>
                )}
                {proposal.status === 'aceita' && proposal.aceite_nome && (
                  <p className="text-emerald-300">
                    Aceita por {proposal.aceite_nome}
                    {proposal.accepted_at &&
                      ` em ${formatDateBR(proposal.accepted_at)}`}
                  </p>
                )}
                {proposal.status === 'recusada' && (
                  <p className="text-red-300">Proposta recusada pelo cliente.</p>
                )}
              </div>
              {proposal.status !== 'rascunho' && (
                <button
                  type="button"
                  onClick={() => void handleCopy()}
                  className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3.5 py-2 text-xs font-medium text-muted transition-colors duration-200 hover:bg-white/5 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-300" />
                      Link copiado!
                    </>
                  ) : (
                    <>
                      <Link2 className="h-3.5 w-3.5" />
                      Copiar link
                    </>
                  )}
                </button>
              )}
            </div>

            {fallbackUrl && (
              <p className="mt-3 break-all rounded-lg border border-white/10 bg-surface-2 px-3 py-2 text-xs text-muted">
                Não foi possível copiar automaticamente — use o link:{' '}
                <span className="select-all text-ink/90">{fallbackUrl}</span>
              </p>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}
