import KpiRow from '../components/dashboard/KpiRow'
import PipelineFunnel from '../components/dashboard/PipelineFunnel'
import RecentActivity from '../components/dashboard/RecentActivity'
import RevenueChart from '../components/dashboard/RevenueChart'
import UpcomingDues from '../components/dashboard/UpcomingDues'

const fullDateFormatter = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'full',
})

/** "sábado, 12 de julho de 2026" → "Sábado, 12 de julho de 2026". */
function formatTodayLong(): string {
  const formatted = fullDateFormatter.format(new Date())
  return formatted.charAt(0).toUpperCase() + formatted.slice(1)
}

/** Home executiva do painel — rota index de /admin. */
export default function Dashboard() {
  return (
    <div>
      {/* Header da página */}
      <div>
        <h1 className="hero-heading font-kanit text-4xl font-bold leading-tight sm:text-5xl">
          Visão geral
        </h1>
        <p className="mt-2 text-sm font-light text-muted">
          {formatTodayLong()} — o pulso da Vertix em uma tela.
        </p>
      </div>

      {/* Linha de KPIs */}
      <div className="mt-8">
        <KpiRow />
      </div>

      {/* Grid principal: funil 2/3 + atividade 1/3; receita 1/2 + vencimentos 1/2 */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <PipelineFunnel />
        </div>
        <div className="lg:col-span-4">
          <RecentActivity />
        </div>
        <div className="lg:col-span-6">
          <RevenueChart />
        </div>
        <div className="lg:col-span-6">
          <UpcomingDues />
        </div>
      </div>
    </div>
  )
}
