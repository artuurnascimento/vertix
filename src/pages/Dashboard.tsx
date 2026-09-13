import { useState } from 'react'
import AcoesPendentes from '../components/dashboard/AcoesPendentes'
import TodayAgenda from '../components/dashboard/TodayAgenda'
import DonutTipos from '../components/dashboard/DonutTipos'
import CargaPorPessoa from '../components/dashboard/CargaPorPessoa'
import ProjectsWorkspace from '../components/dashboard/ProjectsWorkspace'
import PrioritiesWorkspace from '../components/dashboard/PrioritiesWorkspace'
import GreetingHeader from '../components/dashboard/GreetingHeader'
import ResumoFinanceiro from '../components/dashboard/ResumoFinanceiro'
import ClientHealthCard from '../components/clients/ClientHealthCard'
import FilaHoje from '../components/comercial/FilaHoje'
import ExecutiveMetrics from '../components/dashboard/ExecutiveMetrics'
import OpportunitiesPanel from '../components/dashboard/OpportunitiesPanel'
import { useDashboardProjects } from '../components/dashboard/useDashboardData'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Users,
  ClipboardList,
  FolderKanban,
  Check,
} from 'lucide-react'

function Journey() {
  const { data, isLoading, isError } = useDashboardProjects()
  const steps = [
    { label: 'Leads', icon: Users, statuses: ['lead'] },
    {
      label: 'Briefing',
      icon: ClipboardList,
      statuses: ['briefing_enviado', 'briefing_recebido'],
    },
    {
      label: 'Em produção',
      icon: FolderKanban,
      statuses: ['em_desenvolvimento', 'revisao'],
    },
    { label: 'Entregues', icon: Check, statuses: ['entregue'] },
  ]
  return (
    <section
      className="vx-journey vx-glass"
      aria-label="Projetos por etapa atual"
    >
      <div className="vx-journey-title">
        Jornada de projetos <small>Distribuição atual</small>
      </div>
      <div>
        {steps.map(({ label, icon: Icon, statuses }, i) => (
          <Link to="/admin/projetos" key={label}>
            <Icon />
            <span>
              <small>{label}</small>
              <strong>
                {isLoading
                  ? '…'
                  : isError
                    ? '—'
                    : (data?.filter((p) => statuses.includes(p.status))
                        .length ?? 0)}
              </strong>
            </span>
            {i < 3 && <ArrowRight className="vx-journey-arrow" />}
          </Link>
        ))}
      </div>
      {isError && <p role="alert">Não foi possível carregar as etapas.</p>}
    </section>
  )
}

export default function Dashboard() {
  // Prioridades é a aba que executa (fase 3 da jornada): abre nela.
  const [tab, setTab] = useState('Prioridades')
  return (
    <div className="vx-dashboard">
      <GreetingHeader />
      <ExecutiveMetrics />
      <Journey />
      <FilaHoje />
      <div className="vx-workspace">
        <div className="vx-workspace-main">
          <svg
            className="vx-workspace-outline"
            aria-hidden="true"
            viewBox="0 0 1000 420"
            preserveAspectRatio="none"
          >
            <path d="M24 1 H389 C412 1 404 49 454 49 H749 C792 49 788 1 815 1 H976 Q999 1 999 25 V395 Q999 419 976 419 H24 Q1 419 1 395 V25 Q1 1 24 1Z" />
          </svg>
          <div
            className="vx-workspace-tabs"
            role="group"
            aria-label="Conteúdo do painel"
          >
            {['Prioridades', 'Oportunidades', 'Projetos'].map((t) => (
              <button
                type="button"
                key={t}
                aria-pressed={tab === t}
                className={tab === t ? 'is-active' : ''}
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            ))}
          </div>
          {tab === 'Oportunidades' ? (
            <OpportunitiesPanel />
          ) : tab === 'Prioridades' ? (
            <PrioritiesWorkspace />
          ) : (
            <ProjectsWorkspace />
          )}
        </div>
        <TodayAgenda />
      </div>
      <div className="vx-secondary-grid">
        {tab !== 'Prioridades' && <AcoesPendentes />}
        <ClientHealthCard onlyAtRisk />
      </div>
      {/* Os nudges moram no ranking de Prioridades (um cartão por cliente, sem repetir). */}
      <div className="vx-secondary-grid">
        <CargaPorPessoa />
        <DonutTipos />
      </div>
      <ResumoFinanceiro />
    </div>
  )
}
