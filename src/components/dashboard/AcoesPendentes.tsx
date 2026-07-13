import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { CheckCircle2, Clock, FileClock, ReceiptText } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { formatBRL, isOverdue } from '../../lib/commercial'
import DashboardCard from './DashboardCard'
import { CardErrorState, CardSkeleton } from './CardStates'
import {
  useDashboardBriefings,
  useDashboardProposals,
  useDashboardReceivables,
} from './useDashboardData'

type ActionChipTone = 'red' | 'amber' | 'sky'

interface PendingAction {
  key: string
  title: string
  chipLabel: string
  chipTone: ActionChipTone
  to: string
  icon: LucideIcon
}

/** Pílula de status — fundo cor/15, borda cor/30, texto cor (linguagem da referência). */
const CHIP_CLASSES: Record<ActionChipTone, string> = {
  red: 'border-red-400/30 bg-red-400/15 text-red-400',
  amber: 'border-amber-400/30 bg-amber-400/15 text-amber-300',
  sky: 'border-sky-300/30 bg-sky-300/15 text-sky-300',
}

/** Quadradinho de ícone colorido à esquerda — mesma linguagem visual dos KPIs. */
const ICON_WRAP_CLASSES: Record<ActionChipTone, string> = {
  red: 'bg-red-400/15 text-red-400',
  amber: 'bg-amber-400/15 text-amber-300',
  sky: 'bg-sky-300/15 text-sky-300',
}

const MAX_ITEMS = 6
const ROW_STAGGER_S = 0.05

/** Lista real e acionável: parcelas atrasadas, propostas sem resposta, briefings aguardando cliente. */
export default function AcoesPendentes() {
  const receivables = useDashboardReceivables()
  const proposals = useDashboardProposals()
  const briefings = useDashboardBriefings()

  const isLoading =
    receivables.isLoading || proposals.isLoading || briefings.isLoading
  const isError = receivables.isError || proposals.isError || briefings.isError

  const actions = useMemo<PendingAction[]>(() => {
    const now = new Date()
    const overdue = (receivables.data ?? [])
      .filter((r) => isOverdue(r.status, r.vencimento, now))
      .sort((a, b) => a.vencimento.localeCompare(b.vencimento))
      .map(
        (r): PendingAction => ({
          key: `receivable-${r.id}`,
          title: `${r.descricao} · ${formatBRL(r.valor)}`,
          chipLabel: 'Atrasado',
          chipTone: 'red',
          to: '/admin/financeiro',
          icon: ReceiptText,
        })
      )

    const sentProposals = (proposals.data ?? [])
      .filter((p) => p.status === 'enviada')
      .sort((a, b) => (a.sent_at ?? '').localeCompare(b.sent_at ?? ''))
      .map(
        (p): PendingAction => ({
          key: `proposal-${p.id}`,
          title: `Proposta de ${formatBRL(p.valor_total)} sem resposta`,
          chipLabel: 'Aguardando',
          chipTone: 'amber',
          to: '/admin/propostas',
          icon: Clock,
        })
      )

    const waitingBriefings = (briefings.data ?? [])
      .filter((b) => b.status === 'enviado')
      .map(
        (b): PendingAction => ({
          key: `briefing-${b.id}`,
          title: b.projects?.nome
            ? `Briefing de "${b.projects.nome}" aguardando cliente`
            : 'Briefing aguardando cliente',
          chipLabel: 'Aguardando',
          chipTone: 'sky',
          to: '/admin/briefings',
          icon: FileClock,
        })
      )

    return [...overdue, ...sentProposals, ...waitingBriefings].slice(
      0,
      MAX_ITEMS
    )
  }, [receivables.data, proposals.data, briefings.data])

  return (
    <DashboardCard title="Ações pendentes" subtitle="O que precisa da sua atenção">
      {isLoading && <CardSkeleton rows={4} rowClassName="h-10" />}

      {isError && <CardErrorState />}

      {!isLoading && !isError && actions.length === 0 && (
        <div className="flex h-full min-h-[10rem] flex-col items-center justify-center px-4 py-6 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-full border border-emerald-400/25 bg-emerald-400/10">
            <CheckCircle2 className="h-5 w-5 text-emerald-300" />
          </span>
          <p className="mt-4 text-sm font-semibold text-ink">Tudo em dia 🎉</p>
          <p className="mt-1 max-w-[16rem] text-xs font-light leading-relaxed text-muted">
            Nenhuma pendência no momento. Parcelas, propostas e briefings estão
            em dia.
          </p>
        </div>
      )}

      {!isLoading && !isError && actions.length > 0 && (
        <ul className="flex flex-col">
          {actions.map((action, index) => {
            const Icon = action.icon
            return (
              <motion.li
                key={action.key}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: index * ROW_STAGGER_S }}
                className="border-b border-white/5 py-2.5 first:pt-0 last:border-b-0 last:pb-0"
              >
                <Link
                  to={action.to}
                  className="group flex items-center gap-3 rounded-lg transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${ICON_WRAP_CLASSES[action.chipTone]}`}
                  >
                    <Icon aria-hidden className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-ink/90 transition-colors duration-150 group-hover:text-ink">
                    {action.title}
                  </span>
                  <span
                    className={`inline-flex shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium ${CHIP_CLASSES[action.chipTone]}`}
                  >
                    {action.chipLabel}
                  </span>
                </Link>
              </motion.li>
            )
          })}
        </ul>
      )}

      {!isLoading && !isError && actions.length > 0 && (
        <Link
          to="/admin/projetos"
          className="group -mx-6 -mb-6 mt-4 flex items-center justify-center gap-1 border-t border-white/5 px-6 py-3 text-xs font-medium text-muted transition-colors duration-150 hover:bg-accent/5 hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Ver todas as ações
          <span aria-hidden className="transition-transform duration-150 group-hover:translate-x-0.5">
            →
          </span>
        </Link>
      )}
    </DashboardCard>
  )
}
