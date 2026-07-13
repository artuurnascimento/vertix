import AcoesPendentes from '../components/dashboard/AcoesPendentes'
import AgendaCard from '../components/dashboard/AgendaCard'
import AtividadesCard from '../components/dashboard/AtividadesCard'
import DonutTipos from '../components/dashboard/DonutTipos'
import EtapasBars from '../components/dashboard/EtapasBars'
import KpiRow from '../components/dashboard/KpiRow'
import ResumoFinanceiro from '../components/dashboard/ResumoFinanceiro'
import RevenueChart from '../components/dashboard/RevenueChart'

/** Home executiva do painel — rota index de /admin. */
export default function Dashboard() {
  return (
    <div>
      {/* Header da página */}
      <div>
        <p className="text-xs font-medium uppercase tracking-widest text-muted/70">
          Bem-vindo de volta
        </p>
        <h1 className="hero-heading font-kanit mt-2 text-4xl font-bold leading-tight sm:text-5xl">
          Visão geral
        </h1>
        <p className="mt-2 text-sm font-light text-muted">
          O pulso da Vertix em uma tela — dados em tempo real do seu negócio.
        </p>
      </div>

      {/* Fileira de KPIs */}
      <div className="mt-8">
        <KpiRow />
      </div>

      {/* Gráfico de receita */}
      <div className="mt-6">
        <RevenueChart />
      </div>

      {/* Atividades / Etapas / Ações pendentes */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <AtividadesCard />
        <EtapasBars />
        <AcoesPendentes />
      </div>

      {/* Agenda semanal / Distribuição por tipo */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <AgendaCard />
        </div>
        <DonutTipos />
      </div>

      {/* Resumo financeiro */}
      <div className="mt-6 grid grid-cols-1 gap-6">
        <ResumoFinanceiro />
      </div>
    </div>
  )
}
