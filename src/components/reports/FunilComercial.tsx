import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { Filter } from 'lucide-react'
import DashboardCard from '../dashboard/DashboardCard'
import { CardEmptyState, CardErrorState, CardSkeleton } from '../dashboard/CardStates'
import { useFunilPessoas, useReportAnalyses, useReportProposals } from './useReportsData'
import { etapasDoFunil, funilDePropostas, type EtapaDoFunil } from './funil'

const BAR_STAGGER_S = 0.06
const MIN_BAR_PERCENT = 4

/**
 * Funil da jornada inteira, por PESSOA: análise → lead → relatório aberto →
 * compra do plano → reunião → implementação → recorrência. E, embaixo, o
 * recorte das propostas por projeto único (enviada → aceita).
 */
export default function FunilComercial() {
  const pessoas = useFunilPessoas()
  const analises = useReportAnalyses()
  const propostas = useReportProposals()

  const isLoading = pessoas.isLoading || analises.isLoading || propostas.isLoading
  const isError = pessoas.isError || analises.isError || propostas.isError

  const etapas = useMemo((): EtapaDoFunil[] => {
    const daJornada = etapasDoFunil(pessoas.data ?? [])
    const totalAnalises = analises.data ?? 0
    const leads = daJornada[0]?.count ?? 0
    return [
      { chave: 'analises', label: 'Análises iniciadas', count: totalAnalises, conversao: null },
      ...daJornada.map((e, i) =>
        i === 0 ? { ...e, conversao: totalAnalises > 0 ? (leads / totalAnalises) * 100 : null } : e
      ),
    ]
  }, [pessoas.data, analises.data])

  const recorte = useMemo(() => funilDePropostas(propostas.data ?? []), [propostas.data])
  const maxCount = Math.max(...etapas.map((e) => e.count), 1)
  const total = etapas[0]?.count ?? 0

  return (
    <DashboardCard title="Funil da jornada" subtitle="Pessoas únicas, da análise à recorrência">
      {isLoading && <CardSkeleton rows={6} rowClassName="h-8" />}

      {isError && <CardErrorState />}

      {!isLoading && !isError && total === 0 && (
        <CardEmptyState
          icon={Filter}
          title="Sem análises ainda"
          description="O funil aparece assim que a primeira loja for analisada no Scan."
        />
      )}

      {!isLoading && !isError && total > 0 && (
        <>
          <ol className="flex flex-col gap-4">
            {etapas.map((etapa, index) => {
              const percent =
                etapa.count === 0 ? 0 : Math.max((etapa.count / maxCount) * 100, MIN_BAR_PERCENT)
              return (
                <li key={etapa.chave}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm text-ink/90">{etapa.label}</span>
                    <span className="flex items-baseline gap-2">
                      {etapa.conversao !== null && (
                        <span className="text-xs font-light tabular-nums text-muted">
                          {etapa.conversao.toFixed(0)}%
                        </span>
                      )}
                      <span className="font-kanit text-sm font-semibold tabular-nums text-ink">
                        {etapa.count}
                      </span>
                    </span>
                  </div>
                  <span className="mt-1.5 block h-2.5 overflow-hidden rounded-full bg-white/5">
                    <motion.span
                      initial={{ width: 0 }}
                      animate={{ width: `${percent}%` }}
                      transition={{ duration: 0.6, ease: 'easeOut', delay: index * BAR_STAGGER_S }}
                      className="block h-full rounded-full bg-gradient-to-r from-accent to-accent-2 opacity-80 shadow-[0_0_8px_rgba(108,91,242,0.45)]"
                    />
                  </span>
                </li>
              )
            })}
          </ol>
          <p className="mt-5 border-t border-white/5 pt-3 text-xs font-light text-muted">
            Propostas, por projeto único: {recorte.enviadas} enviada{recorte.enviadas === 1 ? '' : 's'} em{' '}
            {recorte.projetos} projeto{recorte.projetos === 1 ? '' : 's'} ·{' '}
            {recorte.aceitas} aceita{recorte.aceitas === 1 ? '' : 's'}
            {recorte.enviadas > 0 && ` (${Math.round((recorte.aceitas / recorte.enviadas) * 100)}%)`}
          </p>
        </>
      )}
    </DashboardCard>
  )
}
