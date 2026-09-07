import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { formatarPercentual, resumirBio, resumirPorMes } from './bioResumo'
import type { EventoBio } from './bioResumo'

/**
 * Resumo do link de bio: os últimos 30 dias (qual atalho traz gente) e o
 * histórico mês a mês, para ver se a página cresce ou esfria.
 */

const DIAS = 30
/** Janela buscada de uma vez; os 30 dias saem dela por filtro em memória. */
const DIAS_HISTORICO = 365
const MESES_NO_GRAFICO = 6

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
      <p className="font-kanit text-2xl font-bold tabular-nums text-ink">{valor}</p>
      <p className="mt-0.5 text-xs font-light text-muted">{rotulo}</p>
    </div>
  )
}

export default function BioStats({ botoes }: BioStatsProps) {
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

  const todos = eventos ?? []
  const corte30 = desdeISO(DIAS)
  const resumo = resumirBio(
    todos.filter((e) => e.created_at >= corte30),
    botoes
  )
  const meses = resumirPorMes(todos, MESES_NO_GRAFICO)
  const pico = Math.max(1, ...meses.map((m) => m.cliques))

  return (
    <section aria-label="Resumo dos últimos 30 dias">
      <div className="grid grid-cols-3 gap-3">
        <Numero valor={String(resumo.visitas)} rotulo="Visitas em 30 dias" />
        <Numero valor={String(resumo.cliques)} rotulo="Cliques" />
        <Numero
          valor={formatarPercentual(resumo.taxaGeral)}
          rotulo="Cliques por visita"
        />
      </div>

      {resumo.cliques === 0 ? (
        <p className="mt-3 text-xs font-light text-muted">
          Sem cliques ainda no período. Assim que a página receber gente, a
          divisão por botão aparece aqui.
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
              <span className="tabular-nums text-xs text-muted">
                {botao.cliques} {botao.cliques === 1 ? 'clique' : 'cliques'}
              </span>
              <span className="w-14 text-right tabular-nums text-xs font-medium text-accent">
                {formatarPercentual(botao.participacao)}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-6">
        <p className="text-xs font-medium uppercase tracking-widest text-muted">
          Cliques por mês
        </p>
        <ul className="mt-3 flex list-none flex-col gap-1.5 p-0">
          {meses.map((mes) => (
            <li
              key={mes.mes}
              className="flex items-center gap-3 rounded-lg border border-white/5 bg-surface-1 px-4 py-2.5"
            >
              <span className="w-16 shrink-0 text-sm font-light capitalize text-ink">
                {mes.rotulo}
              </span>
              <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-white/5">
                <span
                  className="block h-full rounded-full bg-accent"
                  style={{ width: `${(mes.cliques / pico) * 100}%` }}
                />
              </span>
              <span className="w-20 shrink-0 text-right tabular-nums text-xs text-muted">
                {mes.visitas} {mes.visitas === 1 ? 'visita' : 'visitas'}
              </span>
              <span className="w-16 shrink-0 text-right tabular-nums text-xs font-medium text-accent">
                {mes.cliques} {mes.cliques === 1 ? 'clique' : 'cliques'}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
