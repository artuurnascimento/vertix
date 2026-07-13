import { useMemo } from 'react'
import { ClipboardList, FileText, FolderKanban, Wallet } from 'lucide-react'
import { formatBRL } from '../../lib/commercial'
import { isActiveStatus } from '../../lib/format'
import KpiCard from './KpiCard'
import type { KpiAccent } from './KpiCard'
import {
  useDashboardBriefings,
  useDashboardProjects,
  useDashboardProposals,
  useDashboardReceivables,
} from './useDashboardData'
import type {
  DashboardProject,
  DashboardReceivable,
} from './useDashboardData'

const SKELETON_CARDS = 4
const MONTHS_FOR_SPARKLINE = 6

/** Paleta neon por módulo — uma cor própria por KPI (identidade visual da referência). */
const ACCENT_REVENUE: KpiAccent = {
  hex: '#6C5BF2',
  chipClass: 'bg-accent/15 text-accent',
  borderHoverClass: 'hover:border-accent/30 hover:shadow-[0_0_24px_-8px_rgba(108,91,242,0.5)]',
}
const ACCENT_PROJECTS: KpiAccent = {
  hex: '#38BDF8',
  chipClass: 'bg-sky-400/15 text-sky-400',
  borderHoverClass: 'hover:border-sky-400/30 hover:shadow-[0_0_24px_-8px_rgba(56,189,248,0.5)]',
}
const ACCENT_PROPOSALS: KpiAccent = {
  hex: '#22D3D8',
  chipClass: 'bg-cyan-300/15 text-cyan-300',
  borderHoverClass: 'hover:border-cyan-300/30 hover:shadow-[0_0_24px_-8px_rgba(45,212,216,0.5)]',
}
const ACCENT_BRIEFINGS: KpiAccent = {
  hex: '#FBBF24',
  chipClass: 'bg-amber-400/15 text-amber-400',
  borderHoverClass: 'hover:border-amber-400/30 hover:shadow-[0_0_24px_-8px_rgba(251,191,36,0.5)]',
}

function monthKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${date.getFullYear()}-${month}`
}

function monthsAgoKey(now: Date, monthsAgo: number): string {
  return monthKey(new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1))
}

/** Soma de recebíveis pagos com vencimento no mês informado (chave 'YYYY-MM'). */
function revenueForMonth(
  receivables: readonly DashboardReceivable[],
  key: string
): number {
  return receivables
    .filter((r) => r.status === 'pago' && r.vencimento.slice(0, 7) === key)
    .reduce((sum, r) => sum + r.valor, 0)
}

/** % de variação entre dois valores — null quando o anterior é 0 (sem base de comparação). */
function percentDelta(current: number, previous: number): number | null {
  if (previous === 0) return null
  return ((current - previous) / previous) * 100
}

/** Série de contagem de projetos criados por mês (últimos N meses). */
function countSparkline(
  rows: readonly DashboardProject[],
  now: Date,
  predicate: (row: DashboardProject) => boolean
): { key: string; value: number }[] {
  return Array.from({ length: MONTHS_FOR_SPARKLINE }, (_, i) => {
    const key = monthsAgoKey(now, MONTHS_FOR_SPARKLINE - 1 - i)
    const value = rows.filter(
      (row) => predicate(row) && row.created_at.slice(0, 7) === key
    ).length
    return { key, value }
  })
}

export default function KpiRow() {
  const projects = useDashboardProjects()
  const proposals = useDashboardProposals()
  const receivables = useDashboardReceivables()
  const briefings = useDashboardBriefings()

  const isLoading =
    projects.isLoading ||
    proposals.isLoading ||
    receivables.isLoading ||
    briefings.isLoading
  const isError =
    projects.isError || proposals.isError || receivables.isError || briefings.isError

  const metrics = useMemo(() => {
    const projectRows = projects.data ?? []
    const proposalRows = proposals.data ?? []
    const receivableRows = receivables.data ?? []
    const briefingRows = briefings.data ?? []
    const now = new Date()
    const currentKey = monthKey(now)
    const previousKey = monthsAgoKey(now, 1)

    // Receita do mês: recebíveis pagas com vencimento no mês corrente.
    const revenueThisMonth = revenueForMonth(receivableRows, currentKey)
    const revenueLastMonth = revenueForMonth(receivableRows, previousKey)
    const revenueDelta = percentDelta(revenueThisMonth, revenueLastMonth)
    const revenueSparkline = Array.from(
      { length: MONTHS_FOR_SPARKLINE },
      (_, i) => {
        const key = monthsAgoKey(now, MONTHS_FOR_SPARKLINE - 1 - i)
        return { key, value: revenueForMonth(receivableRows, key) }
      }
    )

    const activeProjects = projectRows.filter((p) => isActiveStatus(p.status))
    const activeSparkline = countSparkline(projectRows, now, (row) =>
      isActiveStatus(row.status)
    )

    const sentProposals = proposalRows.filter((p) => p.status === 'enviada')

    const openBriefings = briefingRows.filter((b) => b.status !== 'preenchido')

    return {
      revenueThisMonth,
      revenueDelta,
      revenueSparkline,
      activeCount: activeProjects.length,
      activeSparkline,
      sentProposalsCount: sentProposals.length,
      openBriefingsCount: openBriefings.length,
    }
  }, [projects.data, proposals.data, receivables.data, briefings.data])

  if (isLoading) {
    return (
      <div
        aria-label="Carregando indicadores"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        {Array.from({ length: SKELETON_CARDS }, (_, i) => (
          <div
            key={i}
            className="h-36 animate-pulse rounded-2xl border border-white/5 bg-surface-1"
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
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard
        index={0}
        label="Receita do mês"
        value={metrics.revenueThisMonth}
        format={formatBRL}
        icon={Wallet}
        accent={ACCENT_REVENUE}
        sparkline={metrics.revenueSparkline}
        delta={
          metrics.revenueDelta !== null
            ? { percent: metrics.revenueDelta, label: 'vs. mês anterior' }
            : undefined
        }
      />
      <KpiCard
        index={1}
        label="Projetos ativos"
        value={metrics.activeCount}
        format={(v) => String(Math.round(v))}
        icon={FolderKanban}
        accent={ACCENT_PROJECTS}
        sparkline={metrics.activeSparkline}
      />
      <KpiCard
        index={2}
        label="Propostas aguardando"
        value={metrics.sentProposalsCount}
        format={(v) => String(Math.round(v))}
        icon={FileText}
        accent={ACCENT_PROPOSALS}
      />
      <KpiCard
        index={3}
        label="Briefings abertos"
        value={metrics.openBriefingsCount}
        format={(v) => String(Math.round(v))}
        icon={ClipboardList}
        accent={ACCENT_BRIEFINGS}
      />
    </div>
  )
}
