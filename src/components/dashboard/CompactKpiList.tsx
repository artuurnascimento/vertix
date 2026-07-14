import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { ClipboardList, FileText, FolderKanban } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { isActiveStatus } from '../../lib/format'
import SparkLine from './SparkLine'
import {
  useDashboardBriefings,
  useDashboardProjects,
  useDashboardProposals,
} from './useDashboardData'
import type { DashboardProject } from './useDashboardData'

const MONTHS_FOR_SPARKLINE = 6
const ROW_STAGGER_S = 0.07

interface CompactRow {
  key: string
  label: string
  value: number
  icon: LucideIcon
  colorHex: string
  iconClass: string
  sparkline?: readonly { key: string; value: number }[]
}

function monthKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${date.getFullYear()}-${month}`
}

function monthsAgoKey(now: Date, monthsAgo: number): string {
  return monthKey(new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1))
}

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

/**
 * Coluna de KPIs compactos — linhas horizontais finas (não cards quadrados),
 * separadas por hairline. Substitui 3 dos 4 cards do antigo KpiRow (a receita
 * virou o card herói). Projetos ativos / Propostas aguardando / Briefings abertos.
 */
export default function CompactKpiList() {
  const projects = useDashboardProjects()
  const proposals = useDashboardProposals()
  const briefings = useDashboardBriefings()

  const isLoading = projects.isLoading || proposals.isLoading || briefings.isLoading
  const isError = projects.isError || proposals.isError || briefings.isError

  const rows = useMemo<CompactRow[]>(() => {
    const now = new Date()
    const projectRows = projects.data ?? []
    const proposalRows = proposals.data ?? []
    const briefingRows = briefings.data ?? []

    const activeProjects = projectRows.filter((p) => isActiveStatus(p.status))
    const activeSparkline = countSparkline(projectRows, now, (row) =>
      isActiveStatus(row.status)
    )
    const sentProposals = proposalRows.filter((p) => p.status === 'enviada')
    const openBriefings = briefingRows.filter((b) => b.status !== 'preenchido')

    return [
      {
        key: 'projects',
        label: 'Projetos ativos',
        value: activeProjects.length,
        icon: FolderKanban,
        colorHex: '#38BDF8',
        iconClass: 'bg-sky-400/15 text-sky-400',
        sparkline: activeSparkline,
      },
      {
        key: 'proposals',
        label: 'Propostas aguardando',
        value: sentProposals.length,
        icon: FileText,
        colorHex: '#22D3D8',
        iconClass: 'bg-cyan-300/15 text-cyan-300',
      },
      {
        key: 'briefings',
        label: 'Briefings abertos',
        value: openBriefings.length,
        icon: ClipboardList,
        colorHex: '#FBBF24',
        iconClass: 'bg-amber-400/15 text-amber-400',
      },
    ]
  }, [projects.data, proposals.data, briefings.data])

  if (isLoading) {
    return (
      <div
        aria-label="Carregando indicadores"
        className="flex h-full flex-col justify-center gap-5 rounded-3xl border border-white/5 bg-surface-1 px-6 py-6"
      >
        {Array.from({ length: 3 }, (_, i) => (
          <div
            key={i}
            className="h-9 animate-pulse rounded-lg bg-white/5"
            style={{ opacity: 1 - i * 0.15 }}
          />
        ))}
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex h-full items-center justify-center rounded-3xl border border-white/5 bg-surface-1 px-6 py-8">
        <p className="text-center text-sm font-light text-red-400" role="alert">
          Não foi possível carregar os indicadores.
        </p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col rounded-3xl border border-white/5 bg-gradient-to-b from-surface-1 to-[#101018] px-6 shadow-[0_1px_0_0_rgba(255,255,255,0.06)_inset]">
      {rows.map((row, index) => {
        const Icon = row.icon
        return (
          <motion.div
            key={row.key}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.4,
              delay: index * ROW_STAGGER_S,
              ease: [0.16, 1, 0.3, 1],
            }}
            className={`flex flex-1 items-center gap-4 ${
              index !== rows.length - 1 ? 'border-b border-white/5' : ''
            }`}
          >
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${row.iconClass}`}
            >
              <Icon aria-hidden className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1 text-[11px] font-medium uppercase tracking-widest text-muted">
              {row.label}
            </span>
            {row.sparkline && row.sparkline.length >= 2 && (
              <span className="hidden w-16 shrink-0 sm:block">
                <SparkLine points={row.sparkline} colorHex={row.colorHex} />
              </span>
            )}
            <span className="shrink-0 font-kanit text-2xl font-bold tabular-nums text-ink">
              {row.value}
            </span>
          </motion.div>
        )
      })}
    </div>
  )
}
