import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { formatarPercentual, resumirBio } from './bioResumo'
import type { EventoBio } from './bioResumo'

/** Resumo dos últimos 30 dias: qual atalho está trazendo gente. */

const DIAS = 30

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
    queryKey: ['bio-eventos', DIAS],
    queryFn: async (): Promise<EventoBio[]> => {
      const { data, error } = await supabase
        .from('bio_events')
        .select('tipo, link_id, created_at')
        .gte('created_at', desdeISO(DIAS))
      if (error) throw new Error(error.message)
      return data
    },
  })

  if (isLoading) {
    return <div className="h-28 animate-pulse rounded-xl bg-surface-1" />
  }

  const resumo = resumirBio(eventos ?? [], botoes)

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
    </section>
  )
}
