import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlarmClockOff, ArrowRight, Check, ChevronLeft, ChevronRight, Clock3, Sparkles } from 'lucide-react'
import DashboardCard from '../dashboard/DashboardCard'
import { CardEmptyState, CardErrorState, CardSkeleton } from '../dashboard/CardStates'
import { useAtualizarComercial, useFilaComercial } from './comercialData'
import { formatarReais, hojeLocal, ordenarFila, paginar, somarDias, type ItemOrdenado, type Secao } from './fila'

const TITULO_DA_SECAO: Record<Secao, string> = {
  vencidas: 'Venceu',
  hoje: 'Para hoje',
  sinais: 'Sinais do Scan',
  sem_passo: 'Sem próximo passo',
}
const ADIAR_DIAS = [1, 3, 7] as const

/**
 * O bloco "Hoje": quem eu contato, por quê, até quando. Ações vencidas e de
 * hoje no topo, depois quem deu sinal no Scan e as oportunidades paradas
 * sem próximo passo. Cada linha tem feito / adiar / abrir — sem sair do
 * painel. Marcar "feito" pede a próxima ação: a fila nunca fica vazia por
 * esquecimento.
 */
export default function FilaHoje() {
  const fila = useFilaComercial()
  const atualizar = useAtualizarComercial()
  const hoje = hojeLocal()
  const itens = useMemo(() => ordenarFila(fila.data ?? [], hoje), [fila.data, hoje])
  // A fila é longa (toda oportunidade parada entra); mostra 6 por vez. A
  // página pedida é ajustada ao total, então "feito" na última página não
  // deixa a tela vazia.
  const [paginaPedida, setPaginaPedida] = useState(1)
  const pagina = useMemo(() => paginar(itens, paginaPedida), [itens, paginaPedida])
  const [proximaDe, setProximaDe] = useState<string | null>(null)
  const [textoProxima, setTextoProxima] = useState('')
  const [dataProxima, setDataProxima] = useState(somarDias(hoje, 1))

  const concluir = (item: ItemOrdenado) => {
    setProximaDe(item.project_id)
    setTextoProxima('')
    setDataProxima(somarDias(hoje, 1))
  }
  const gravarProxima = (projectId: string) => {
    atualizar.mutate({
      projectId,
      campos: { proxima_acao: textoProxima.trim() || null, proxima_acao_em: textoProxima.trim() ? dataProxima : null },
    })
    setProximaDe(null)
  }
  const adiar = (item: ItemOrdenado, dias: number) =>
    atualizar.mutate({ projectId: item.project_id, campos: { proxima_acao_em: somarDias(hoje, dias) } })

  let secaoAnterior: Secao | null = null

  return (
    <DashboardCard title="Hoje" subtitle="Quem contatar, por quê e até quando" className="mb-7">
      {fila.isLoading && <CardSkeleton rows={4} rowClassName="h-10" />}
      {fila.isError && <CardErrorState />}
      {!fila.isLoading && !fila.isError && itens.length === 0 && (
        <CardEmptyState
          icon={Check}
          title="Nada pendente para hoje"
          description="Toda oportunidade aberta tem um próximo passo combinado para depois de hoje."
        />
      )}
      {itens.length > 0 && (
        <ol className="flex flex-col gap-1">
          {pagina.itens.map((item) => {
            const novaSecao = item.secao !== secaoAnterior
            secaoAnterior = item.secao
            const Icone = item.secao === 'sinais' ? Sparkles : item.secao === 'sem_passo' ? AlarmClockOff : Clock3
            return (
              <li key={item.project_id} className="flex flex-col">
                {novaSecao && (
                  <p className="mb-1 mt-3 text-[11px] font-semibold uppercase tracking-widest text-muted first:mt-0">
                    {TITULO_DA_SECAO[item.secao]}
                  </p>
                )}
                <div
                  className={`flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border px-3 py-2.5 ${
                    item.secao === 'vencidas' ? 'border-rose-400/30 bg-rose-500/5' : 'border-white/5 bg-white/[0.02]'
                  }`}
                >
                  <Icone aria-hidden className={`h-4 w-4 shrink-0 ${item.secao === 'vencidas' ? 'text-rose-300' : 'text-accent'}`} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">
                      {item.cliente}
                      {item.empresa && <span className="font-light text-muted"> · {item.empresa}</span>}
                      {item.valor_estimado != null && item.valor_estimado > 0 && (
                        <span className="ml-2 text-xs font-semibold tabular-nums text-accent">{formatarReais(item.valor_estimado)}</span>
                      )}
                    </p>
                    <p className="truncate text-xs font-light text-muted">
                      {item.motivo}
                      {item.responsavel && ` · ${item.responsavel}`}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {item.secao !== 'sem_passo' && item.secao !== 'sinais' && (
                      <>
                        <button
                          type="button"
                          onClick={() => concluir(item)}
                          className="rounded-lg border border-emerald-400/30 px-2.5 py-1 text-xs font-medium text-emerald-300 hover:bg-emerald-400/10"
                        >
                          Feito
                        </button>
                        {ADIAR_DIAS.map((dias) => (
                          <button
                            key={dias}
                            type="button"
                            onClick={() => adiar(item, dias)}
                            aria-label={`Adiar ${dias} dia${dias > 1 ? 's' : ''}`}
                            className="rounded-lg border border-white/10 px-2 py-1 text-xs text-muted hover:bg-white/5 hover:text-ink"
                          >
                            +{dias}d
                          </button>
                        ))}
                      </>
                    )}
                    {(item.secao === 'sem_passo' || item.secao === 'sinais') && (
                      <button
                        type="button"
                        onClick={() => concluir(item)}
                        className="rounded-lg border border-accent/30 px-2.5 py-1 text-xs font-medium text-accent hover:bg-accent/10"
                      >
                        Combinar próximo passo
                      </button>
                    )}
                    <Link
                      to={`/admin/projetos/${item.project_id}`}
                      aria-label={`Abrir ${item.projeto}`}
                      className="rounded-lg p-1.5 text-muted hover:bg-white/5 hover:text-ink"
                    >
                      <ArrowRight aria-hidden className="h-4 w-4" />
                    </Link>
                  </div>
                  {proximaDe === item.project_id && (
                    <form
                      className="flex w-full flex-wrap items-center gap-2 border-t border-white/5 pt-2"
                      onSubmit={(e) => {
                        e.preventDefault()
                        gravarProxima(item.project_id)
                      }}
                    >
                      <input
                        autoFocus
                        value={textoProxima}
                        onChange={(e) => setTextoProxima(e.target.value)}
                        placeholder="Próxima ação (vazio = sem próximo passo)"
                        aria-label="Próxima ação"
                        className="min-w-0 flex-1 rounded-lg border border-white/10 bg-surface-2 px-3 py-1.5 text-sm text-ink placeholder:text-muted/50"
                      />
                      <input
                        type="date"
                        value={dataProxima}
                        onChange={(e) => setDataProxima(e.target.value)}
                        aria-label="Até quando"
                        className="rounded-lg border border-white/10 bg-surface-2 px-2 py-1.5 text-sm text-ink"
                      />
                      <button type="submit" className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white">
                        Salvar
                      </button>
                      <button type="button" onClick={() => setProximaDe(null)} className="text-xs text-muted hover:text-ink">
                        Cancelar
                      </button>
                    </form>
                  )}
                </div>
              </li>
            )
          })}
        </ol>
      )}
      {pagina.totalPaginas > 1 && (
        <nav aria-label="Páginas da fila" className="mt-3 flex items-center justify-between gap-3 border-t border-white/5 pt-3">
          <p className="text-xs tabular-nums text-muted">
            {pagina.inicio}–{pagina.fim} de {pagina.total}
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPaginaPedida(pagina.pagina - 1)}
              disabled={pagina.pagina === 1}
              aria-label="Página anterior"
              className="rounded-lg p-1.5 text-muted hover:bg-white/5 hover:text-ink disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <ChevronLeft aria-hidden className="h-4 w-4" />
            </button>
            {Array.from({ length: pagina.totalPaginas }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setPaginaPedida(n)}
                aria-label={`Página ${n}`}
                aria-current={n === pagina.pagina ? 'page' : undefined}
                className={`min-w-7 rounded-lg px-2 py-1 text-xs tabular-nums ${
                  n === pagina.pagina ? 'bg-accent font-semibold text-white' : 'text-muted hover:bg-white/5 hover:text-ink'
                }`}
              >
                {n}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setPaginaPedida(pagina.pagina + 1)}
              disabled={pagina.pagina === pagina.totalPaginas}
              aria-label="Próxima página"
              className="rounded-lg p-1.5 text-muted hover:bg-white/5 hover:text-ink disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <ChevronRight aria-hidden className="h-4 w-4" />
            </button>
          </div>
        </nav>
      )}
    </DashboardCard>
  )
}
