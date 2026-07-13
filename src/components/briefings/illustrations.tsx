import type { JSX, ReactNode, SVGProps } from 'react'
import type { BriefingIlustracao } from '../../lib/briefing'

/**
 * Catálogo de ilustrações das perguntas visuais do briefing. Cobertura total
 * de BRIEFING_ILUSTRACOES é garantida pelo Record — adicionar chave nova no
 * schema exige adicionar o SVG aqui (erro de compilação caso contrário).
 *
 * Linguagem visual compartilhada: fundo surface-2 com cantos arredondados,
 * traço fino branco (10–30%), preenchimentos accent (10–40%) e detalhes em
 * accent-2. Sem texto renderizado — apenas <title> acessível (aria-hidden).
 */

type IllustrationComponent = (props: SVGProps<SVGSVGElement>) => JSX.Element

interface CanvasProps extends SVGProps<SVGSVGElement> {
  title: string
  children?: ReactNode
}

/** Moldura comum 120×80: fundo surface-2, borda sutil, cantos arredondados. */
function Canvas({ title, children, ...props }: CanvasProps) {
  return (
    <svg viewBox="0 0 120 80" fill="none" aria-hidden="true" {...props}>
      <title>{title}</title>
      <rect
        x="1"
        y="1"
        width="118"
        height="78"
        rx="12"
        className="fill-surface-2 stroke-white/10"
        strokeWidth="1"
      />
      {children}
    </svg>
  )
}

function Loja(props: SVGProps<SVGSVGElement>) {
  return (
    <Canvas title="Loja online" {...props}>
      {/* Toldo com babados */}
      <path
        d="M24 16h72v8a6 6 0 0 1-12 0 6 6 0 0 1-12 0 6 6 0 0 1-12 0 6 6 0 0 1-12 0 6 6 0 0 1-12 0 6 6 0 0 1-12 0z"
        className="fill-accent/30 stroke-white/25"
        strokeWidth="1"
        strokeLinejoin="round"
      />
      {/* Fachada */}
      <rect x="28" y="30" width="64" height="32" rx="2" className="fill-white/5 stroke-white/25" strokeWidth="1.5" />
      {/* Porta */}
      <rect x="36" y="42" width="13" height="20" rx="2" className="fill-accent/20 stroke-white/20" strokeWidth="1" />
      {/* Vitrine */}
      <rect x="57" y="42" width="26" height="12" rx="2" className="fill-accent/10 stroke-white/20" strokeWidth="1" />
      <circle cx="64" cy="48" r="2.5" className="fill-accent-2/50" />
      {/* Calçada */}
      <line x1="16" y1="64" x2="104" y2="64" className="stroke-white/15" strokeWidth="1.5" strokeLinecap="round" />
    </Canvas>
  )
}

function Catalogo(props: SVGProps<SVGSVGElement>) {
  const cols = [20, 47, 74]
  const rows = [14, 42]
  return (
    <Canvas title="Catálogo de produtos" {...props}>
      {rows.map((y) =>
        cols.map((x) => {
          const destaque = x === 47 && y === 14
          return (
            <g key={`${x}-${y}`}>
              <rect
                x={x}
                y={y}
                width="26"
                height="22"
                rx="3"
                className={
                  destaque
                    ? 'fill-accent/20 stroke-accent/60'
                    : 'fill-white/5 stroke-white/15'
                }
                strokeWidth="1"
              />
              <circle
                cx={x + 13}
                cy={y + 8}
                r="4"
                className={destaque ? 'fill-accent/50' : 'fill-white/15'}
              />
              <rect x={x + 6} y={y + 16} width="14" height="2.5" rx="1.25" className="fill-white/10" />
            </g>
          )
        })
      )}
    </Canvas>
  )
}

function Pagamento(props: SVGProps<SVGSVGElement>) {
  return (
    <Canvas title="Pagamento — cartão e Pix" {...props}>
      {/* Cartão */}
      <rect x="16" y="18" width="58" height="38" rx="5" className="fill-accent/15 stroke-white/25" strokeWidth="1.5" />
      <rect x="16" y="26" width="58" height="6" className="fill-white/10" />
      <rect x="22" y="38" width="10" height="7" rx="1.5" className="fill-accent/40" />
      <rect x="22" y="49" width="20" height="2.5" rx="1.25" className="fill-white/15" />
      {/* Losango Pix */}
      <path
        d="M88 30 105 47 88 64 71 47Z"
        className="fill-accent-2/15 stroke-accent-2/70"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M88 40 95 47 88 54 81 47Z" className="fill-accent-2/50" />
    </Canvas>
  )
}

function Entrega(props: SVGProps<SVGSVGElement>) {
  return (
    <Canvas title="Entrega" {...props}>
      {/* Baú */}
      <rect x="18" y="28" width="46" height="24" rx="3" className="fill-accent/15 stroke-white/25" strokeWidth="1.5" />
      {/* Pacote dentro do baú */}
      <rect x="32" y="34" width="13" height="13" rx="2" className="fill-accent/40" />
      <line x1="38.5" y1="34" x2="38.5" y2="47" className="stroke-white/25" strokeWidth="1" />
      {/* Cabine */}
      <path d="M64 34h12l9 10v8H64z" className="fill-white/5 stroke-white/25" strokeWidth="1.5" strokeLinejoin="round" />
      {/* Rodas */}
      <circle cx="32" cy="55" r="6" className="fill-bg stroke-white/30" strokeWidth="2" />
      <circle cx="78" cy="55" r="6" className="fill-bg stroke-white/30" strokeWidth="2" />
      <circle cx="32" cy="55" r="1.8" className="fill-white/20" />
      <circle cx="78" cy="55" r="1.8" className="fill-white/20" />
      {/* Movimento */}
      <line x1="6" y1="34" x2="13" y2="34" className="stroke-accent/50" strokeWidth="2" strokeLinecap="round" />
      <line x1="4" y1="42" x2="12" y2="42" className="stroke-accent/50" strokeWidth="2" strokeLinecap="round" />
      <line x1="6" y1="50" x2="13" y2="50" className="stroke-accent/50" strokeWidth="2" strokeLinecap="round" />
      <line x1="16" y1="64" x2="104" y2="64" className="stroke-white/10" strokeWidth="1.5" strokeLinecap="round" />
    </Canvas>
  )
}

function IdentidadeVisual(props: SVGProps<SVGSVGElement>) {
  return (
    <Canvas title="Identidade visual" {...props}>
      {/* Amostras de cor em leque */}
      <g transform="rotate(-10 34 40)">
        <rect x="24" y="24" width="20" height="30" rx="4" className="fill-accent/40" />
      </g>
      <g transform="rotate(2 48 40)">
        <rect x="38" y="22" width="20" height="30" rx="4" className="fill-accent-2/40 stroke-white/10" strokeWidth="1" />
      </g>
      <g transform="rotate(14 62 42)">
        <rect x="52" y="24" width="20" height="30" rx="4" className="fill-white/10 stroke-white/20" strokeWidth="1" />
      </g>
      {/* Pincel */}
      <line x1="80" y1="60" x2="100" y2="28" className="stroke-white/30" strokeWidth="3" strokeLinecap="round" />
      <path d="M98 20l7 6-9 5z" className="fill-accent-2/70" />
      {/* Respingo */}
      <circle cx="86" cy="66" r="2.5" className="fill-accent/50" />
    </Canvas>
  )
}

function EstiloMinimalista(props: SVGProps<SVGSVGElement>) {
  return (
    <Canvas title="Layout minimalista" {...props}>
      <rect x="16" y="12" width="88" height="56" rx="6" className="stroke-white/15" strokeWidth="1" />
      <rect x="26" y="24" width="34" height="4" rx="2" className="fill-white/30" />
      <rect x="26" y="32" width="22" height="2.5" rx="1.25" className="fill-white/10" />
      <rect x="26" y="52" width="18" height="7" rx="3.5" className="fill-accent/30 stroke-accent/40" strokeWidth="1" />
    </Canvas>
  )
}

function EstiloVibrante(props: SVGProps<SVGSVGElement>) {
  return (
    <Canvas title="Layout vibrante" {...props}>
      <rect x="14" y="12" width="44" height="26" rx="5" className="fill-accent/40" />
      <rect x="62" y="12" width="44" height="12" rx="4" className="fill-accent-2/50" />
      <rect x="62" y="28" width="20" height="10" rx="3" className="fill-accent/25" />
      <rect x="86" y="28" width="20" height="10" rx="3" className="fill-white/15" />
      <rect x="14" y="42" width="20" height="26" rx="4" className="fill-accent-2/30" />
      <rect x="38" y="42" width="44" height="26" rx="5" className="fill-accent/15 stroke-accent/50" strokeWidth="1" />
      <rect x="86" y="42" width="20" height="26" rx="4" className="fill-accent/50" />
    </Canvas>
  )
}

function EstiloPremium(props: SVGProps<SVGSVGElement>) {
  return (
    <Canvas title="Layout escuro elegante" {...props}>
      <rect x="14" y="10" width="92" height="60" rx="6" className="fill-black/50 stroke-white/25" strokeWidth="1" />
      <rect x="21" y="17" width="78" height="46" rx="3" className="stroke-white/15" strokeWidth="1" />
      <path d="M60 30l7 9-7 9-7-9z" className="fill-accent/25 stroke-accent/70" strokeWidth="1.2" strokeLinejoin="round" />
      <circle cx="44" cy="39" r="1.5" className="fill-accent-2/50" />
      <circle cx="76" cy="39" r="1.5" className="fill-accent-2/50" />
      <rect x="46" y="52" width="28" height="2" rx="1" className="fill-white/25" />
      <rect x="53" y="57" width="14" height="1.5" rx="0.75" className="fill-white/10" />
    </Canvas>
  )
}

function Automacao(props: SVGProps<SVGSVGElement>) {
  return (
    <Canvas title="Automação" {...props}>
      {/* Engrenagem maior (dentes via traço tracejado) */}
      <circle cx="46" cy="40" r="13" className="stroke-white/30" strokeWidth="5" strokeDasharray="5.1 5.11" />
      <circle cx="46" cy="40" r="9.5" className="stroke-white/25" strokeWidth="1.5" />
      <circle cx="46" cy="40" r="3.5" className="fill-accent/50" />
      {/* Engrenagem menor */}
      <circle cx="80" cy="54" r="8" className="stroke-accent-2/60" strokeWidth="4" strokeDasharray="4.2 4.18" />
      <circle cx="80" cy="54" r="2.5" className="fill-accent-2/50" />
      {/* Fluxo */}
      <path
        d="M60 22q20-8 36 10"
        className="stroke-accent/50"
        strokeWidth="1.5"
        strokeDasharray="3 4"
        strokeLinecap="round"
      />
    </Canvas>
  )
}

function Usuarios(props: SVGProps<SVGSVGElement>) {
  return (
    <Canvas title="Usuários" {...props}>
      {/* Avatares laterais */}
      <circle cx="30" cy="38" r="6" className="fill-white/10 stroke-white/20" strokeWidth="1" />
      <path d="M19 60a11 11 0 0 1 22 0" className="fill-white/5 stroke-white/20" strokeWidth="1" />
      <circle cx="90" cy="38" r="6" className="fill-white/10 stroke-white/20" strokeWidth="1" />
      <path d="M79 60a11 11 0 0 1 22 0" className="fill-white/5 stroke-white/20" strokeWidth="1" />
      {/* Avatar central em destaque */}
      <circle cx="60" cy="32" r="9" className="fill-accent/30 stroke-white/25" strokeWidth="1.5" />
      <path d="M44 60a16 16 0 0 1 32 0" className="fill-accent/20 stroke-white/25" strokeWidth="1.5" />
    </Canvas>
  )
}

function Integracoes(props: SVGProps<SVGSVGElement>) {
  const satelites: Array<[number, number]> = [
    [22, 18],
    [98, 18],
    [22, 62],
    [98, 62],
  ]
  return (
    <Canvas title="Integrações" {...props}>
      {satelites.map(([x, y]) => (
        <g key={`${x}-${y}`}>
          <line x1="60" y1="40" x2={x} y2={y} className="stroke-white/15" strokeWidth="1" />
          <circle cx={(60 + x) / 2} cy={(40 + y) / 2} r="1.6" className="fill-accent-2/60" />
        </g>
      ))}
      <rect x="51" y="31" width="18" height="18" rx="5" className="fill-accent/40 stroke-white/25" strokeWidth="1.5" />
      {satelites.map(([x, y]) => (
        <circle
          key={`n-${x}-${y}`}
          cx={x}
          cy={y}
          r="5.5"
          className="fill-surface-2 stroke-accent-2/60"
          strokeWidth="1.5"
        />
      ))}
    </Canvas>
  )
}

function SitePaginas(props: SVGProps<SVGSVGElement>) {
  return (
    <Canvas title="Páginas do site" {...props}>
      {/* Páginas empilhadas atrás */}
      <rect x="30" y="10" width="76" height="48" rx="5" className="fill-white/5 stroke-white/10" strokeWidth="1" />
      <rect x="22" y="16" width="76" height="48" rx="5" className="fill-surface-2 stroke-white/15" strokeWidth="1" />
      {/* Janela do navegador */}
      <rect x="14" y="22" width="76" height="48" rx="5" className="fill-surface-2 stroke-white/25" strokeWidth="1.5" />
      <line x1="14" y1="32" x2="90" y2="32" className="stroke-white/15" strokeWidth="1" />
      <circle cx="21" cy="27" r="1.8" className="fill-accent/60" />
      <circle cx="27" cy="27" r="1.8" className="fill-white/20" />
      <circle cx="33" cy="27" r="1.8" className="fill-white/20" />
      {/* Conteúdo */}
      <rect x="22" y="38" width="28" height="3" rx="1.5" className="fill-white/20" />
      <rect x="22" y="45" width="44" height="2.5" rx="1.25" className="fill-white/10" />
      <rect x="22" y="51" width="36" height="2.5" rx="1.25" className="fill-white/10" />
      <rect x="22" y="58" width="14" height="5" rx="2" className="fill-accent/30" />
    </Canvas>
  )
}

function Conteudo(props: SVGProps<SVGSVGElement>) {
  return (
    <Canvas title="Conteúdo — texto e foto" {...props}>
      {/* Documento */}
      <rect x="22" y="12" width="44" height="56" rx="4" className="fill-white/5 stroke-white/25" strokeWidth="1.5" />
      <rect x="28" y="20" width="32" height="2.5" rx="1.25" className="fill-white/15" />
      <rect x="28" y="26" width="26" height="2.5" rx="1.25" className="fill-white/15" />
      <rect x="28" y="32" width="20" height="2.5" rx="1.25" className="fill-white/10" />
      {/* Cartão de foto sobreposto */}
      <rect x="56" y="30" width="42" height="32" rx="4" className="fill-surface-2 stroke-accent/50" strokeWidth="1.5" />
      <circle cx="66" cy="39" r="3" className="fill-accent-2/60" />
      <path
        d="M58 56l10-10 7 7 6-6 9 9v2a2 2 0 0 1-2 2H60a2 2 0 0 1-2-2z"
        className="fill-accent/30"
      />
    </Canvas>
  )
}

function Agendamento(props: SVGProps<SVGSVGElement>) {
  const cols = [42, 56, 70, 84]
  const rows = [38, 47, 56]
  return (
    <Canvas title="Agendamento" {...props}>
      <rect x="28" y="18" width="64" height="48" rx="6" className="fill-white/5 stroke-white/25" strokeWidth="1.5" />
      <path d="M28 30v-6a6 6 0 0 1 6-6h52a6 6 0 0 1 6 6v6z" className="fill-accent/25" />
      <line x1="42" y1="13" x2="42" y2="22" className="stroke-white/40" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="78" y1="13" x2="78" y2="22" className="stroke-white/40" strokeWidth="2.5" strokeLinecap="round" />
      {rows.map((y) =>
        cols.map((x) => {
          if (x === 70 && y === 47) return null
          return <circle key={`${x}-${y}`} cx={x} cy={y} r="1.8" className="fill-white/20" />
        })
      )}
      {/* Data destacada */}
      <circle cx="70" cy="47" r="5.5" className="fill-accent/50" />
    </Canvas>
  )
}

function Metas(props: SVGProps<SVGSVGElement>) {
  return (
    <Canvas title="Metas — crescimento e alvo" {...props}>
      <line x1="16" y1="66" x2="104" y2="66" className="stroke-white/15" strokeWidth="1.5" strokeLinecap="round" />
      <rect x="24" y="54" width="11" height="12" rx="2" className="fill-accent/15" />
      <rect x="40" y="46" width="11" height="20" rx="2" className="fill-accent/25" />
      <rect x="56" y="36" width="11" height="30" rx="2" className="fill-accent/40" />
      <path
        d="M26 50 46 42 62 32 84 24"
        className="stroke-accent-2/70"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Alvo */}
      <circle cx="88" cy="22" r="7.5" className="stroke-accent-2/60" strokeWidth="1.5" />
      <circle cx="88" cy="22" r="2.8" className="fill-accent-2/70" />
    </Canvas>
  )
}

export const BRIEFING_ILLUSTRATIONS: Record<
  BriefingIlustracao,
  IllustrationComponent
> = {
  loja: Loja,
  catalogo: Catalogo,
  pagamento: Pagamento,
  entrega: Entrega,
  identidade_visual: IdentidadeVisual,
  estilo_minimalista: EstiloMinimalista,
  estilo_vibrante: EstiloVibrante,
  estilo_premium: EstiloPremium,
  automacao: Automacao,
  usuarios: Usuarios,
  integracoes: Integracoes,
  site_paginas: SitePaginas,
  conteudo: Conteudo,
  agendamento: Agendamento,
  metas: Metas,
}
