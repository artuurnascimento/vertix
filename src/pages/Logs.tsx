import { useCallback, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Radio, Search } from 'lucide-react'
import LogDetalhe from '../components/logsPainel/LogDetalhe'
import {
  CLASSE_NIVEL, NIVEIS, ORIGENS, PERIODOS, ROTULO_NIVEL, ROTULO_ORIGEM, ROTULO_PERIODO,
  agruparPorEvento, filtrar, filtrosParaBusca, fontesDe, haQuanto, lerFiltros, relacionadas, resumo,
  type Filtros, type Nivel, type Origem, type Periodo,
} from '../components/logsPainel/logs'
import { useLogs, useLogsAoVivo, useResumo24h } from '../components/logsPainel/logsData'

/**
 * Logs: tudo o que deu errado — no navegador de quem compra, nas edge
 * functions, nas funções da Vercel, no worker do Scan e no banco — numa
 * trilha só, ao vivo. Antes, cada pedaço tinha o próprio lugar (console de
 * quem estava na frente, painel da Supabase, log do Fly, `raise warning`);
 * agora a pergunta "o que aconteceu com o pagamento do fulano às 14h" tem
 * um endereço.
 *
 * Os filtros vivem na URL: a notificação de fatal manda para
 * /admin/logs?fonte=x, e um link colado no WhatsApp abre a mesma vista.
 */

const SELECT = 'rounded-lg border border-white/10 bg-surface-1 px-2.5 py-1.5 text-xs font-medium text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent'

function Numero({ rotulo, valor, destaque }: { rotulo: string; valor: number; destaque?: boolean }) {
  return (
    <div className="rounded-2xl border border-white/5 bg-surface-1 px-5 py-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">{rotulo}</p>
      <p className={`mt-1 font-kanit text-3xl font-bold tabular-nums ${destaque && valor > 0 ? 'text-red-300' : 'text-ink'}`}>{valor}</p>
    </div>
  )
}

export default function Logs() {
  const [parametros, definirParametros] = useSearchParams()
  const filtros = useMemo(() => lerFiltros(parametros), [parametros])
  const [aoVivo, definirAoVivo] = useState(false)
  const [escolhidaId, definirEscolhidaId] = useState<number | null>(null)
  const [buscaDigitada, definirBuscaDigitada] = useState(filtros.busca)

  const logs = useLogs(filtros)
  const resumo24h = useResumo24h()
  const aoConectar = useCallback((ligado: boolean) => definirAoVivo(ligado), [])
  useLogsAoVivo(aoConectar)

  const agora = useMemo(() => new Date(), [logs.data]) // eslint-disable-line react-hooks/exhaustive-deps
  // O servidor já filtrou; reaplicar em memória é o que mantém a lista
  // honesta quando o Realtime empurra uma linha que não cabe no filtro.
  const linhas = useMemo(() => filtrar(logs.data ?? [], filtros, agora), [logs.data, filtros, agora])
  const fontes = useMemo(() => fontesDe(logs.data ?? []), [logs.data])
  const topo = useMemo(() => agruparPorEvento(linhas), [linhas])
  const numeros = useMemo(() => resumo(resumo24h.data ?? []), [resumo24h.data])
  const escolhida = linhas.find((l) => l.id === escolhidaId) ?? (logs.data ?? []).find((l) => l.id === escolhidaId) ?? null

  const mudar = (parte: Partial<Filtros>) => {
    definirParametros(filtrosParaBusca({ ...filtros, ...parte }), { replace: true })
  }
  const alternarNivel = (n: Nivel) => {
    const ativo = filtros.niveis.includes(n)
    const proximos = ativo ? filtros.niveis.filter((x) => x !== n) : [...filtros.niveis, n]
    if (proximos.length === 0) return
    mudar({ niveis: NIVEIS.filter((x) => proximos.includes(x)) })
  }
  const enviarBusca = (e: React.FormEvent) => {
    e.preventDefault()
    mudar({ busca: buscaDigitada.trim() })
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="hero-heading font-kanit text-4xl font-bold leading-tight sm:text-5xl">Logs</h1>
          <p className="mt-2 max-w-2xl text-sm font-light text-muted">
            Tudo o que deu errado — no navegador de quem compra, nas edge functions, na Vercel, no worker do Scan e no banco — numa trilha só.
          </p>
        </div>
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${aoVivo ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300' : 'border-white/10 bg-white/5 text-muted'}`}>
          <Radio aria-hidden className="h-3 w-3" /> {aoVivo ? 'Ao vivo' : 'Conectando…'}
        </span>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Numero rotulo="Erros · 24 h" valor={numeros.erros} destaque />
        <Numero rotulo="Fatais · 24 h" valor={numeros.fatais} destaque />
        <Numero rotulo="Avisos · 24 h" valor={numeros.avisos} />
        <Numero rotulo="Fontes com erro" valor={numeros.fontesComErro} />
      </div>

      <section aria-label="Filtros" className="mt-6 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Níveis">
          {NIVEIS.map((n) => {
            const ativo = filtros.niveis.includes(n)
            return (
              <button
                key={n}
                type="button"
                aria-pressed={ativo}
                onClick={() => alternarNivel(n)}
                className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide transition-colors ${ativo ? CLASSE_NIVEL[n] : 'border-white/10 bg-transparent text-muted hover:text-ink'}`}
              >
                {ROTULO_NIVEL[n]}
              </button>
            )
          })}
        </div>
        <select aria-label="Origem" className={SELECT} value={filtros.origem ?? ''} onChange={(e) => mudar({ origem: (e.target.value || null) as Origem | null })}>
          <option value="">Toda origem</option>
          {ORIGENS.map((o) => (
            <option key={o} value={o}>{ROTULO_ORIGEM[o]}</option>
          ))}
        </select>
        <select aria-label="Fonte" className={SELECT} value={filtros.fonte ?? ''} onChange={(e) => mudar({ fonte: e.target.value || null })}>
          <option value="">Toda fonte</option>
          {filtros.fonte && !fontes.includes(filtros.fonte) && <option value={filtros.fonte}>{filtros.fonte}</option>}
          {fontes.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
        <select aria-label="Período" className={SELECT} value={filtros.periodo} onChange={(e) => mudar({ periodo: e.target.value as Periodo })}>
          {PERIODOS.map((p) => (
            <option key={p} value={p}>{ROTULO_PERIODO[p]}</option>
          ))}
        </select>
        <form onSubmit={enviarBusca} className="relative min-w-[220px] flex-1">
          <Search aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
          <input
            type="search"
            aria-label="Buscar"
            placeholder="Mensagem, evento, id da requisição…"
            value={buscaDigitada}
            onChange={(e) => definirBuscaDigitada(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-surface-1 py-1.5 pl-8 pr-3 text-xs text-ink placeholder:text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          />
        </form>
      </section>

      {topo.length > 0 && (
        <section aria-label="Eventos mais frequentes" className="mt-4 flex flex-wrap gap-1.5">
          {topo.map((g) => (
            <button
              key={`${g.fonte}|${g.evento}`}
              type="button"
              onClick={() => { definirBuscaDigitada(g.evento); mudar({ busca: g.evento, fonte: g.fonte }) }}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-surface-1 px-2.5 py-1 text-[11px] text-ink transition-colors hover:border-white/20"
              title={`${g.linhas} linha(s), ${g.ocorrencias} ocorrência(s)`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${g.nivel === 'fatal' || g.nivel === 'erro' ? 'bg-red-400' : g.nivel === 'aviso' ? 'bg-amber-400' : 'bg-sky-400'}`} />
              <span className="font-mono text-muted">{g.fonte}</span>
              <span>{g.evento}</span>
              <span className="tabular-nums text-muted">×{g.ocorrencias}</span>
            </button>
          ))}
        </section>
      )}

      <div className={`mt-6 grid gap-5 ${escolhida ? 'lg:grid-cols-[minmax(0,55fr)_minmax(0,45fr)] lg:items-start' : ''}`}>
        <section aria-label="Lista de logs" className="rounded-2xl border border-white/5 bg-surface-1">
          {logs.isLoading ? (
            <p className="px-6 py-14 text-center text-sm text-muted">Carregando…</p>
          ) : logs.isError ? (
            <p className="px-6 py-14 text-center text-sm text-red-300">Não deu para carregar os logs: {logs.error instanceof Error ? logs.error.message : 'erro'}</p>
          ) : linhas.length === 0 ? (
            <p className="px-6 py-14 text-center text-sm text-muted">Nada por aqui com esses filtros — bom sinal.</p>
          ) : (
            <ul className="divide-y divide-white/5">
              {linhas.map((l) => (
                <li key={l.id}>
                  <button
                    type="button"
                    onClick={() => definirEscolhidaId(l.id === escolhidaId ? null : l.id)}
                    aria-current={l.id === escolhidaId ? 'true' : undefined}
                    className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.03] ${l.id === escolhidaId ? 'bg-white/[0.05]' : ''}`}
                  >
                    <span className={`mt-0.5 inline-flex w-14 shrink-0 justify-center rounded-full border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${CLASSE_NIVEL[l.nivel as Nivel] ?? CLASSE_NIVEL.debug}`}>
                      {l.nivel}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-baseline gap-x-2 text-xs">
                        <span className="font-mono text-ink">{l.fonte}</span>
                        <span className="text-muted">{l.evento}</span>
                        <span className="text-[10px] uppercase tracking-wide text-muted/70">{ROTULO_ORIGEM[l.origem as Origem] ?? l.origem}</span>
                      </span>
                      <span className="mt-0.5 block truncate text-sm text-ink/90">{l.mensagem}</span>
                    </span>
                    <span className="shrink-0 text-right text-xs tabular-nums text-muted">
                      <span className="block">{haQuanto(l.ultima_em, agora)}</span>
                      {l.ocorrencias > 1 && <span className="block font-semibold text-ink">×{l.ocorrencias}</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {escolhida && (
          <LogDetalhe
            linha={escolhida}
            relacionadas={relacionadas(logs.data ?? [], escolhida)}
            agora={agora}
            aoFechar={() => definirEscolhidaId(null)}
            aoEscolher={(l) => definirEscolhidaId(l.id)}
          />
        )}
      </div>
    </div>
  )
}
