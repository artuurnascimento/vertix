import { useMemo, useState } from 'react'
import { Radio, Users } from 'lucide-react'
import { useAoVivo } from './useAoVivo'
import {
  classificarVisitante,
  formatCentavos,
  funilAoVivo,
  ordenarSessoes,
  resumoAoVivo,
} from './aoVivoResumo'
import SessaoDetalhe from './SessaoDetalhe'
import SessaoLinha from './SessaoLinha'

/**
 * "Ao vivo" do checkout — quem está na página AGORA, o que cada pessoa está
 * fazendo, de onde é, e o passo a passo completo da visita. Os números do
 * topo e o funil contam só gente: bots (crawler, preview de link, navegador
 * automatizado, ou quem nunca tocou na tela) ficam de fora e aparecem só
 * quando você pede.
 */

interface Props {
  /** Título de cada checkout, para dizer em qual página a pessoa está. */
  nomesDosCheckouts?: ReadonlyMap<string, string>
}

export default function AoVivoTab({ nomesDosCheckouts }: Props) {
  const { sessoes, eventos, pedidos, agora, selecionada, setSelecionada, conectado } =
    useAoVivo()
  const [mostrarBots, setMostrarBots] = useState(false)

  const todas = useMemo(() => sessoes.data ?? [], [sessoes.data])
  const resumo = useMemo(() => resumoAoVivo(todas, agora, pedidos), [todas, agora, pedidos])
  const funil = useMemo(() => funilAoVivo(todas, pedidos), [todas, pedidos])
  const lista = useMemo(
    () =>
      ordenarSessoes(
        mostrarBots ? todas : todas.filter((s) => classificarVisitante(s) === 'pessoa'),
        agora
      ),
    [todas, agora, mostrarBots]
  )
  const aberta = useMemo(
    () => todas.find((s) => s.id === selecionada) ?? null,
    [todas, selecionada]
  )

  if (sessoes.isLoading) {
    return (
      <div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-surface-1" />
          ))}
        </div>
        <div className="mt-6 space-y-3">
          {Array.from({ length: 3 }, (_, i) => (
            <div
              key={i}
              className="h-16 animate-pulse rounded-xl bg-surface-1"
              style={{ opacity: 1 - i * 0.3 }}
            />
          ))}
        </div>
      </div>
    )
  }

  if (sessoes.isError) {
    return (
      <div className="rounded-xl border border-red-400/25 bg-red-400/10 px-6 py-8 text-center">
        <p className="text-sm font-light text-red-100/90">
          Não deu para carregar o ao vivo. Se a migration do rastreio ainda não rodou, é isso.
        </p>
      </div>
    )
  }

  const cards = [
    {
      label: 'Na página agora',
      valor: resumo.agora.toLocaleString('pt-BR'),
      destaque: resumo.agora > 0,
    },
    { label: 'Visitas · 24 h', valor: resumo.visitas.toLocaleString('pt-BR') },
    { label: 'Compraram · 24 h', valor: resumo.compraram.toLocaleString('pt-BR') },
    { label: 'Receita · 24 h', valor: formatCentavos(resumo.receitaCentavos) },
  ]
  const base = funil[0]?.total ?? 0

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-muted">
          <span className="relative flex h-2 w-2">
            {conectado && (
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60 motion-safe:animate-ping" />
            )}
            <span
              className={`relative inline-flex h-2 w-2 rounded-full ${
                conectado ? 'bg-emerald-400' : 'bg-amber-400'
              }`}
            />
          </span>
          {conectado ? 'Ao vivo' : 'Reconectando…'}
        </p>
        {resumo.bots > 0 && (
          <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-light text-muted">
            <input
              type="checkbox"
              checked={mostrarBots}
              onChange={(e) => setMostrarBots(e.target.checked)}
              className="h-3.5 w-3.5 accent-[#6C5BF2]"
            />
            Mostrar bots ({resumo.bots.toLocaleString('pt-BR')})
          </label>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className={`rounded-xl border px-4 py-3 ${
              card.destaque
                ? 'border-emerald-400/30 bg-emerald-400/10'
                : 'border-white/5 bg-surface-1'
            }`}
          >
            <p className="text-[10px] font-medium uppercase tracking-widest text-muted">
              {card.label}
            </p>
            <p className="mt-1 truncate tabular-nums text-lg font-semibold text-ink">
              {card.valor}
            </p>
          </div>
        ))}
      </div>

      {/* Funil das últimas 24 h: cada barra é a fração de quem chegou. */}
      <ol
        aria-label="Funil das últimas 24 horas"
        className="mt-4 grid gap-2 rounded-xl border border-white/5 bg-surface-1 px-4 py-3 sm:grid-cols-4"
      >
        {funil.map((passo, i) => {
          const fracao = base > 0 ? passo.total / base : 0
          return (
            <li key={passo.id} className="min-w-0">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-[11px] font-light text-muted">{passo.label}</span>
                <span className="tabular-nums text-sm font-semibold text-ink">
                  {passo.total.toLocaleString('pt-BR')}
                  {i > 0 && base > 0 && (
                    <span className="ml-1 text-[10px] font-normal text-muted">
                      {Math.round(fracao * 100)}%
                    </span>
                  )}
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/5">
                <div
                  className={`h-full rounded-full ${
                    i === funil.length - 1 ? 'bg-accent' : 'bg-emerald-400/70'
                  }`}
                  style={{ width: `${Math.max(fracao * 100, passo.total > 0 ? 3 : 0)}%` }}
                />
              </div>
            </li>
          )
        })}
      </ol>

      {lista.length === 0 ? (
        <div className="mt-6 rounded-xl border border-white/5 bg-surface-1 px-6 py-14 text-center">
          <Users className="mx-auto h-8 w-8 text-muted/50" />
          <p className="mt-3 text-sm font-medium text-ink">
            {todas.length > 0 && !mostrarBots
              ? 'Só bots passaram por aqui nas últimas 24 h.'
              : 'Ninguém no checkout nas últimas 24 h.'}
          </p>
          <p className="mx-auto mt-2 max-w-md text-sm font-light text-muted">
            Quando alguém abrir a página, aparece aqui no mesmo segundo — com a cidade, o
            aparelho e cada passo que der.
          </p>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start">
          <ul
            aria-label="Visitas"
            className="flex max-h-[42rem] list-none flex-col gap-2 overflow-y-auto p-0 pr-1"
          >
            {lista.map((s) => (
              <SessaoLinha
                key={s.id}
                sessao={s}
                pedidos={pedidos}
                agora={agora}
                selecionada={s.id === selecionada}
                onSelecionar={setSelecionada}
              />
            ))}
          </ul>

          {aberta ? (
            <SessaoDetalhe
              sessao={aberta}
              eventos={eventos.data}
              carregandoEventos={eventos.isLoading}
              pedidos={pedidos}
              agora={agora}
              nomeDoCheckout={nomesDosCheckouts?.get(aberta.checkout_id) ?? null}
            />
          ) : (
            <div className="flex min-h-[16rem] flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 px-6 text-center">
              <Radio className="h-6 w-6 text-muted/50" />
              <p className="mt-3 text-sm font-light text-muted">
                Escolha uma visita para ver o passo a passo e onde a pessoa está olhando.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
