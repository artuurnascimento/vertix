import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ArrowRight, CheckCircle2, Clock, FileClock, ReceiptText } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { formatBRL, isOverdue } from '../../lib/commercial'
import { CardErrorState, CardSkeleton } from './CardStates'
import {
  useDashboardBriefings,
  useDashboardProposals,
  useDashboardReceivables,
} from './useDashboardData'

type ActionTone = 'red' | 'amber' | 'sky'

interface PendingAction {
  key: string
  title: string
  chipLabel: string
  tone: ActionTone
  to: string
  icon: LucideIcon
  /** Tamanho variado do cartão de missão — quebra a uniformidade da pilha. */
  size: 'lg' | 'md'
}

/** Borda esquerda 3px + fundo/texto — linguagem de status "cartão de missão". */
const TONE_CLASSES: Record<
  ActionTone,
  { border: string; chipClass: string; iconClass: string }
> = {
  red: {
    border: 'border-l-red-400',
    chipClass: 'border-red-400/30 bg-red-400/15 text-red-400',
    iconClass: 'bg-red-400/15 text-red-400',
  },
  amber: {
    border: 'border-l-amber-400',
    chipClass: 'border-amber-400/30 bg-amber-400/15 text-amber-300',
    iconClass: 'bg-amber-400/15 text-amber-300',
  },
  sky: {
    border: 'border-l-sky-300',
    chipClass: 'border-sky-300/30 bg-sky-300/15 text-sky-300',
    iconClass: 'bg-sky-300/15 text-sky-300',
  },
}

const MAX_ITEMS = 6
const ROW_STAGGER_S = 0.06

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
        (r, i): PendingAction => ({
          key: `receivable-${r.id}`,
          title: `${r.descricao} · ${formatBRL(r.valor)}`,
          chipLabel: 'Atrasado',
          tone: 'red',
          to: '/admin/financeiro',
          icon: ReceiptText,
          size: i === 0 ? 'lg' : 'md',
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
          tone: 'amber',
          to: '/admin/propostas',
          icon: Clock,
          size: 'md',
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
          tone: 'sky',
          to: '/admin/briefings',
          icon: FileClock,
          size: 'md',
        })
      )

    return [...overdue, ...sentProposals, ...waitingBriefings].slice(0, MAX_ITEMS)
  }, [receivables.data, proposals.data, briefings.data])

  return (
    <section className="relative flex h-full flex-col overflow-hidden rounded-3xl border border-white/5 bg-surface-1 p-6">
      <header className="flex items-baseline justify-between gap-3">
        <h2 className="font-kanit text-base font-semibold text-ink">Ações pendentes</h2>
        <p className="text-[11px] font-medium uppercase tracking-widest text-muted">
          O que precisa da sua atenção
        </p>
      </header>

      {isLoading && (
        <div className="mt-5">
          <CardSkeleton rows={3} rowClassName="h-16" />
        </div>
      )}

      {isError && (
        <div className="mt-5">
          <CardErrorState />
        </div>
      )}

      {!isLoading && !isError && actions.length === 0 && (
        <div className="flex flex-1 flex-col items-center justify-center px-4 py-8 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-full border border-emerald-400/25 bg-emerald-400/10">
            <CheckCircle2 className="h-5 w-5 text-emerald-300" />
          </span>
          <p className="mt-4 text-sm font-semibold text-ink">Tudo em dia</p>
          <p className="mt-1 max-w-[18rem] text-xs font-light leading-relaxed text-muted">
            Nenhuma pendência no momento. Parcelas, propostas e briefings estão em dia.
          </p>
        </div>
      )}

      {!isLoading && !isError && actions.length > 0 && (
        <ul className="mt-5 flex flex-1 flex-col gap-3">
          {actions.map((action, index) => {
            const Icon = action.icon
            const tone = TONE_CLASSES[action.tone]
            const isLarge = action.size === 'lg'
            return (
              <motion.li
                key={action.key}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * ROW_STAGGER_S }}
              >
                <Link
                  to={action.to}
                  className={`group flex items-center gap-4 rounded-r-xl border-l-[3px] ${tone.border} bg-white/[0.02] transition-colors duration-150 hover:bg-white/[0.05] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                    isLarge ? 'px-5 py-4' : 'px-4 py-3'
                  }`}
                >
                  <span
                    className={`flex shrink-0 items-center justify-center rounded-lg ${tone.iconClass} ${
                      isLarge ? 'h-10 w-10' : 'h-8 w-8'
                    }`}
                  >
                    <Icon aria-hidden className={isLarge ? 'h-5 w-5' : 'h-4 w-4'} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block truncate font-medium text-ink/90 transition-colors duration-150 group-hover:text-ink ${
                        isLarge ? 'text-base' : 'text-sm'
                      }`}
                    >
                      {action.title}
                    </span>
                  </span>
                  <span
                    className={`inline-flex shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-medium ${tone.chipClass}`}
                  >
                    {action.chipLabel}
                  </span>
                  <ArrowRight
                    aria-hidden
                    className="h-4 w-4 shrink-0 text-muted opacity-0 transition-opacity duration-150 group-hover:opacity-100"
                  />
                </Link>
              </motion.li>
            )
          })}
        </ul>
      )}

      {!isLoading && !isError && actions.length > 0 && (
        <Link
          to="/admin/projetos"
          className="group mt-5 -mx-6 -mb-6 flex items-center justify-center gap-1 border-t border-white/5 px-6 py-3 text-xs font-medium text-muted transition-colors duration-150 hover:bg-accent/5 hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Ver todas as ações
          <span aria-hidden className="transition-transform duration-150 group-hover:translate-x-0.5">
            →
          </span>
        </Link>
      )}
    </section>
  )
}
