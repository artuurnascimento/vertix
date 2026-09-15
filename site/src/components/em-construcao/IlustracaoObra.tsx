import type { CSSProperties, ReactNode } from 'react'

/**
 * Ilustração isométrica animada da página "em construção": a janela do site
 * sendo montada por um guindaste, com cards flutuando, cones, barreira e um
 * servidor ao redor. Tudo é SVG puro projetado em isométrico (funções `iso`
 * e `plano*`); o movimento é CSS (em-construcao.css) e respeita
 * prefers-reduced-motion.
 */

const C = 0.8660254
const OX = 380
const OY = 150

type Ponto = readonly [number, number]

/** Projeta um ponto do mundo (x → direita-baixo, y → esquerda-baixo, z → cima). */
const iso = (x: number, y: number, z: number): Ponto => [
  (x - y) * C + OX,
  (x + y) * 0.5 - z + OY,
]

const pts = (...ps: Ponto[]) =>
  ps.map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join(' ')

const fmt = (n: number) => n.toFixed(2)

/** Leva coordenadas 2D locais (u → direita, v → baixo) ao plano da face frontal (y fixo). */
const planoFrente = (x: number, y: number, zTopo: number) => {
  const [sx, sy] = iso(x, y, zTopo)
  return `matrix(${fmt(C)} 0.5 0 1 ${fmt(sx)} ${fmt(sy)})`
}

/** Idem para a face lateral (x fixo). */
const planoLado = (x: number, y: number, zTopo: number) => {
  const [sx, sy] = iso(x, y, zTopo)
  return `matrix(${fmt(-C)} 0.5 0 1 ${fmt(sx)} ${fmt(sy)})`
}

/** Idem para o plano do chão / topo (z fixo). */
const planoTopo = (x: number, y: number, z: number) => {
  const [sx, sy] = iso(x, y, z)
  return `matrix(${fmt(C)} 0.5 ${fmt(-C)} 0.5 ${fmt(sx)} ${fmt(sy)})`
}

const COR = {
  topo: '#2B2842',
  frente: '#1B1929',
  lado: '#120F1E',
  painel: '#100E1B',
  linha: '#2A2740',
  acento: '#6C5BF2',
  acentoClaro: '#9B8CFF',
  acentoEscuro: '#3B2F8F',
  tinta: '#F4F4F0',
}

interface CaixaProps {
  x: number
  y: number
  z: number
  w: number
  d: number
  h: number
  topo?: string
  frente?: string
  lado?: string
  borda?: string
  className?: string
  style?: CSSProperties
  children?: ReactNode
}

/** Paralelepípedo isométrico: lateral (x+w), frente (y+d) e topo (z+h). */
function Caixa({
  x,
  y,
  z,
  w,
  d,
  h,
  topo = COR.topo,
  frente = COR.frente,
  lado = COR.lado,
  borda,
  className,
  style,
  children,
}: CaixaProps) {
  const faceLado = pts(
    iso(x + w, y, z),
    iso(x + w, y + d, z),
    iso(x + w, y + d, z + h),
    iso(x + w, y, z + h),
  )
  const faceFrente = pts(
    iso(x, y + d, z),
    iso(x + w, y + d, z),
    iso(x + w, y + d, z + h),
    iso(x, y + d, z + h),
  )
  const faceTopo = pts(
    iso(x, y, z + h),
    iso(x + w, y, z + h),
    iso(x + w, y + d, z + h),
    iso(x, y + d, z + h),
  )
  return (
    <g className={className} style={style}>
      <polygon points={faceLado} fill={lado} />
      <polygon points={faceFrente} fill={frente} />
      <polygon points={faceTopo} fill={topo} />
      {borda && (
        <g fill="none" stroke={borda} strokeWidth="1" strokeLinejoin="round">
          <polygon points={faceTopo} />
          <polygon points={faceFrente} />
          <polygon points={faceLado} />
        </g>
      )}
      {children}
    </g>
  )
}

/** Cone de sinalização apoiado no chão em (x, y). */
function Cone({ x, y }: { x: number; y: number }) {
  const [sx, sy] = iso(x, y, 0)
  const alt = 34
  const base = 11
  const larg = (t: number) => base * (1 - t)
  const faixa = (t1: number, t2: number) =>
    pts(
      [-larg(t1), -2 - (alt - 2) * t1],
      [larg(t1), -2 - (alt - 2) * t1],
      [larg(t2), -2 - (alt - 2) * t2],
      [-larg(t2), -2 - (alt - 2) * t2],
    )
  return (
    <g transform={`translate(${fmt(sx)} ${fmt(sy)})`}>
      <ellipse cx="0" cy="0" rx="16" ry="7.5" fill="#0A0912" />
      <ellipse cx="0" cy="-1" rx="14" ry="6.5" fill="#1F1C33" />
      <ellipse cx="0" cy="-2" rx={base} ry="4" fill="#221F38" />
      <polygon points={pts([-base, -2], [0, -alt], [base, -2])} fill="#262242" />
      <polygon points={faixa(0.26, 0.42)} fill={COR.acento} />
      <polygon points={faixa(0.58, 0.7)} fill={COR.acentoClaro} />
      <polygon
        points={pts([-base, -2], [0, -alt], [0, -2])}
        fill="#000"
        opacity="0.22"
      />
    </g>
  )
}

/** Zig-zag de treliça numa face de largura `w` e altura `h`. */
function trelicaVertical(w: number, h: number, passo: number) {
  let d = 'M0 0'
  for (let v = 0; v < h; v += passo) {
    d += ` L${w} ${Math.min(v + passo / 2, h)} L0 ${Math.min(v + passo, h)}`
  }
  return d
}

function trelicaHorizontal(w: number, h: number, passo: number) {
  let d = `M0 ${h}`
  for (let u = 0; u < w; u += passo) {
    d += ` L${Math.min(u + passo / 2, w)} 0 L${Math.min(u + passo, w)} ${h}`
  }
  return d
}

const PARTICULAS: ReadonlyArray<{ cx: number; cy: number; r: number; atraso: number }> = [
  { cx: 318, cy: 236, r: 2, atraso: 0 },
  { cx: 612, cy: 300, r: 1.6, atraso: 1.3 },
  { cx: 416, cy: 74, r: 1.4, atraso: 2.6 },
  { cx: 632, cy: 440, r: 2.2, atraso: 0.8 },
  { cx: 296, cy: 128, r: 1.5, atraso: 3.4 },
  { cx: 512, cy: 452, r: 1.8, atraso: 4.2 },
  { cx: 252, cy: 342, r: 1.6, atraso: 1.9 },
  { cx: 700, cy: 232, r: 1.4, atraso: 3.0 },
]

// Guindaste: a lança fica em z 196–208; o cabo sai do fundo dela (z 196).
const TROLLEY_X = 250
const BLOCO_Z = 150
const BLOCO_H = 24
const CABO_DESCIDA = 28
const [caboX, caboTopoY] = iso(TROLLEY_X + 11, 52, 196)
const [, caboFimY] = iso(TROLLEY_X + 11, 52, BLOCO_Z + BLOCO_H)
const CABO_L = caboFimY - caboTopoY

const GRADE = Array.from({ length: 14 }, (_, i) => -80 + i * 40)

interface IlustracaoObraProps {
  className?: string
}

export default function IlustracaoObra({ className }: IlustracaoObraProps) {
  const [luzX, luzY] = iso(397, 52, 212)

  return (
    <svg
      viewBox="212 0 532 460"
      className={className}
      role="img"
      aria-label="Janela de site sendo montada por um guindaste, cercada de cones e barreira de obra"
    >
      <defs>
        <radialGradient id="ec-brilho-fundo" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={COR.acento} stopOpacity="0.42" />
          <stop offset="55%" stopColor={COR.acento} stopOpacity="0.12" />
          <stop offset="100%" stopColor={COR.acento} stopOpacity="0" />
        </radialGradient>
        <radialGradient id="ec-fade-piso" cx="460" cy="330" r="330" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fff" />
          <stop offset="70%" stopColor="#fff" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <mask id="ec-mascara-piso">
          <rect width="760" height="520" fill="url(#ec-fade-piso)" />
        </mask>
        <pattern
          id="ec-listras"
          width="14"
          height="14"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(-45)"
        >
          <rect width="7" height="14" fill={COR.acento} />
        </pattern>
        <linearGradient id="ec-shimmer" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0.35" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <filter id="ec-neon" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="ec-desfoque" x="-30%" y="-60%" width="160%" height="220%">
          <feGaussianBlur stdDeviation="9" />
        </filter>
        <clipPath id="ec-clip-linhas">
          <rect x="30" y="148" width="120" height="6" rx="3" />
          <rect x="30" y="162" width="190" height="6" rx="3" />
          <rect x="30" y="176" width="90" height="6" rx="3" />
        </clipPath>
      </defs>

      {/* Brilho atrás da cena */}
      <ellipse
        className="ec-glow"
        cx="470"
        cy="240"
        rx="290"
        ry="210"
        fill="url(#ec-brilho-fundo)"
      />

      {/* Piso em grade isométrica */}
      <g mask="url(#ec-mascara-piso)" stroke={COR.acento} strokeOpacity="0.14" strokeWidth="1">
        {GRADE.map((i) => (
          <line key={`gx${i}`} x1={iso(i, -80, 0)[0]} y1={iso(i, -80, 0)[1]} x2={iso(i, 440, 0)[0]} y2={iso(i, 440, 0)[1]} />
        ))}
        {GRADE.map((i) => (
          <line key={`gy${i}`} x1={iso(-80, i, 0)[0]} y1={iso(-80, i, 0)[1]} x2={iso(440, i, 0)[0]} y2={iso(440, i, 0)[1]} />
        ))}
      </g>

      {/* Linhas de dados correndo pelo chão */}
      <g
        fill="none"
        stroke={COR.acentoClaro}
        strokeWidth="1.5"
        strokeOpacity="0.55"
        strokeDasharray="6 18"
        strokeLinecap="round"
        className="ec-dash"
      >
        <polyline points={pts(iso(300, 212, 0), iso(220, 212, 0), iso(220, 132, 0))} />
        <polyline points={pts(iso(-20, 176, 0), iso(-20, 132, 0), iso(70, 132, 0))} />
        <polyline points={pts(iso(410, 90, 0), iso(410, 132, 0), iso(372, 132, 0))} />
      </g>

      {/* Card flutuante à esquerda (atrás) */}
      <g transform={planoTopo(0, 0, 0)}>
        <ellipse className="ec-sombra" cx="-20" cy="94" rx="46" ry="16" fill="#000" opacity="0.5" filter="url(#ec-desfoque)" />
      </g>
      <g className="ec-float">
        <Caixa x={-60} y={90} z={30} w={80} d={8} h={56} frente={COR.painel} borda="rgba(108,91,242,0.45)">
          <g transform={planoFrente(-60, 98, 86)}>
            <rect width="80" height="10" fill="#17142A" />
            <circle cx="6" cy="5" r="1.6" fill={COR.acento} />
            <circle cx="11" cy="5" r="1.6" fill="#3A3750" />
            <rect x="8" y="20" width="44" height="4" rx="2" fill={COR.linha} />
            <rect x="8" y="30" width="60" height="4" rx="2" fill={COR.linha} />
            <rect x="8" y="40" width="30" height="4" rx="2" fill={COR.acentoEscuro} />
          </g>
        </Caixa>
      </g>

      {/* Guindaste (atrás da janela) */}
      <Caixa x={370} y={25} z={0} w={55} d={55} h={10} borda="rgba(108,91,242,0.25)" />
      <Caixa x={382} y={37} z={10} w={30} d={30} h={186} frente="#161326" lado="#0E0B19">
        <g transform={planoFrente(382, 67, 196)} fill="none" stroke={COR.acentoEscuro} strokeWidth="1.2">
          <path d={trelicaVertical(30, 186, 26)} />
          <line x1="0" y1="0" x2="0" y2="186" stroke={COR.acento} strokeOpacity="0.5" />
        </g>
        <g transform={planoLado(412, 37, 196)} fill="none" stroke={COR.acentoEscuro} strokeWidth="1.2">
          <path d={trelicaVertical(30, 186, 26)} />
        </g>
      </Caixa>

      {/* Cabo + bloco içado (move junto com o carrinho) */}
      <g className="ec-trolley">
        <rect
          className="ec-cabo"
          x={caboX - 0.75}
          y={caboTopoY}
          width="1.5"
          height={CABO_L}
          fill="#A9A9A2"
          style={{ '--ec-cabo-fim': ((CABO_L + CABO_DESCIDA) / CABO_L).toFixed(3) } as CSSProperties}
        />
        <g className="ec-bloco">
          <rect x={caboX - 4} y={caboFimY - 5} width="8" height="6" rx="1" fill="#8A8A82" />
          <Caixa
            x={TROLLEY_X - 1}
            y={40}
            z={BLOCO_Z}
            w={24}
            d={24}
            h={BLOCO_H}
            topo={COR.acento}
            frente="#2A2360"
            lado="#1E1A45"
            borda="rgba(155,140,255,0.5)"
          />
        </g>
      </g>

      {/* Lança */}
      <Caixa x={130} y={44} z={196} w={290} d={16} h={12} frente="#161326" lado="#0E0B19">
        <g transform={planoFrente(130, 60, 208)} fill="none" stroke={COR.acentoEscuro} strokeWidth="1.2">
          <path d={trelicaHorizontal(290, 12, 14)} />
          <line x1="0" y1="0" x2="290" y2="0" stroke={COR.acento} strokeOpacity="0.6" />
        </g>
      </Caixa>
      <Caixa x={418} y={40} z={186} w={28} d={24} h={22} topo="#332F4F" frente="#1E1B30" borda="rgba(108,91,242,0.35)" />
      <Caixa x={412} y={48} z={208} w={14} d={14} h={12} topo={COR.acentoEscuro} frente="#1E1B30" />
      <circle className="ec-luz" cx={luzX} cy={luzY} r="2.6" fill={COR.acentoClaro} filter="url(#ec-neon)" />

      {/* Carrinho sobre a lança */}
      <g className="ec-trolley">
        <Caixa x={TROLLEY_X} y={46} z={208} w={22} d={12} h={8} topo="#4A3DB8" frente="#2A2360" lado="#1E1A45" />
      </g>

      {/* Sombra + janela principal */}
      <g transform={planoTopo(0, 0, 0)}>
        <ellipse cx="222" cy="136" rx="160" ry="34" fill="#000" opacity="0.55" filter="url(#ec-desfoque)" />
      </g>
      <Caixa x={80} y={110} z={0} w={280} d={14} h={200} frente={COR.painel} lado="#0D0B17" topo="#221F36">
        <g transform={planoFrente(80, 124, 200)}>
          <rect width="280" height="200" fill="none" stroke={COR.acento} strokeWidth="2" strokeOpacity="0.9" filter="url(#ec-neon)" />
          <rect width="280" height="24" fill="#17142A" />
          <line x1="0" y1="24" x2="280" y2="24" stroke={COR.linha} />
          <circle cx="13" cy="12" r="3.5" fill={COR.acento} />
          <circle cx="25" cy="12" r="3.5" fill={COR.acentoClaro} />
          <circle cx="37" cy="12" r="3.5" fill="#3A3750" />

          {/* Símbolo Vertix */}
          <g transform="translate(112 52) scale(0.42)" fill="none" strokeLinejoin="round" strokeLinecap="round">
            <path d="M6 132 L66 14 L126 132" stroke={COR.acento} strokeWidth="26" filter="url(#ec-neon)" />
            <path d="M34 150 L66 88 L98 150" stroke={COR.tinta} strokeWidth="20" opacity="0.85" />
          </g>

          {/* Linhas de conteúdo com brilho passando */}
          <rect x="30" y="148" width="120" height="6" rx="3" fill={COR.linha} />
          <rect x="30" y="162" width="190" height="6" rx="3" fill={COR.linha} />
          <rect x="30" y="176" width="90" height="6" rx="3" fill={COR.linha} />
          <g clipPath="url(#ec-clip-linhas)">
            <rect className="ec-shimmer" x="-40" y="140" width="70" height="60" fill="url(#ec-shimmer)" />
          </g>
          <rect className="ec-pisca" x="124" y="175" width="2" height="8" fill={COR.acentoClaro} />
        </g>
      </Caixa>

      {/* Card flutuante à direita (frente) */}
      <g transform={planoTopo(0, 0, 0)}>
        <ellipse className="ec-sombra-2" cx="410" cy="134" rx="40" ry="14" fill="#000" opacity="0.5" filter="url(#ec-desfoque)" />
      </g>
      <g className="ec-float-2">
        <Caixa x={380} y={130} z={40} w={60} d={6} h={40} frente={COR.painel} borda="rgba(108,91,242,0.45)">
          <g transform={planoFrente(380, 136, 80)}>
            <rect width="60" height="8" fill="#17142A" />
            <circle cx="5" cy="4" r="1.4" fill={COR.acento} />
            <rect x="6" y="15" width="36" height="3.5" rx="1.75" fill={COR.linha} />
            <rect x="6" y="23" width="46" height="3.5" rx="1.75" fill={COR.linha} />
            <rect x="6" y="31" width="22" height="3.5" rx="1.75" fill={COR.acentoEscuro} />
          </g>
        </Caixa>
      </g>

      {/* Barreira listrada (frente-esquerda) */}
      <Caixa x={44} y={158} z={0} w={8} d={10} h={14} />
      <Caixa x={118} y={158} z={0} w={8} d={10} h={14} />
      <Caixa x={40} y={160} z={14} w={90} d={6} h={22} frente="#1E1B30" borda="rgba(108,91,242,0.35)">
        <g transform={planoFrente(40, 166, 36)}>
          <rect x="3" y="3" width="84" height="16" fill="url(#ec-listras)" opacity="0.9" />
        </g>
      </Caixa>

      {/* Servidor (frente-direita) */}
      <Caixa x={300} y={190} z={0} w={44} d={44} h={16} borda="rgba(108,91,242,0.25)" />
      <Caixa x={300} y={190} z={16} w={44} d={44} h={16} topo="#332F4F" borda="rgba(108,91,242,0.25)" />
      <g transform={planoFrente(300, 234, 32)}>
        <circle className="ec-luz" cx="7" cy="8" r="1.8" fill={COR.acentoClaro} />
        <circle cx="12" cy="8" r="1.8" fill="#3A3750" />
        <rect x="20" y="6.5" width="16" height="3" rx="1.5" fill={COR.linha} />
        <circle className="ec-luz" cx="7" cy="24" r="1.8" fill={COR.acentoClaro} style={{ animationDelay: '0.7s' }} />
        <circle cx="12" cy="24" r="1.8" fill="#3A3750" />
        <rect x="20" y="22.5" width="16" height="3" rx="1.5" fill={COR.linha} />
      </g>

      {/* Cones */}
      <Cone x={30} y={200} />
      <Cone x={370} y={170} />
      <Cone x={430} y={90} />

      {/* Partículas subindo */}
      {PARTICULAS.map((p) => (
        <circle
          key={`${p.cx}-${p.cy}`}
          className="ec-particula"
          cx={p.cx}
          cy={p.cy}
          r={p.r}
          fill={COR.acentoClaro}
          style={{ animationDelay: `${p.atraso}s` }}
        />
      ))}
    </svg>
  )
}
