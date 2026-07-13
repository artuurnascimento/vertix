import FunilComercial from '../components/reports/FunilComercial'
import ReceitaPorTipo from '../components/reports/ReceitaPorTipo'
import TempoMedioEtapas from '../components/reports/TempoMedioEtapas'
import TopClientes from '../components/reports/TopClientes'
import ResultadoMensal from '../components/reports/ResultadoMensal'

export default function Relatorios() {
  return (
    <div>
      <div>
        <h1 className="hero-heading font-kanit text-4xl font-bold leading-tight sm:text-5xl">
          Relatórios
        </h1>
        <p className="mt-2 text-sm font-light text-muted">
          Funil comercial, receita, tempo de execução e resultado financeiro
          da Vertix.
        </p>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <FunilComercial />
        <ReceitaPorTipo />
        <TempoMedioEtapas />
        <TopClientes />
        <div className="lg:col-span-2">
          <ResultadoMensal />
        </div>
      </div>
    </div>
  )
}
