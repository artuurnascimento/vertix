import { Link } from 'react-router-dom'
import {
  Banknote,
  ChartNoAxesCombined,
  FileCheck2,
  FolderKanban,
} from 'lucide-react'
import {
  useDashboardProjects,
  useDashboardProposals,
  useDashboardReceivables,
} from './useDashboardData'
import { isActiveStatus } from '../../lib/format'
import { formatBRL } from '../../lib/commercial'
import { monthlyReceipts } from './receiptSeries'

export default function ExecutiveMetrics() {
  const projects = useDashboardProjects()
  const proposals = useDashboardProposals()
  const receivables = useDashboardReceivables()
  const months = monthlyReceipts(receivables.data ?? [], new Date())
  const revenue = months[months.length - 1].total
  const previous = months[months.length - 2].total
  const compactMoney = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    notation: 'compact',
    maximumFractionDigits: 1,
  })
  const negotiation = (proposals.data ?? [])
    .filter((p) => p.status === 'enviada')
    .reduce((s, p) => s + p.valor_total, 0)
  const delta = previous > 0 ? ((revenue - previous) / previous) * 100 : null
  const cards = [
    {
      label: 'Recebido no mês',
      value: formatBRL(revenue),
      caption:
        delta === null
          ? 'Pagamentos confirmados'
          : `${delta >= 0 ? '+' : ''}${delta.toFixed(0)}% vs. mês anterior`,
      icon: Banknote,
      to: '/admin/financeiro',
      query: receivables,
    },
    {
      label: 'Em negociação',
      value: formatBRL(
        (proposals.data ?? [])
          .filter((p) => p.status === 'enviada')
          .reduce((s, p) => s + p.valor_total, 0)
      ),
      caption: 'Propostas aguardando aceite',
      icon: ChartNoAxesCombined,
      to: '/admin/propostas',
      query: proposals,
    },
    {
      label: 'Propostas aceitas',
      value: String(
        (proposals.data ?? []).filter((p) => p.status === 'aceita').length
      ),
      caption: 'Total registrado',
      icon: FileCheck2,
      to: '/admin/propostas',
      query: proposals,
    },
    {
      label: 'Projetos ativos',
      value: String(
        (projects.data ?? []).filter((p) => isActiveStatus(p.status)).length
      ),
      caption: 'Da captação à revisão',
      icon: FolderKanban,
      to: '/admin/projetos',
      query: projects,
    },
  ]
  const max = Math.max(...months.map((m) => m.total), 1)
  return (
    <div className="vx-metrics">
      {cards.map(({ label, value, caption, icon: Icon, to, query }, i) => (
        <Link
          key={label}
          to={to}
          className="vx-metric vx-glass"
          aria-label={`${label}: ${query.isLoading ? 'Carregando' : query.isError ? 'Indisponível' : value}`}
        >
          <div className="vx-metric-heading">
            <span>{label}</span>
            <span className="vx-metric-icon">
              <Icon size={20} />
            </span>
          </div>
          {query.isLoading ? (
            <div className="vx-loading" aria-label="Carregando indicador" />
          ) : query.isError ? (
            <p role="alert" className="vx-metric-error">
              Dados indisponíveis
            </p>
          ) : (
            <>
              <strong title={value}>
                <span className="vx-value-full">{value}</span>
                <span className="vx-value-compact">
                  {i === 0
                    ? compactMoney.format(revenue)
                    : i === 1
                      ? compactMoney.format(negotiation)
                      : value}
                </span>
              </strong>
              <small>{caption}</small>
              {i === 0 && (
                <div
                  className="vx-mini-bars"
                  role="img"
                  aria-label={months
                    .map((m) => `${m.label}: ${formatBRL(m.total)}`)
                    .join('; ')}
                >
                  {months.map((m) => (
                    <span key={m.key}>
                      <i
                        style={{
                          height: `${Math.max((m.total / max) * 100, 3)}%`,
                        }}
                      />
                      <em>{m.label}</em>
                    </span>
                  ))}
                </div>
              )}
              {i !== 0 && (
                <Icon className="vx-metric-watermark" aria-hidden="true" />
              )}
            </>
          )}
        </Link>
      ))}
    </div>
  )
}
