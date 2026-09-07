import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { formatarPercentual, resumirBio } from './bioResumo'
import type { EventoBio } from './bioResumo'
import FiltroPeriodo from '../ui/FiltroPeriodo'
import {
  dentroDoPeriodo,
  intervaloDoPeriodo,
  rotuloDoPeriodo,
} from '../../lib/periodo'
import type { Periodo } from '../../lib/periodo'

/**
 * Métricas do link de bio com filtro de período: quantas visitas, quantos
 * cliques e qual atalho está trazendo gente na janela escolhida. Um único
 * carregamento (12 meses) alimenta todos os filtros — a troca é instantânea.
 */

/** Janela buscada de uma vez; cada filtro recorta dela em memória. */
const DIAS_HISTORICO = 365

interface BioStatsProps {
  botoes: Array<{ id: string; rotulo: string }>
}

function desdeISO(dias: number): string {
  const d = new Date()
  d.setDate(d.getDate() - dias)
  return d.toISOString()
}

function Numero({ valor, rotulo }: { valor: string; rotulo: string }) {
  return (
    <div className="rounded-xl border border-white/5 bg-surface-1 px-5 py-4">
      <p className="font-kanit text-2xl font-bold tabular-nums text-ink">
        {valor}
      </p>
      <p className="mt-0.5 text-xs font-light text-muted">{rotulo}</p>
    </div>
  )
}

export default function BioStats({ botoes }: BioStatsProps) {
  // Filtro: um dos períodos corridos ou um mês fechado ("2026-09").
  const [periodo, setPeriodo] = useState<Periodo>('30d')

  const { data: eventos, isLoading } = useQuery({
    queryKey: ['bio-eventos', DIAS_HISTORICO],
    queryFn: async (): Promise<EventoBio[]> => {
      const { data, error } = await supabase
        .from('bio_events')
        .select('tipo, link_id, created_at')
        .gte('created_at', desdeISO(DIAS_HISTORICO))
        .order('created_at', { ascending: false })
        .limit(20000)
      if (error) throw new Error(error.message)
      return data
    },
  })

  if (isLoading) {
    return <div className="h-28 animate-pulse rounded-xl bg-surface-1" />
  }

  const intervalo = intervaloDoPeriodo(periodo)
  const doPeriodo = (eventos ?? []).filter((e) =>
    dentroDoPeriodo(e.created_at, intervalo)
  )
  const resumo = resumirBio(doPeriodo, botoes)
  const rotuloPeriodo = rotuloDoPeriodo(periodo)

  return (
    <section aria-label="Métricas do link de bio">
      <FiltroPeriodo valor={periodo} onChange={setPeriodo} />

      <div className="mt-4 grid grid-cols-3 gap-3">
        <Numero
          valor={String(resumo.visitas)}
          rotulo={`Visitas · ${rotuloPeriodo}`}
        />
        <Numero valor={String(resumo.cliques)} rotulo="Cliques" />
        <Numero
          valor={formatarPercentual(resumo.taxaGeral)}
          rotulo="Cliques por visita"
        />
      </div>

      {resumo.cliques === 0 ? (
        <p className="mt-3 text-xs font-light text-muted">
          Sem cliques em {rotuloPeriodo}. Escolha outro período ou divulgue a
          página para os números aparecerem aqui.
        </p>
      ) : (
        <ul className="mt-3 flex list-none flex-col gap-1.5 p-0">
          {resumo.botoes.map((botao) => (
            <li
              key={botao.id}
              className="flex items-center gap-3 rounded-lg border border-white/5 bg-surface-1 px-4 py-2.5"
            >
              <span className="min-w-0 flex-1 truncate text-sm font-light text-ink">
                {botao.rotulo}
              </span>
              <span className="h-1.5 w-24 shrink-0 overflow-hidden rounded-full bg-white/5 sm:w-40">
                <span
                  className="block h-full rounded-full bg-accent"
                  style={{
                    width: `${
                      resumo.cliques > 0
                        ? (botao.cliques / resumo.cliques) * 100
                        : 0
                    }%`,
                  }}
                />
              </span>
              <span className="w-20 shrink-0 text-right tabular-nums text-xs text-muted">
                {botao.cliques} {botao.cliques === 1 ? 'clique' : 'cliques'}
              </span>
              <span className="w-14 shrink-0 text-right tabular-nums text-xs font-medium text-accent">
                {formatarPercentual(botao.participacao)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
