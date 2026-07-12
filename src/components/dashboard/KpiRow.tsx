import { useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  FileText,
  FolderKanban,
  Target,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { formatBRL, isOverdue } from '../../lib/commercial'
import { isActiveStatus } from '../../lib/format'
import {
  useDashboardProjects,
  useDashboardProposals,
  useDashboardReceivables,
} from './useDashboardData'

interface KpiCard {
  key: string
  label: string
  value: string
  valueClass: string
  context: ReactNode
  icon: LucideIcon
}

const SKELETON_CARDS = 5
const CARD_STAGGER_S = 0.06

const monthNameFormatter = new Intl.DateTimeFormat('pt-BR', { month: 'long' })

function currentMonthKey(now: Date): string {
  const month = String(now.getMonth() + 1).padStart(2, '0')
  return `${now.getFullYear()}-${month}`
}

export default function KpiRow() {
  const projects = useDashboardProjects()
  const proposals = useDashboardProposals()
  const receivables = useDashboardReceivables()

  const isLoading =
    projects.isLoading || proposals.isLoading || receivables.isLoading
  const isError = projects.isError || proposals.isError || receivables.isError

  const cards = useMemo<KpiCard[]>(() => {
    const projectRows = projects.data ?? []
    const proposalRows = proposals.data ?? []
    const receivableRows = receivables.data ?? []
    const now = new Date()
    const monthKey = currentMonthKey(now)
    const monthName = monthNameFormatter.format(now)

    // Projetos ativos = tudo que ainda não foi entregue.
    const activeCount = projectRows.filter((p) =>
      isActiveStatus(p.status)
    ).length
    const inDevCount = projectRows.filter(
      (p) => p.status === 'em_desenvolvimento'
    ).length

    // Leads = projetos parados na etapa inicial do funil.
    const leadCount = projectRows.filter((p) => p.status === 'lead').length

    // Propostas aguardando resposta do cliente.
    const sentProposals = proposalRows.filter((p) => p.status === 'enviada')
    const sentSum = sentProposals.reduce((sum, p) => sum + p.valor_total, 0)

    // A receber = recebíveis pendentes; atrasado é derivado por vencimento.
    const pending = receivableRows.filter((r) => r.status === 'pendente')
    const pendingSum = pending.reduce((sum, r) => sum + r.valor, 0)
    const overdueSum = pending
      .filter((r) => isOverdue(r.status, r.vencimento, now))
      .reduce((sum, r) => sum + r.valor, 0)

    // Recebido no mês corrente (pago_em dentro do mês).
    const paidThisMonth = receivableRows.filter(
      (r) =>
        r.status === 'pago' &&
        r.pago_em !== null &&
        r.pago_em.slice(0, 7) === monthKey
    )
    const paidSum = paidThisMonth.reduce((sum, r) => sum + r.valor, 0)

    return [
      {
        key: 'active-projects',
        label: 'Projetos ativos',
        value: String(activeCount),
        valueClass: 'text-3xl text-ink',
        context:
          inDevCount > 0
            ? `${inDevCount} em desenvolvimento`
            : 'nenhum em desenvolvimento',
        icon: FolderKanban,
      },
      {
        key: 'leads',
        label: 'Leads no pipeline',
        value: String(leadCount),
        valueClass: 'text-3xl text-ink',
        context:
          leadCount === 1 ? 'oportunidade em aberto' : 'oportunidades em aberto',
        icon: Target,
      },
      {
        key: 'proposals-sent',
        label: 'Propostas aguardando',
        value: String(sentProposals.length),
        valueClass: 'text-3xl text-ink',
        context:
          sentProposals.length > 0
            ? `${formatBRL(sentSum)} em negociação`
            : 'nenhuma em negociação',
        icon: FileText,
      },
      {
        key: 'receivable',
        label: 'A receber',
        value: formatBRL(pendingSum),
        valueClass: 'text-2xl text-ink',
        context:
          overdueSum > 0 ? (
            <span className="text-red-400">
              {formatBRL(overdueSum)} em atraso
            </span>
          ) : (
            'sem atrasos'
          ),
        icon: Wallet,
      },
      {
        key: 'paid-month',
        label: 'Recebido no mês',
        value: formatBRL(paidSum),
        valueClass: 'text-2xl text-emerald-300',
        context: `${paidThisMonth.length} pagamento${
          paidThisMonth.length === 1 ? '' : 's'
        } em ${monthName}`,
        icon: TrendingUp,
      },
    ]
  }, [projects.data, proposals.data, receivables.data])

  if (isLoading) {
    return (
      <div
        aria-label="Carregando indicadores"
        className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5"
      >
        {Array.from({ length: SKELETON_CARDS }, (_, i) => (
          <div
            key={i}
            className="h-28 animate-pulse rounded-2xl border border-white/5 bg-surface-1"
            style={{ opacity: 1 - i * 0.12 }}
          />
        ))}
      </div>
    )
  }

  if (isError) {
    return (
      <div className="rounded-2xl border border-white/5 bg-surface-1 px-6 py-8">
        <p className="text-center text-sm font-light text-red-400" role="alert">
          Não foi possível carregar os indicadores. Recarregue a página.
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
      {cards.map((card, index) => {
        const Icon = card.icon
        return (
          <motion.article
            key={card.key}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * CARD_STAGGER_S }}
            className="rounded-2xl border border-white/5 bg-surface-1 p-5 transition-colors duration-200 hover:border-white/10"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-[11px] font-medium uppercase tracking-widest text-muted/70">
                {card.label}
              </p>
              <Icon aria-hidden className="h-4 w-4 shrink-0 text-muted/40" />
            </div>
            <p
              className={`mt-3 font-kanit font-bold leading-none ${card.valueClass}`}
            >
              {card.value}
            </p>
            <p className="mt-2 text-xs font-light text-muted">{card.context}</p>
          </motion.article>
        )
      })}
    </div>
  )
}
