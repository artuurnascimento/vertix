import type { CSSProperties, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { BarChart3, DollarSign, Folder, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { UseQueryResult } from '@tanstack/react-query'
import {
  useDashboardPedidos,
  useDashboardProjects,
  useDashboardProposals,
  useDashboardReceivables,
} from './useDashboardData'
import { formatBRL } from '../../lib/commercial'
import { monthlyReceipts } from './receiptSeries'
import {
  distribuicaoProjetos,
  negociacaoMensal,
  planosMensal,
  variacaoPercentual,
} from './metricas'
import { Barras, Donut, Linha, Numero, ValorMoeda, Variacao } from './MetricaGraficos'

const COMPACTO = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  notation: 'compact',
  maximumFractionDigits: 1,
})

const inteiro = (n: number) => String(n)

interface Card {
  label: string
  icon: LucideIcon
  to: string
  query: UseQueryResult<unknown>
  /** Valor lido pelo leitor de tela e mostrado no title. */
  valorTexto: string
  valor: ReactNode
  /** Versão curta para o celular; sem ela, `valor` serve nos dois. */
  valorCompacto?: ReactNode
  variacao?: ReactNode
  legenda: string
  grafico: ReactNode
}

/**
 * Os quatro cards do topo do painel, como no mockup: variação contra o mês
 * anterior em cada um, e um gráfico por card — barras 3D da receita, barras
 * mensais do que está em negociação, linha dos planos vendidos no checkout,
 * donut dos projetos por etapa.
 */
export default function ExecutiveMetrics() {
  const projects = useDashboardProjects()
  const proposals = useDashboardProposals()
  const receivables = useDashboardReceivables()
  const pedidos = useDashboardPedidos()
  const agora = new Date()

  const receita = monthlyReceipts(receivables.data ?? [], agora)
  const negociacao = negociacaoMensal(proposals.data ?? [], agora)
  const planos = planosMensal(pedidos.data ?? [], agora)
  const projetos = distribuicaoProjetos((projects.data ?? []).map((p) => p.status))

  const ultimo = (s: { total: number }[]) => s[s.length - 1].total
  const penultimo = (s: { total: number }[]) => s[s.length - 2].total
  const variacaoDe = (s: { total: number }[]) => variacaoPercentual(ultimo(s), penultimo(s))

  const cards: Card[] = [
    {
      label: 'Receita do mês',
      icon: DollarSign,
      to: '/admin/financeiro',
      query: receivables,
      valorTexto: formatBRL(ultimo(receita)),
      valor: <ValorMoeda valor={ultimo(receita)} />,
      valorCompacto: <Numero valor={ultimo(receita)} formatar={COMPACTO.format} />,
      variacao: <Variacao valor={variacaoDe(receita)} tom="verde" />,
      legenda: variacaoDe(receita) === null ? 'Pagamentos confirmados' : 'em relação ao mês anterior',
      grafico: <Barras serie={receita} formatar={formatBRL} prisma />,
    },
    {
      label: 'Em negociação',
      icon: BarChart3,
      to: '/admin/propostas',
      query: proposals,
      valorTexto: formatBRL(ultimo(negociacao)),
      valor: <ValorMoeda valor={ultimo(negociacao)} />,
      valorCompacto: <Numero valor={ultimo(negociacao)} formatar={COMPACTO.format} />,
      variacao: <Variacao valor={variacaoDe(negociacao)} tom="roxo" />,
      legenda:
        variacaoDe(negociacao) === null ? 'Propostas aguardando aceite' : 'em relação ao mês anterior',
      grafico: <Barras serie={negociacao} formatar={formatBRL} rotulos />,
    },
    {
      label: 'Planos vendidos',
      icon: Users,
      to: '/admin/pedidos',
      query: pedidos,
      valorTexto: inteiro(ultimo(planos)),
      valor: <Numero valor={ultimo(planos)} />,
      variacao: <Variacao valor={variacaoDe(planos)} tom="ciano" />,
      legenda: variacaoDe(planos) === null ? 'Pedidos pagos no checkout' : 'em relação ao mês anterior',
      grafico: <Linha serie={planos} formatar={inteiro} />,
    },
    {
      label: 'Projetos ativos',
      icon: Folder,
      to: '/admin/projetos',
      query: projects,
      valorTexto: inteiro(projetos.andamento + projetos.revisao),
      valor: null,
      legenda: '',
      grafico: <Donut dados={projetos} />,
    },
  ]

  return (
    <div className="vx-metrics">
      {cards.map((c, i) => (
        <Link
          key={c.label}
          to={c.to}
          style={{ '--i': i } as CSSProperties}
          className="vx-metric vx-glass"
          aria-label={`${c.label}: ${c.query.isLoading ? 'Carregando' : c.query.isError ? 'Indisponível' : c.valorTexto}`}
        >
          <div className="vx-metric-heading">
            <span>{c.label}</span>
            <span className="vx-metric-icon">
              <c.icon size={20} />
            </span>
          </div>
          {c.query.isLoading ? (
            <div className="vx-loading" aria-label="Carregando indicador" />
          ) : c.query.isError ? (
            <p role="alert" className="vx-metric-error">
              Dados indisponíveis
            </p>
          ) : (
            <>
              {c.variacao}
              {c.valor !== null && (
                <strong title={c.valorTexto}>
                  <span className={c.valorCompacto ? 'vx-value-full' : undefined}>{c.valor}</span>
                  {c.valorCompacto && <span className="vx-value-compact">{c.valorCompacto}</span>}
                </strong>
              )}
              {c.legenda && <small>{c.legenda}</small>}
              {c.grafico}
            </>
          )}
        </Link>
      ))}
    </div>
  )
}
