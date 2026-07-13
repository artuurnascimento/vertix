import { useMemo } from 'react'
import { Clock } from 'lucide-react'
import { PROJECT_STATUS, PROJECT_STATUS_ORDER } from '../../lib/format'
import DashboardCard from '../dashboard/DashboardCard'
import { CardErrorState, CardSkeleton } from '../dashboard/CardStates'
import { useReportStatusHistory } from './useReportsData'
import type { ReportStatusHistory } from './useReportsData'

const MS_IN_DAY = 1000 * 60 * 60 * 24

interface EtapaTempo {
  status: string
  label: string
  /** Média em dias — null quando não há amostra (nenhum projeto avançou desta etapa). */
  mediaDias: number | null
}

/**
 * Para cada etapa concluída (há um registro posterior no mesmo projeto),
 * calcula (entrou_em da próxima etapa − entrou_em da etapa atual) em dias,
 * depois tira a média por etapa.
 */
function computeMediaPorEtapa(
  history: readonly ReportStatusHistory[]
): EtapaTempo[] {
  const porProjeto = new Map<string, ReportStatusHistory[]>()
  for (const row of history) {
    const lista = porProjeto.get(row.project_id) ?? []
    lista.push(row)
    porProjeto.set(row.project_id, lista)
  }

  const somaPorStatus = new Map<string, number>()
  const contagemPorStatus = new Map<string, number>()

  for (const registros of porProjeto.values()) {
    const ordenados = [...registros].sort((a, b) =>
      a.entrou_em.localeCompare(b.entrou_em)
    )
    for (let i = 0; i < ordenados.length - 1; i++) {
      const atual = ordenados[i]
      const proxima = ordenados[i + 1]
      const dias =
        (new Date(proxima.entrou_em).getTime() -
          new Date(atual.entrou_em).getTime()) /
        MS_IN_DAY
      if (dias < 0) continue
      somaPorStatus.set(atual.status, (somaPorStatus.get(atual.status) ?? 0) + dias)
      contagemPorStatus.set(
        atual.status,
        (contagemPorStatus.get(atual.status) ?? 0) + 1
      )
    }
  }

  return PROJECT_STATUS_ORDER.map((status) => {
    const contagem = contagemPorStatus.get(status) ?? 0
    const soma = somaPorStatus.get(status) ?? 0
    return {
      status,
      label: PROJECT_STATUS[status].label,
      mediaDias: contagem > 0 ? soma / contagem : null,
    }
  })
}

/** Tempo médio (em dias) que os projetos passam em cada etapa do kanban. */
export default function TempoMedioEtapas() {
  const { data: history, isLoading, isError } = useReportStatusHistory()

  const etapas = useMemo(
    () => computeMediaPorEtapa(history ?? []),
    [history]
  )

  return (
    <DashboardCard
      title="Tempo médio por etapa"
      subtitle="Dias entre a entrada na etapa e o avanço para a próxima"
    >
      {isLoading && <CardSkeleton rows={6} rowClassName="h-7" />}

      {isError && <CardErrorState />}

      {!isLoading && !isError && (
        <ul className="flex flex-col gap-3">
          {etapas.map((etapa) => (
            <li
              key={etapa.status}
              className="flex items-center justify-between gap-3 border-b border-white/5 pb-3 last:border-b-0 last:pb-0"
            >
              <span className="flex items-center gap-2 text-sm text-ink/90">
                <Clock aria-hidden className="h-3.5 w-3.5 text-muted/60" />
                {etapa.label}
              </span>
              <span className="font-kanit text-sm font-semibold text-ink">
                {etapa.mediaDias !== null
                  ? `${etapa.mediaDias.toFixed(1)} dias`
                  : '—'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </DashboardCard>
  )
}
