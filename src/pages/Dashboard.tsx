import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import AcoesPendentes from '../components/dashboard/AcoesPendentes'
import ActivityTicker from '../components/dashboard/ActivityTicker'
import AgendaCard from '../components/dashboard/AgendaCard'
import CompactKpiList from '../components/dashboard/CompactKpiList'
import DonutTipos from '../components/dashboard/DonutTipos'
import EtapasBars from '../components/dashboard/EtapasBars'
import GreetingHeader from '../components/dashboard/GreetingHeader'
import NudgesPanel from '../components/dashboard/NudgesPanel'
import ResumoFinanceiro from '../components/dashboard/ResumoFinanceiro'
import RevenueHero from '../components/dashboard/RevenueHero'
import ClientHealthCard from '../components/clients/ClientHealthCard'

const STAGGER_STEP_S = 0.08

/** Wrapper com stagger de entrada — cada bloco do bento nasce ~70-90ms depois do anterior. */
function BentoBlock({
  index,
  className = '',
  children,
}: {
  index: number
  className?: string
  children: ReactNode
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.45,
        delay: index * STAGGER_STEP_S,
        ease: [0.16, 1, 0.3, 1],
      }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

/**
 * Home executiva do painel — rota index de /admin.
 *
 * Composição "Command Deck Editorial": saudação viva + ticker de atividade +
 * grid de 12 colunas em 4 linhas de altura por conteúdo (sem row-span):
 *   1. Herói de receita (8) + KPIs compactos (4), esticados na mesma altura
 *   2. Ações pendentes (7) + Agenda (5)
 *   3. Resumo financeiro — faixa horizontal full-width (12)
 *   4. Etapas do pipeline (7) + Distribuição por tipo (5)
 * Em <1024px colapsa em coluna única, ordem: herói → KPIs → ações → agenda →
 * resumo → etapas → donut.
 */
export default function Dashboard() {
  return (
    <div>
      <GreetingHeader />

      <div className="mt-6">
        <ActivityTicker />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-12 lg:items-stretch">
        {/* Linha 1 — herói de receita + KPIs compactos, mesma altura */}
        <BentoBlock index={0} className="h-full lg:col-span-8">
          <RevenueHero />
        </BentoBlock>
        <BentoBlock index={1} className="h-full lg:col-span-4">
          <CompactKpiList />
        </BentoBlock>

        {/* Linha 2 — ações pendentes + agenda */}
        <BentoBlock index={2} className="h-full lg:col-span-7">
          <AcoesPendentes />
        </BentoBlock>
        <BentoBlock index={3} className="h-full lg:col-span-5">
          <AgendaCard />
        </BentoBlock>

        {/* Linha 3 — resumo financeiro, faixa horizontal full-width */}
        <BentoBlock index={4} className="col-span-12">
          <ResumoFinanceiro />
        </BentoBlock>

        {/* Linha 4 — nudges (o que precisa de empurrão) + saúde da carteira */}
        <BentoBlock index={5} className="h-full lg:col-span-7">
          <NudgesPanel />
        </BentoBlock>
        <BentoBlock index={6} className="h-full lg:col-span-5">
          <ClientHealthCard onlyAtRisk />
        </BentoBlock>

        {/* Linha 5 — etapas do pipeline + distribuição por tipo */}
        <BentoBlock index={7} className="h-full lg:col-span-7">
          <EtapasBars />
        </BentoBlock>
        <BentoBlock index={8} className="h-full lg:col-span-5">
          <DonutTipos />
        </BentoBlock>
      </div>
    </div>
  )
}
