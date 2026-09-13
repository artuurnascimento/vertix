import { useMemo } from 'react'
import { AlertTriangle, CheckCircle2, CircleDashed, PauseCircle, RefreshCw } from 'lucide-react'
import Toast, { useToast } from '../components/ui/Toast'
import { formatBRL } from '../lib/commercial'
import { haQuanto, resumirCron, rotinasDoWorker } from '../components/automacoes/automacoes'
import type { SaudeDaRotina } from '../components/automacoes/automacoes'
import {
  useEntregasPendentes,
  useJobRuns,
  useJobStatus,
  useReprocessarEntrega,
} from '../components/automacoes/automacoesData'

const SAUDE: Record<SaudeDaRotina, { rotulo: string; classe: string; Icone: typeof CheckCircle2 }> = {
  ok: { rotulo: 'Rodando', classe: 'text-emerald-300 border-emerald-400/30 bg-emerald-400/10', Icone: CheckCircle2 },
  falhou: { rotulo: 'Falhou', classe: 'text-red-300 border-red-400/30 bg-red-400/10', Icone: AlertTriangle },
  parada: { rotulo: 'Parada', classe: 'text-amber-300 border-amber-400/30 bg-amber-400/10', Icone: PauseCircle },
  nunca: { rotulo: 'Sem registro', classe: 'text-muted border-white/10 bg-white/5', Icone: CircleDashed },
}

const ESTADO_DO_REPROCESSAMENTO: Record<string, string> = {
  processando: 'Reprocessando: o worker está entregando agora.',
  ja_entregue: 'O worker diz que já entregou — a lista atualiza em instantes.',
  em_andamento: 'Já está sendo entregue neste momento.',
}

function Selo({ saude }: { saude: SaudeDaRotina }) {
  const s = SAUDE[saude]
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${s.classe}`}>
      <s.Icone aria-hidden className="h-3 w-3" />
      {s.rotulo}
    </span>
  )
}

/**
 * Automações: o que roda sozinho (varreduras do worker do Scan e cron do
 * banco), quando rodou e o que falhou; e a lista de quem pagou e não
 * recebeu, com "Reprocessar" — o pior cenário do negócio é cobrar e não
 * entregar, e até aqui isso só aparecia no log do Fly.
 */
export default function Automacoes() {
  const { toast, mostrar } = useToast()
  const jobStatus = useJobStatus()
  const jobRuns = useJobRuns()
  const pendentes = useEntregasPendentes()
  const reprocessar = useReprocessarEntrega()
  // Um "agora" por render: os "há X min" da tela ficam coerentes entre si.
  const agora = useMemo(() => new Date(), [jobStatus.data, jobRuns.data, pendentes.data]) // eslint-disable-line react-hooks/exhaustive-deps

  const worker = useMemo(() => rotinasDoWorker(jobStatus.data ?? [], agora), [jobStatus.data, agora])
  const cron = useMemo(() => resumirCron(jobRuns.data ?? [], agora), [jobRuns.data, agora])

  const comProblema = worker.filter((r) => r.saude === 'falhou' || r.saude === 'parada').length
  const entregas = pendentes.data ?? []

  const handleReprocessar = (tipo: 'pedido' | 'compra', id: string) => {
    reprocessar.mutate(
      { tipo, id },
      {
        onSuccess: (r) => mostrar({ texto: ESTADO_DO_REPROCESSAMENTO[r.estado] ?? 'Reprocessamento pedido.', tipo: 'sucesso' }),
        onError: (e) => mostrar({ texto: e instanceof Error ? e.message : 'Não deu para reprocessar.', tipo: 'erro' }),
      }
    )
  }

  return (
    <div>
      <div>
        <h1 className="hero-heading font-kanit text-4xl font-bold leading-tight sm:text-5xl">Automações</h1>
        <p className="mt-2 text-sm font-light text-muted">
          O que roda sozinho, quando rodou pela última vez e o que está preso.
        </p>
      </div>

      {/* Pagou e não recebeu — vem primeiro porque é o que custa reputação. */}
      <section aria-labelledby="pendentes-heading" className="mt-8 rounded-2xl border border-white/5 bg-surface-1 p-6 sm:p-7">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h2 id="pendentes-heading" className="text-lg font-semibold text-ink">
              Pagou e não recebeu
              {entregas.length > 0 && (
                <span className="ml-2 rounded-full bg-red-400/15 px-2 py-0.5 text-xs font-semibold text-red-300">{entregas.length}</span>
              )}
            </h2>
            <p className="mt-0.5 text-xs font-light text-muted">
              Pedidos e compras pagos sem plano entregue ou sem recibo. A varredura tenta de novo a cada minuto; reprocessar pede na hora.
            </p>
          </div>
        </div>

        {pendentes.isLoading && <p className="mt-5 text-sm text-muted">Carregando…</p>}
        {pendentes.isError && (
          <p role="alert" className="mt-5 text-sm text-red-400">Não foi possível carregar as entregas pendentes.</p>
        )}
        {!pendentes.isLoading && !pendentes.isError && entregas.length === 0 && (
          <p className="mt-5 flex items-center gap-2 text-sm text-emerald-300">
            <CheckCircle2 aria-hidden className="h-4 w-4" />
            Ninguém esperando entrega.
          </p>
        )}
        {entregas.length > 0 && (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] font-medium uppercase tracking-widest text-muted">
                  <th scope="col" className="pb-2 pr-4 font-medium">Quem</th>
                  <th scope="col" className="pb-2 pr-4 font-medium">Pagou</th>
                  <th scope="col" className="pb-2 pr-4 text-right font-medium">Valor</th>
                  <th scope="col" className="pb-2 pr-4 font-medium">Falta</th>
                  <th scope="col" className="pb-2 font-medium"><span className="sr-only">Ações</span></th>
                </tr>
              </thead>
              <tbody>
                {entregas.map((e) => (
                  <tr key={`${e.tipo}:${e.id}`} data-testid={`pendente-${e.id}`} className="border-t border-white/5">
                    <td className="py-2.5 pr-4">
                      <span className="text-ink">{e.cliente ?? 'Sem nome'}</span>
                      <span className="mt-0.5 block text-[11px] text-muted">
                        {e.email ?? '—'} · {e.tipo === 'pedido' ? 'checkout' : 'Scan'}
                        {e.plano_code ? ` · plano ${e.plano_code}` : ''}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 text-muted">{haQuanto(e.pago_em, agora)}</td>
                    <td className="py-2.5 pr-4 text-right tabular-nums text-ink">{formatBRL(Number(e.valor ?? 0))}</td>
                    <td className="py-2.5 pr-4 text-amber-300">{e.faltando}</td>
                    <td className="py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => handleReprocessar(e.tipo, e.id)}
                        disabled={reprocessar.isPending}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-accent/40 bg-accent/15 px-3 py-1.5 text-xs font-semibold text-accent transition-colors duration-150 hover:bg-accent/25 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <RefreshCw aria-hidden className={`h-3.5 w-3.5 ${reprocessar.isPending ? 'animate-spin' : ''}`} />
                        Reprocessar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="worker-heading" className="mt-6 rounded-2xl border border-white/5 bg-surface-1 p-6 sm:p-7">
        <h2 id="worker-heading" className="text-lg font-semibold text-ink">
          Varreduras do worker
          {comProblema > 0 && (
            <span className="ml-2 rounded-full bg-amber-400/15 px-2 py-0.5 text-xs font-semibold text-amber-300">
              {comProblema} com problema
            </span>
          )}
        </h2>
        <p className="mt-0.5 text-xs font-light text-muted">
          Rodam a cada minuto no worker do Scan. "Rodando" = sinal de vida nos últimos 15 minutos.
        </p>
        {jobStatus.isError && (
          <p role="alert" className="mt-5 text-sm text-red-400">Não foi possível ler o estado das varreduras.</p>
        )}
        <ul className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {worker.map((r) => (
            <li key={r.job} data-testid={`rotina-${r.job}`} className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium text-ink">{r.rotulo}</p>
                <Selo saude={r.saude} />
              </div>
              {r.descricao && <p className="mt-1 text-xs font-light leading-relaxed text-muted">{r.descricao}</p>}
              <p className="mt-2 text-[11px] text-muted">
                último OK {haQuanto(r.ultimoOk, agora)}
                {r.itens !== null && ` · ${r.itens} ${r.itens === 1 ? 'item' : 'itens'}`}
              </p>
              {r.saude === 'falhou' && r.erro && (
                <p className="mt-1.5 break-words rounded-lg border border-red-400/20 bg-red-400/10 px-2.5 py-1.5 font-mono text-[11px] text-red-300">
                  {haQuanto(r.ultimoErro, agora)}: {r.erro}
                </p>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="cron-heading" className="mt-6 rounded-2xl border border-white/5 bg-surface-1 p-6 sm:p-7">
        <h2 id="cron-heading" className="text-lg font-semibold text-ink">Rotinas do banco</h2>
        <p className="mt-0.5 text-xs font-light text-muted">Agendadas no Postgres; cada disparo deixa uma linha em job_runs.</p>
        {jobRuns.isError && (
          <p role="alert" className="mt-5 text-sm text-red-400">Não foi possível ler a trilha do cron.</p>
        )}
        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] font-medium uppercase tracking-widest text-muted">
                <th scope="col" className="pb-2 pr-4 font-medium">Rotina</th>
                <th scope="col" className="pb-2 pr-4 font-medium">Última execução</th>
                <th scope="col" className="pb-2 pr-4 text-right font-medium">Itens</th>
                <th scope="col" className="pb-2 pr-4 text-right font-medium">Falhas (7 d)</th>
                <th scope="col" className="pb-2 font-medium">Detalhe</th>
              </tr>
            </thead>
            <tbody>
              {cron.map((r) => (
                <tr key={r.job} data-testid={`cron-${r.job}`} className="border-t border-white/5">
                  <td className="py-2.5 pr-4">
                    <span className="text-ink">{r.rotulo}</span>
                    {r.agenda && <span className="mt-0.5 block text-[11px] text-muted">{r.agenda}</span>}
                  </td>
                  <td className="py-2.5 pr-4">
                    <span className="flex items-center gap-2">
                      <Selo saude={r.saude} />
                      <span className="text-muted">{haQuanto(r.ultimaExecucao, agora)}</span>
                    </span>
                  </td>
                  <td className="py-2.5 pr-4 text-right tabular-nums text-ink">{r.ultimosItens ?? '—'}</td>
                  <td className={`py-2.5 pr-4 text-right tabular-nums ${r.falhas7d > 0 ? 'text-red-300' : 'text-muted'}`}>
                    {r.falhas7d} / {r.execucoes7d}
                  </td>
                  <td className="max-w-xs truncate py-2.5 text-xs text-muted">{r.ultimoDetalhe ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <Toast mensagem={toast} />
    </div>
  )
}
