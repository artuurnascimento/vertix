import { useId, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Check, ChevronDown } from 'lucide-react'
import { useAtualizarComercial } from '../comercial/comercialData'
import { formatarReais, hojeLocal, somarDias } from '../comercial/fila'
import { CardErrorState, CardSkeleton } from './CardStates'
import { usePrioridades, useResolverNudge } from './prioridadesData'
import type { CartaoDePrioridade, MotivoDePrioridade } from './prioridades'

const ADIAR_DIAS = [1, 3, 7] as const
const LARGURA_TOTAL = { gridColumn: '1 / -1' } as const

const COR_DO_MOTIVO: Record<MotivoDePrioridade['tipo'], string> = {
  recebivel_vencido: 'bg-rose-400',
  proposta_sem_resposta: 'bg-amber-400',
  briefing_pendente: 'bg-sky-400',
  acao_vencida: 'bg-rose-400',
  sinal_scan: 'bg-accent',
  nudge: 'bg-white/40',
}

/**
 * Aba "Prioridades" do dashboard: um cartão por cliente, ordenado por
 * urgência × valor × intenção, com o porquê em uma linha e as ações dentro —
 * resolver o nudge, agendar o retorno (+1/+3/+7 dias grava proxima_acao_em
 * no projeto) e abrir o registro. Ver prioridades.ts para a régua.
 */
export default function PrioritiesWorkspace() {
  const headingId = useId()
  const { cartoes, isLoading, isError } = usePrioridades()
  const resolver = useResolverNudge()
  const atualizar = useAtualizarComercial()
  const [aberto, setAberto] = useState<string | null>(null)

  const agendar = (cartao: CartaoDePrioridade, dias: number) => {
    if (!cartao.projectId) return
    atualizar.mutate({
      projectId: cartao.projectId,
      campos: { proxima_acao_em: somarDias(hojeLocal(), dias) },
    })
  }

  return (
    // `.vx-opportunities` é uma grade lista/detalhe (39/61); aqui a lista é
    // única e ocupa as duas colunas — o estilo inline vence a regra da grade.
    <section className="vx-opportunities vx-glass" aria-labelledby={headingId}>
      <div className="vx-panel-heading" style={LARGURA_TOTAL}>
        <h2 id={headingId}>
          Prioridades
          {cartoes.length > 0 && <span>{cartoes.length}</span>}
        </h2>
      </div>

      {isLoading && (
        <div className="vx-workspace-state" style={LARGURA_TOTAL}>
          <CardSkeleton rows={3} rowClassName="h-20" />
        </div>
      )}
      {isError && (
        <div className="vx-workspace-state" style={LARGURA_TOTAL}>
          <CardErrorState />
        </div>
      )}
      {!isLoading && !isError && cartoes.length === 0 && (
        <div className="vx-empty vx-workspace-state" style={LARGURA_TOTAL}>
          <Check aria-hidden className="h-5 w-5 text-emerald-400" />
          <h3>Tudo em dia</h3>
          <p>Nenhum cliente esperando ação.</p>
        </div>
      )}

      {cartoes.length > 0 && (
        <ol className="flex flex-col gap-2 px-1 pb-2" style={LARGURA_TOTAL} aria-label="Clientes por prioridade">
          {cartoes.map((cartao, i) => {
            const expandido = aberto === cartao.chave
            const principal = cartao.motivos[0]
            const unico = cartao.motivos.length === 1
            return (
              <li
                key={cartao.chave}
                data-testid="cartao-prioridade"
                className={`rounded-xl border px-3 py-2.5 ${
                  principal.urgencia > 0 ? 'border-rose-400/30 bg-rose-500/5' : 'border-white/5 bg-white/[0.02]'
                }`}
              >
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <span className="w-5 shrink-0 text-center text-xs font-semibold tabular-nums text-muted">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">
                      {cartao.nome}
                      {cartao.valor > 0 && (
                        <span className="ml-2 text-xs font-semibold tabular-nums text-accent">{formatarReais(cartao.valor)}</span>
                      )}
                    </p>
                    <p className="truncate text-xs font-light text-muted">{cartao.porque}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {!unico && (
                      <button
                        type="button"
                        onClick={() => setAberto(expandido ? null : cartao.chave)}
                        aria-expanded={expandido}
                        aria-label={`${expandido ? 'Esconder' : 'Ver'} os ${cartao.motivos.length} motivos de ${cartao.nome}`}
                        className="rounded-lg border border-white/10 px-2 py-1 text-xs text-muted hover:bg-white/5 hover:text-ink"
                      >
                        <ChevronDown aria-hidden className={`h-3.5 w-3.5 transition-transform ${expandido ? 'rotate-180' : ''}`} />
                      </button>
                    )}
                    {unico && principal.nudgeId && (
                      <button
                        type="button"
                        onClick={() => resolver.mutate(principal.nudgeId as string)}
                        disabled={resolver.isPending}
                        className="rounded-lg border border-emerald-400/30 px-2.5 py-1 text-xs font-medium text-emerald-300 hover:bg-emerald-400/10 disabled:opacity-50"
                      >
                        Resolver
                      </button>
                    )}
                    {cartao.projectId &&
                      ADIAR_DIAS.map((dias) => (
                        <button
                          key={dias}
                          type="button"
                          onClick={() => agendar(cartao, dias)}
                          disabled={atualizar.isPending}
                          aria-label={`Agendar retorno em ${dias} dia${dias > 1 ? 's' : ''} para ${cartao.nome}`}
                          className="rounded-lg border border-white/10 px-2 py-1 text-xs text-muted hover:bg-white/5 hover:text-ink disabled:opacity-50"
                        >
                          +{dias}d
                        </button>
                      ))}
                    <Link
                      to={cartao.link}
                      aria-label={`Abrir ${cartao.nome}`}
                      className="rounded-lg p-1.5 text-muted hover:bg-white/5 hover:text-ink"
                    >
                      <ArrowRight aria-hidden className="h-4 w-4" />
                    </Link>
                  </div>
                </div>

                {expandido && !unico && (
                  <ul className="mt-2 flex flex-col gap-1.5 border-t border-white/5 pt-2">
                    {cartao.motivos.map((m) => (
                      <li key={m.chave} className="flex items-center gap-2 text-xs">
                        <span aria-hidden className={`h-1.5 w-1.5 shrink-0 rounded-full ${COR_DO_MOTIVO[m.tipo]}`} />
                        <Link to={m.link} className="min-w-0 flex-1 truncate text-ink/85 hover:text-ink hover:underline">
                          {m.texto}
                        </Link>
                        {m.nudgeId && (
                          <button
                            type="button"
                            onClick={() => resolver.mutate(m.nudgeId as string)}
                            disabled={resolver.isPending}
                            className="shrink-0 rounded-lg border border-emerald-400/30 px-2 py-0.5 text-[11px] font-medium text-emerald-300 hover:bg-emerald-400/10 disabled:opacity-50"
                          >
                            Resolver
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
