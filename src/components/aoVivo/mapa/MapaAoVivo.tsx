import { useMemo, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { ALTURA_MAPA, LARGURA_MAPA, caminhoDoArco, projetarNoMapa } from './projecao'
import { SEDE_VERTIX, type Marcador, type TipoDeMarcador } from './locais'

/**
 * O mapa-múndi pontilhado do "Ao vivo" — o modelo do world-map.tsx (Aceternity)
 * aplicado ao checkout: o fundo é o SVG gerado em build pelo dotted-map
 * (public/ao-vivo/mapa.svg), e por cima vai um SVG vivo com:
 *
 *   · um ponto pulsando por visitante NA PÁGINA AGORA (verde) e por PEDIDO
 *     (roxo), um ponto apagado por visita que já passou;
 *   · um arco animado de cada visitante/pedido até a sede da Vertix — a
 *     conexão desenhada, como no modelo;
 *   · tooltip e clique: passar o mouse mostra quem é e onde está; clicar
 *     abre a visita no detalhe.
 *
 * A projeção é a MESMA do dotted-map (Web Mercator, ver projecao.ts): o
 * ponto cai em cima da cidade, não a 200 km dela.
 */

interface Props {
  marcadores: readonly Marcador[]
  selecionadaId: string | null
  /** Marcadores realçados (mouse em cima de um local ou de uma visita). */
  idsDestacados: ReadonlySet<string>
  onSelecionar: (id: string) => void
  sede?: { lat: number; lng: number; nome: string }
}

const COR: Record<TipoDeMarcador, string> = {
  agora: '#34d399',
  pedido: '#8b7cf6',
  passado: '#c7cbe6',
}

const ORDEM: Record<TipoDeMarcador, number> = { passado: 0, agora: 1, pedido: 2 }

export default function MapaAoVivo({
  marcadores,
  selecionadaId,
  idsDestacados,
  onSelecionar,
  sede = SEDE_VERTIX,
}: Props) {
  const semMovimento = useReducedMotion()
  const [sobre, setSobre] = useState<string | null>(null)

  const pontos = useMemo(
    () =>
      marcadores
        .map((m) => ({ ...m, ponto: projetarNoMapa(m.lat, m.lng) }))
        .filter((m) => m.ponto.dentro)
        // Quem importa mais é desenhado por último (fica por cima).
        .sort((a, b) => ORDEM[a.tipo] - ORDEM[b.tipo]),
    [marcadores]
  )
  const pontoDaSede = projetarNoMapa(sede.lat, sede.lng)
  const arcos = pontos.filter((m) => m.tipo !== 'passado')
  const agora = pontos.filter((m) => m.tipo === 'agora').length
  const pedidos = pontos.filter((m) => m.tipo === 'pedido').length
  const marcadorSobre = pontos.find((m) => m.id === sobre) ?? null

  return (
    <div
      className="relative w-full overflow-hidden rounded-2xl border border-white/5 bg-[#0A0A0C]"
      style={{ aspectRatio: `${LARGURA_MAPA} / ${ALTURA_MAPA}` }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_45%,rgba(108,91,242,0.10),transparent_60%)]"
      />
      <img
        src="/ao-vivo/mapa.svg"
        alt=""
        draggable={false}
        className="pointer-events-none absolute inset-0 h-full w-full select-none [mask-image:linear-gradient(to_bottom,transparent,white_8%,white_92%,transparent)]"
      />

      <svg
        viewBox={`0 0 ${LARGURA_MAPA} ${ALTURA_MAPA}`}
        className="absolute inset-0 h-full w-full"
        role="img"
        aria-label={`Mapa das visitas: ${agora} na página agora, ${pedidos} pedidos`}
      >
        <defs>
          <linearGradient id="arco-agora" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={COR.agora} stopOpacity="0" />
            <stop offset="12%" stopColor={COR.agora} stopOpacity="0.9" />
            <stop offset="88%" stopColor={COR.agora} stopOpacity="0.9" />
            <stop offset="100%" stopColor={COR.agora} stopOpacity="0" />
          </linearGradient>
          <linearGradient id="arco-pedido" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={COR.pedido} stopOpacity="0" />
            <stop offset="12%" stopColor={COR.pedido} stopOpacity="0.95" />
            <stop offset="88%" stopColor={COR.pedido} stopOpacity="0.95" />
            <stop offset="100%" stopColor={COR.pedido} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Arcos: da visita até a sede. Entram desenhando-se, como no modelo. */}
        <g fill="none" strokeWidth="0.32" pointerEvents="none" data-testid="arcos">
          {arcos.map((m, i) => (
            <motion.path
              key={m.id}
              d={caminhoDoArco(m.ponto, pontoDaSede)}
              stroke={`url(#arco-${m.tipo === 'pedido' ? 'pedido' : 'agora'})`}
              initial={semMovimento ? false : { pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 1.1, delay: Math.min(i, 8) * 0.12, ease: 'easeOut' }}
            />
          ))}
        </g>

        {/* A sede: um anel discreto onde os arcos chegam. */}
        <g pointerEvents="none">
          <circle cx={pontoDaSede.x} cy={pontoDaSede.y} r="0.7" fill="#ffffff" fillOpacity="0.9" />
          <circle
            cx={pontoDaSede.x}
            cy={pontoDaSede.y}
            r="1.8"
            fill="none"
            stroke="#ffffff"
            strokeOpacity="0.35"
            strokeWidth="0.18"
          />
          <title>{sede.nome}</title>
        </g>

        {pontos.map((m) => {
          const cor = COR[m.tipo]
          const selecionado = m.id === selecionadaId
          const destacado = idsDestacados.has(m.id) || m.id === sobre
          const pulsa = m.tipo !== 'passado' && !semMovimento
          return (
            <g
              key={m.id}
              role="button"
              tabIndex={0}
              aria-label={m.rotulo}
              data-tipo={m.tipo}
              className="cursor-pointer outline-none"
              onClick={() => onSelecionar(m.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onSelecionar(m.id)
                }
              }}
              onPointerEnter={() => setSobre(m.id)}
              onPointerLeave={() => setSobre((atual) => (atual === m.id ? null : atual))}
              onFocus={() => setSobre(m.id)}
              onBlur={() => setSobre((atual) => (atual === m.id ? null : atual))}
            >
              {/* Área de toque generosa e invisível. */}
              <circle cx={m.ponto.x} cy={m.ponto.y} r="2.6" fill="transparent" />
              {(selecionado || destacado) && (
                <circle
                  cx={m.ponto.x}
                  cy={m.ponto.y}
                  r="2.1"
                  fill="none"
                  stroke={selecionado ? '#ffffff' : cor}
                  strokeOpacity={selecionado ? 0.9 : 0.7}
                  strokeWidth="0.22"
                />
              )}
              {pulsa && (
                <circle cx={m.ponto.x} cy={m.ponto.y} r="0.9" fill={cor} opacity="0.5">
                  <animate
                    attributeName="r"
                    from="0.9"
                    to="3.6"
                    dur="1.6s"
                    begin={`${-(m.semente * 1.6).toFixed(2)}s`}
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="opacity"
                    from="0.5"
                    to="0"
                    dur="1.6s"
                    begin={`${-(m.semente * 1.6).toFixed(2)}s`}
                    repeatCount="indefinite"
                  />
                </circle>
              )}
              <circle
                cx={m.ponto.x}
                cy={m.ponto.y}
                r={m.tipo === 'passado' ? 0.55 : 0.9}
                fill={cor}
                fillOpacity={m.tipo === 'passado' ? 0.55 : 1}
              />
            </g>
          )
        })}
      </svg>

      {marcadorSobre && (
        <div
          role="tooltip"
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[calc(100%+10px)] whitespace-nowrap rounded-lg border border-white/10 bg-[#101018]/95 px-2.5 py-1.5 text-xs text-ink shadow-lg backdrop-blur"
          style={{
            left: `${(marcadorSobre.ponto.x / LARGURA_MAPA) * 100}%`,
            top: `${(marcadorSobre.ponto.y / ALTURA_MAPA) * 100}%`,
          }}
        >
          <span
            aria-hidden
            className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle"
            style={{ backgroundColor: COR[marcadorSobre.tipo] }}
          />
          {marcadorSobre.rotulo}
        </div>
      )}

      <ul
        aria-label="Legenda"
        className="absolute bottom-3 right-3 flex list-none gap-2 p-0 text-[11px] font-medium text-muted"
      >
        <li className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-[#0A0A0C]/80 px-2.5 py-1 backdrop-blur">
          <span
            aria-hidden
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: COR.pedido }}
          />
          Pedidos
        </li>
        <li className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-[#0A0A0C]/80 px-2.5 py-1 backdrop-blur">
          <span
            aria-hidden
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: COR.agora }}
          />
          Visitantes agora
        </li>
      </ul>
    </div>
  )
}
