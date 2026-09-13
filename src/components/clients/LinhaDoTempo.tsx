import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, Clock } from 'lucide-react'
import { useLinhaDoTempo } from './timelineData'
import { GRUPOS, agruparPorMes, filtrarPorGrupo, formatarQuando, metaDoEvento } from './timeline'
import type { GrupoDeEvento, TomDoEvento } from './timeline'

interface Props {
  clientId: string
}

const COR_DO_TOM: Record<TomDoEvento, string> = {
  neutro: 'bg-white/20',
  positivo: 'bg-emerald-400',
  alerta: 'bg-amber-400',
  negativo: 'bg-red-400',
}

/**
 * Aba "Linha do tempo" da tela do cliente: tudo o que aconteceu com a pessoa
 * — do Scan ao pagamento — em ordem, agrupado por mês, com filtro por grupo.
 * É a resposta para "qual é a história desse cliente?" sem abrir cinco telas.
 */
export default function LinhaDoTempo({ clientId }: Props) {
  const [grupo, setGrupo] = useState<GrupoDeEvento | 'tudo'>('tudo')
  const { data, isLoading, isError } = useLinhaDoTempo(clientId)

  const eventos = data ?? []
  const meses = agruparPorMes(filtrarPorGrupo(eventos, grupo))

  return (
    <div data-testid="linha-do-tempo">
      <div role="tablist" aria-label="Filtrar linha do tempo" className="flex flex-wrap gap-1.5">
        {GRUPOS.map((g) => {
          const ativo = g.valor === grupo
          const total = g.valor === 'tudo' ? eventos.length : filtrarPorGrupo(eventos, g.valor).length
          return (
            <button
              key={g.valor}
              type="button"
              role="tab"
              aria-selected={ativo}
              onClick={() => setGrupo(g.valor)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors duration-150 ${
                ativo
                  ? 'border-accent/50 bg-accent/15 text-accent'
                  : 'border-white/10 text-muted hover:bg-white/5 hover:text-ink'
              }`}
            >
              {g.rotulo}
              {total > 0 && <span className="ml-1.5 text-[11px] opacity-70">{total}</span>}
            </button>
          )
        })}
      </div>

      {isLoading && (
        <div className="mt-4 space-y-3">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-xl bg-surface-1" style={{ opacity: 1 - i * 0.2 }} />
          ))}
        </div>
      )}

      {isError && (
        <p role="alert" className="mt-4 rounded-xl border border-white/5 bg-surface-1 px-6 py-8 text-center text-sm text-red-400">
          Não foi possível carregar a linha do tempo. Recarregue a página.
        </p>
      )}

      {!isLoading && !isError && meses.length === 0 && (
        <div className="mt-4 flex flex-col items-center rounded-2xl border border-white/5 bg-surface-1 px-6 py-12 text-center">
          <Clock className="h-6 w-6 text-muted" />
          <p className="mt-3 max-w-xs text-sm font-light leading-relaxed text-muted">
            {eventos.length === 0
              ? 'Nada registrado ainda. Análises, propostas, pagamentos e chamados aparecem aqui conforme acontecem.'
              : 'Nada neste grupo.'}
          </p>
        </div>
      )}

      {meses.length > 0 && (
        <ol className="mt-4 flex flex-col gap-6">
          {meses.map((mes) => (
            <li key={mes.chave}>
              <h3 className="text-[11px] font-medium uppercase tracking-widest text-muted">{mes.rotulo}</h3>
              <ol className="mt-2 divide-y divide-white/5 overflow-hidden rounded-2xl border border-white/5 bg-surface-1">
                {mes.eventos.map((evento) => {
                  const meta = metaDoEvento(evento.tipo)
                  const quando = formatarQuando(evento.quando)
                  return (
                    <li
                      key={evento.id}
                      data-tipo={evento.tipo}
                      className="flex items-start gap-3 px-4 py-3 sm:px-5"
                    >
                      <span className="flex w-14 shrink-0 flex-col pt-0.5 text-right">
                        <span className="text-xs font-medium text-ink/80">{quando.dia}</span>
                        {quando.hora && <span className="text-[11px] text-muted">{quando.hora}</span>}
                      </span>
                      <span
                        aria-hidden="true"
                        className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${COR_DO_TOM[meta.tom]}`}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-ink">{evento.titulo}</p>
                        {evento.detalhe && (
                          <p className="mt-0.5 truncate text-xs font-light text-muted">{evento.detalhe}</p>
                        )}
                      </div>
                      {evento.link && (
                        <Link
                          to={evento.link}
                          aria-label={`Abrir: ${evento.titulo}`}
                          className="shrink-0 rounded-lg p-1.5 text-muted transition-colors duration-150 hover:bg-white/5 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                        >
                          <ArrowUpRight className="h-4 w-4" />
                        </Link>
                      )}
                    </li>
                  )
                })}
              </ol>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
