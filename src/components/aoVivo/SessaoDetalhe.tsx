import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Bot, Eye, MapPin } from 'lucide-react'
import {
  bandeira,
  classificarVisitante,
  comprou,
  descreverEvento,
  duracaoDaSessao,
  formatCentavos,
  horaCurta,
  localDaSessao,
  motivoDoBot,
  origemDaVisita,
  presencaDaSessao,
  rotuloDaEtapa,
  secaoNormalizada,
  SECOES,
  type EventoAoVivo,
  type PedidoDaSessao,
  type SessaoAoVivo,
} from './aoVivoResumo'

/**
 * A sessão aberta: quem é, de onde veio, ONDE ESTÁ OLHANDO agora (o mapa
 * da página, com a seção acesa), o pedido, e a linha do tempo completa —
 * do "chegou" ao "comprou" ou ao "fechou a página".
 *
 * A linha do tempo cresce ao vivo: cada passo novo entra embaixo e a rolagem
 * acompanha, como um terminal.
 */

interface Props {
  sessao: SessaoAoVivo
  eventos: readonly EventoAoVivo[] | undefined
  carregandoEventos: boolean
  pedidos: ReadonlyMap<string, PedidoDaSessao>
  agora: Date
  /** Título do checkout em que a pessoa está (quando há mais de um). */
  nomeDoCheckout?: string | null
}

const COR_DO_TOM = {
  neutro: 'bg-white/25',
  bom: 'bg-emerald-400',
  ruim: 'bg-red-400',
  destaque: 'bg-accent',
} as const

function Fato({ rotulo, valor }: { rotulo: string; valor: string | null }) {
  if (!valor) return null
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-medium uppercase tracking-widest text-muted">{rotulo}</dt>
      <dd className="mt-0.5 truncate text-sm text-ink" title={valor}>
        {valor}
      </dd>
    </div>
  )
}

/** O mapa da página: as seções na ordem, com a que está no centro da tela acesa. */
function MapaDaPagina({ sessao, viva }: { sessao: SessaoAoVivo; viva: boolean }) {
  const atual = secaoNormalizada(sessao.secao)
  return (
    <ol className="flex flex-col gap-1" aria-label="Seções do checkout">
      {SECOES.map((secao) => {
        const acesa = secao.id === atual
        return (
          <li
            key={secao.id}
            aria-current={acesa ? 'location' : undefined}
            className={[
              'flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs transition-colors duration-300',
              acesa
                ? 'border-accent/60 bg-accent/15 text-ink'
                : 'border-white/5 bg-white/[0.02] text-muted',
            ].join(' ')}
          >
            {acesa ? (
              <Eye
                aria-hidden
                className={`h-3.5 w-3.5 text-accent ${viva ? 'motion-safe:animate-pulse' : ''}`}
              />
            ) : (
              <span aria-hidden className="h-1 w-1 rounded-full bg-white/20" />
            )}
            <span className="flex-1">{secao.label}</span>
            {acesa && sessao.foco && (secao.id === 'dados' || secao.id === 'pagamento') && (
              <span className="text-[10px] font-medium uppercase tracking-wider text-accent">
                digitando
              </span>
            )}
          </li>
        )
      })}
    </ol>
  )
}

export default function SessaoDetalhe({
  sessao,
  eventos,
  carregandoEventos,
  pedidos,
  agora,
  nomeDoCheckout = null,
}: Props) {
  const presenca = presencaDaSessao(sessao, agora)
  const tipo = classificarVisitante(sessao)
  const venda = comprou(sessao, pedidos)
  const pedido = sessao.pedido_id ? pedidos.get(sessao.pedido_id) : undefined
  const flag = bandeira(sessao.pais)
  const utm = sessao.utm as Record<string, unknown> | null
  const listaRef = useRef<HTMLOListElement>(null)

  // Linha do tempo acompanha o último passo, como um terminal.
  useEffect(() => {
    const lista = listaRef.current
    if (lista) lista.scrollTop = lista.scrollHeight
  }, [eventos?.length])

  const campanha = [utm?.utm_campaign, utm?.utm_content]
    .filter((v): v is string => typeof v === 'string' && v.length > 0)
    .join(' · ')

  const pagamento = (() => {
    const partes = [
      sessao.metodo ? (sessao.metodo === 'pix' ? 'Pix' : 'Cartão') : null,
      sessao.bump ? 'com bump' : null,
      sessao.cupom ? `cupom ${sessao.cupom}` : null,
    ].filter(Boolean)
    return partes.length > 0 ? partes.join(' · ') : null
  })()

  return (
    <section
      aria-label="Detalhe da visita"
      className="flex h-full flex-col rounded-2xl border border-white/5 bg-gradient-to-b from-surface-1 to-[#101018] shadow-[0_1px_0_0_rgba(255,255,255,0.06)_inset]"
    >
      <header className="border-b border-white/5 px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate font-kanit text-xl font-semibold text-ink">
              {sessao.nome ?? sessao.email ?? 'Visitante'}
            </h3>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs font-light text-muted">
              <span className="inline-flex items-center gap-1">
                <MapPin aria-hidden className="h-3 w-3" />
                {flag ? `${flag} ` : ''}
                {localDaSessao(sessao)}
              </span>
              {nomeDoCheckout && <span>{nomeDoCheckout}</span>}
              <span>{duracaoDaSessao(sessao, agora)} na página</span>
              <span
                className={
                  presenca.estado === 'agora'
                    ? 'text-emerald-300'
                    : presenca.estado === 'parada'
                      ? 'text-amber-300'
                      : ''
                }
              >
                {presenca.label}
              </span>
            </p>
          </div>
          <span
            className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${
              venda
                ? 'border-accent/40 bg-accent/15 text-ink'
                : 'border-white/10 bg-white/5 text-muted'
            }`}
          >
            {venda ? 'Comprou' : rotuloDaEtapa(sessao)}
          </span>
        </div>

        {tipo !== 'pessoa' && (
          <p className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-amber-400/25 bg-amber-400/10 px-2.5 py-1 text-xs text-amber-200">
            <Bot aria-hidden className="h-3.5 w-3.5" />
            {tipo === 'bot' ? 'Bot' : 'Provável bot'} — {motivoDoBot(sessao)}. Fora das contas.
          </p>
        )}
      </header>

      <div className="grid gap-5 px-5 py-4 lg:grid-cols-[minmax(0,1fr)_11rem]">
        <div className="flex flex-col gap-5">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
            <Fato rotulo="E-mail" valor={sessao.email} />
            <Fato rotulo="WhatsApp" valor={sessao.whatsapp} />
            <Fato
              rotulo="CPF/CNPJ"
              valor={sessao.documento_preenchido ? 'preenchido (não guardamos)' : null}
            />
            <Fato
              rotulo="Origem"
              valor={`${origemDaVisita(sessao.referrer, utm)}${campanha ? ` · ${campanha}` : ''}`}
            />
            <Fato
              rotulo="Aparelho"
              valor={[sessao.dispositivo, sessao.navegador, sessao.so].filter(Boolean).join(' · ')}
            />
            <Fato
              rotulo="Tela"
              valor={
                sessao.largura && sessao.altura ? `${sessao.largura} × ${sessao.altura}` : null
              }
            />
            <Fato
              rotulo="Chegou às"
              valor={new Date(sessao.iniciado_em).toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            />
            <Fato rotulo="Pagamento" valor={pagamento} />
            <Fato
              rotulo="Total"
              valor={
                pedido
                  ? `${formatCentavos(pedido.total_centavos)} · ${pedido.status}`
                  : sessao.total_centavos !== null
                    ? `${formatCentavos(sessao.total_centavos)} (prévia)`
                    : null
              }
            />
          </dl>

          {sessao.pedido_id && (
            <Link
              to="/admin/pedidos"
              className="inline-flex w-fit items-center rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-muted transition-colors duration-150 hover:bg-white/5 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
            >
              Ver pedido
            </Link>
          )}
        </div>

        <div>
          <p className="mb-2 text-[10px] font-medium uppercase tracking-widest text-muted">
            Onde está olhando
          </p>
          <MapaDaPagina sessao={sessao} viva={presenca.estado === 'agora'} />
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col border-t border-white/5 px-5 py-4">
        <p className="mb-3 text-[10px] font-medium uppercase tracking-widest text-muted">
          Passo a passo
        </p>
        {carregandoEventos && !eventos && (
          <div className="space-y-2">
            {Array.from({ length: 4 }, (_, i) => (
              <div
                key={i}
                className="h-5 animate-pulse rounded bg-white/5"
                style={{ opacity: 1 - i * 0.2 }}
              />
            ))}
          </div>
        )}
        {eventos && eventos.length === 0 && (
          <p className="text-sm font-light text-muted">Nenhum passo registrado ainda.</p>
        )}
        {eventos && eventos.length > 0 && (
          <ol
            ref={listaRef}
            className="max-h-[26rem] overflow-y-auto pr-1"
            aria-label="Linha do tempo da visita"
          >
            {eventos.map((evento, i) => {
              const d = descreverEvento(evento)
              const ultimo = i === eventos.length - 1
              return (
                <li key={evento.id} className="relative flex gap-3 pb-3 last:pb-0">
                  {!ultimo && (
                    <span
                      aria-hidden
                      className="absolute left-[3px] top-4 h-full w-px bg-white/10"
                    />
                  )}
                  <span
                    aria-hidden
                    className={`mt-1.5 h-[7px] w-[7px] shrink-0 rounded-full ${COR_DO_TOM[d.tom]}`}
                  />
                  <span className="w-16 shrink-0 pt-px text-[11px] tabular-nums text-muted">
                    {horaCurta(evento.criado_em)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block text-sm ${
                        d.tom === 'ruim'
                          ? 'text-red-200'
                          : d.tom === 'bom'
                            ? 'text-emerald-200'
                            : ultimo
                              ? 'text-ink'
                              : 'text-ink/80'
                      }`}
                    >
                      {d.titulo}
                    </span>
                    {d.detalhe && (
                      <span className="block text-xs font-light text-muted">{d.detalhe}</span>
                    )}
                  </span>
                </li>
              )
            })}
          </ol>
        )}
      </div>
    </section>
  )
}
