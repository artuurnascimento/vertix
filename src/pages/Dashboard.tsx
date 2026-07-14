import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import AcoesPendentes from '../components/dashboard/AcoesPendentes'
import ActivityTicker from '../components/dashboard/ActivityTicker'
import AgendaCard from '../components/dashboard/AgendaCard'
import CompactKpiList from '../components/dashboard/CompactKpiList'
import DonutTipos from '../components/dashboard/DonutTipos'
import EtapasBars from '../components/dashboard/EtapasBars'
import GreetingHeader from '../components/dashboard/GreetingHeader'
import ResumoFinanceiro from '../components/dashboard/ResumoFinanceiro'
import RevenueHero from '../components/dashboard/RevenueHero'

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
 * bento assimétrico de 12 colunas (herói de receita, KPIs compactos, agenda
 * em timeline vertical, ações pendentes, linha inferior de análises rasas).
 * Em <1024px colapsa em coluna única, ordem: herói → KPIs → ações → agenda → resto.
 */
export default function Dashboard() {
  return (
    <div>
      <GreetingHeader />

      <div className="mt-6">
        <ActivityTicker />
      </div>

      {/* Bento assimétrico — 12 colunas, posições explícitas (linha/coluna) para
          evitar colisão do auto-flow com o row-span-2 da Agenda. */}
      <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-12 lg:grid-rows-[auto_auto_auto] lg:gap-5">
        {/* Card herói — receita do mês + gráfico integrado */}
        <BentoBlock
          index={0}
          className="order-1 lg:order-none lg:col-start-1 lg:col-span-7 lg:row-start-1 xl:col-span-8"
        >
          <RevenueHero />
        </BentoBlock>

        {/* Coluna de KPIs compactos */}
        <BentoBlock
          index={1}
          className="order-2 lg:order-none lg:col-start-8 lg:col-span-5 lg:row-start-1 xl:col-start-9 xl:col-span-4"
        >
          <CompactKpiList />
        </BentoBlock>

        {/* Ações pendentes — vem antes da agenda na ordem de prioridade mobile */}
        <BentoBlock
          index={2}
          className="order-3 lg:order-none lg:col-start-1 lg:col-span-7 lg:row-start-2 xl:col-span-8"
        >
          <AcoesPendentes />
        </BentoBlock>

        {/* Agenda — timeline vertical, card alto, ocupa 2 linhas na coluna direita */}
        <BentoBlock
          index={3}
          className="order-4 lg:order-none lg:col-start-8 lg:col-span-5 lg:row-start-2 lg:row-span-2 xl:col-start-9 xl:col-span-4"
        >
          <AgendaCard />
        </BentoBlock>

        {/* Linha inferior — largura total (col 1-7/8), proporções internas diferentes (5/3/4) */}
        <div className="order-5 grid grid-cols-1 gap-4 sm:grid-cols-12 lg:col-start-1 lg:col-span-7 lg:row-start-3 lg:gap-5 xl:col-span-8">
          <BentoBlock index={4} className="sm:col-span-5">
            <EtapasBars />
          </BentoBlock>
          <BentoBlock index={5} className="sm:col-span-3">
            <DonutTipos />
          </BentoBlock>
          <BentoBlock index={6} className="sm:col-span-4">
            <ResumoFinanceiro />
          </BentoBlock>
        </div>
      </div>
    </div>
  )
}
