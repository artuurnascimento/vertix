import { Bot, MapPin, Monitor, Smartphone, Tablet } from 'lucide-react'
import {
  bandeira,
  classificarVisitante,
  comprou,
  localDaSessao,
  motivoDoBot,
  origemDaVisita,
  presencaDaSessao,
  rotuloDaEtapa,
  tempoDecorrido,
  type PedidoDaSessao,
  type SessaoAoVivo,
} from './aoVivoResumo'

/**
 * Uma visita na lista do "Ao vivo": quem é (o que já digitou), onde está no
 * mundo, o que está fazendo agora e há quanto tempo. A bolinha à esquerda é
 * a presença — verde pulsando enquanto o navegador bate, âmbar quando parou,
 * cinza quando foi embora, e roxa quando comprou.
 *
 * Bots entram apagados e com o motivo: a lista é de gente, mas esconder o
 * bot por completo deixaria a pergunta "de onde vieram 40 visitas?" sem
 * resposta.
 */

interface Props {
  sessao: SessaoAoVivo
  pedidos: ReadonlyMap<string, PedidoDaSessao>
  agora: Date
  selecionada: boolean
  onSelecionar: (id: string) => void
  /** Mouse em cima: acende o ponto desta visita no mapa (null ao sair). */
  onDestacar?: (id: string | null) => void
}

const ICONE_DISPOSITIVO = {
  celular: Smartphone,
  tablet: Tablet,
  computador: Monitor,
} as const

function Presenca({
  estado,
  venda,
}: {
  estado: 'agora' | 'parada' | 'saiu'
  venda: boolean
}) {
  if (venda) {
    return (
      <span
        aria-hidden
        className="flex h-2.5 w-2.5 items-center justify-center rounded-full bg-accent shadow-[0_0_0_4px_rgba(108,91,242,0.18)]"
      />
    )
  }
  if (estado === 'agora') {
    return (
      <span aria-hidden className="relative flex h-2.5 w-2.5">
        <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60 motion-safe:animate-ping" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
      </span>
    )
  }
  return (
    <span
      aria-hidden
      className={`block h-2.5 w-2.5 rounded-full ${
        estado === 'parada' ? 'bg-amber-400' : 'bg-white/30'
      }`}
    />
  )
}

export default function SessaoLinha({
  sessao,
  pedidos,
  agora,
  selecionada,
  onSelecionar,
  onDestacar,
}: Props) {
  const presenca = presencaDaSessao(sessao, agora)
  const tipo = classificarVisitante(sessao)
  const venda = comprou(sessao, pedidos)
  const Dispositivo =
    ICONE_DISPOSITIVO[(sessao.dispositivo ?? 'computador') as keyof typeof ICONE_DISPOSITIVO] ??
    Monitor
  const quem = sessao.nome ?? sessao.email ?? sessao.whatsapp ?? 'Visitante'
  const local = localDaSessao(sessao)
  const flag = bandeira(sessao.pais)

  return (
    <li
      onPointerEnter={() => onDestacar?.(sessao.id)}
      onPointerLeave={() => onDestacar?.(null)}
    >
      <button
        type="button"
        onClick={() => onSelecionar(sessao.id)}
        aria-current={selecionada ? 'true' : undefined}
        className={[
          'flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent',
          selecionada
            ? 'border-accent/50 bg-accent/10'
            : 'border-white/5 bg-surface-1 hover:border-white/10 hover:bg-white/[0.03]',
          tipo === 'pessoa' ? '' : 'opacity-55',
        ].join(' ')}
      >
        <span className="mt-1.5 shrink-0">
          <Presenca estado={presenca.estado} venda={venda} />
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-sm font-medium text-ink">{quem}</span>
            {tipo !== 'pessoa' && (
              <span
                className="inline-flex shrink-0 items-center gap-1 rounded-full border border-white/10 px-1.5 py-px text-[10px] font-medium uppercase tracking-wider text-muted"
                title={motivoDoBot(sessao)}
              >
                <Bot aria-hidden className="h-3 w-3" />
                {tipo === 'bot' ? 'bot' : 'sem sinal humano'}
              </span>
            )}
          </span>
          <span className="mt-0.5 block truncate text-xs text-ink/80">
            {venda ? 'Comprou · ' : ''}
            {rotuloDaEtapa(sessao)}
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] font-light text-muted">
            <span className="inline-flex items-center gap-1">
              <MapPin aria-hidden className="h-3 w-3" />
              {flag ? `${flag} ` : ''}
              {local}
            </span>
            <span className="inline-flex items-center gap-1">
              <Dispositivo aria-hidden className="h-3 w-3" />
              {sessao.navegador ?? sessao.dispositivo ?? 'navegador'}
            </span>
            <span>
              {origemDaVisita(sessao.referrer, sessao.utm as Record<string, unknown> | null)}
            </span>
          </span>
        </span>

        <span className="shrink-0 text-right">
          <span
            className={`block text-[11px] font-medium ${
              presenca.estado === 'agora'
                ? 'text-emerald-300'
                : presenca.estado === 'parada'
                  ? 'text-amber-300'
                  : 'text-muted'
            }`}
          >
            {presenca.estado === 'agora'
              ? presenca.label
              : `há ${tempoDecorrido(sessao.ultimo_evento_em, agora)}`}
          </span>
          <span className="mt-0.5 block text-[11px] font-light tabular-nums text-muted">
            {new Date(sessao.iniciado_em).toLocaleTimeString('pt-BR', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </span>
      </button>
    </li>
  )
}
