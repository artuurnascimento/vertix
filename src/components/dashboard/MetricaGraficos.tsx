import { useState } from 'react'
import type { CSSProperties, MouseEvent } from 'react'
import { ArrowDown, ArrowUp } from 'lucide-react'
import type { DistribuicaoProjetos, PontoMensal } from './metricas'
import { useContagem } from './useContagem'

/**
 * Os gráficos dos cards do topo — pequenos, sem biblioteca, cada um com um
 * `aria-label` que diz em palavras o que o desenho mostra. Passar o mouse
 * mostra a dica com o dado do mês (ou da fatia) e destaca o elemento.
 */

type Props = { serie: PontoMensal[]; formatar: (n: number) => string }

const descrever = ({ serie, formatar }: Props) =>
  serie.map((m) => `${m.label}: ${formatar(m.total)}`).join('; ')

/**
 * Barras dos últimos meses. `prisma` dá o volume 3D do card de receita;
 * `rotulos` escreve o mês embaixo de cada barra (o card de negociação).
 * Altura mínima de 4% para um mês zerado ainda aparecer como barra. A dica
 * de cada mês fica logo acima da barra (o `--altura` posiciona as duas).
 */
export function Barras({
  serie,
  formatar,
  prisma = false,
  rotulos = false,
}: Props & { prisma?: boolean; rotulos?: boolean }) {
  const maior = Math.max(...serie.map((m) => m.total), 1)
  return (
    <div
      className={`vx-barras${prisma ? ' vx-barras-prisma' : ''}${rotulos ? ' vx-barras-rotuladas' : ''}`}
      role="img"
      aria-label={descrever({ serie, formatar })}
    >
      {serie.map((m) => (
        <span
          key={m.key}
          style={{ '--altura': `${Math.max((m.total / maior) * 100, 4)}%` } as CSSProperties}
        >
          <i />
          {rotulos && <em>{m.label}</em>}
          <b className="vx-dica">
            {m.label} · {formatar(m.total)}
          </b>
        </span>
      ))}
    </div>
  )
}

const LINHA_L = 240
const LINHA_A = 60
const LINHA_MARGEM = 8

/**
 * Linha com um ponto por mês e a área embaixo esfumada. O mouse sobre o
 * gráfico escolhe o mês mais próximo: guia vertical, ponto maior e a dica.
 */
export function Linha({ serie, formatar }: Props) {
  const [ativo, setAtivo] = useState<number | null>(null)
  const maior = Math.max(...serie.map((m) => m.total), 1)
  const passo = (LINHA_L - LINHA_MARGEM * 2) / Math.max(serie.length - 1, 1)
  const pontos = serie.map((m, i) => ({
    x: LINHA_MARGEM + i * passo,
    y: LINHA_A - LINHA_MARGEM - (m.total / maior) * (LINHA_A - LINHA_MARGEM * 2),
  }))
  const caminho = pontos.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y}`).join(' ')
  const area = `${caminho} L${pontos[pontos.length - 1].x} ${LINHA_A} L${pontos[0].x} ${LINHA_A} Z`

  const escolher = (e: MouseEvent<SVGSVGElement>) => {
    const caixa = e.currentTarget.getBoundingClientRect()
    if (caixa.width === 0) return
    const x = ((e.clientX - caixa.left) / caixa.width) * LINHA_L
    const i = Math.round((x - LINHA_MARGEM) / passo)
    setAtivo(Math.min(Math.max(i, 0), serie.length - 1))
  }
  const ponto = ativo === null ? null : pontos[ativo]

  return (
    <div className="vx-linha-caixa" onMouseLeave={() => setAtivo(null)}>
      <svg
        className="vx-linha"
        viewBox={`0 0 ${LINHA_L} ${LINHA_A}`}
        role="img"
        aria-label={descrever({ serie, formatar })}
        onMouseMove={escolher}
      >
        <defs>
          <linearGradient id="vx-linha-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#8f7aff" stopOpacity="0.35" />
            <stop offset="1" stopColor="#8f7aff" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#vx-linha-area)" />
        <path d={caminho} fill="none" stroke="#a48fff" strokeWidth="2" strokeLinejoin="round" />
        {ponto && <line className="vx-linha-guia" x1={ponto.x} x2={ponto.x} y1="0" y2={LINHA_A} />}
        {pontos.map((p, i) => (
          <circle
            key={serie[i].key}
            className={i === ativo ? 'vx-linha-ponto vx-linha-ponto-ativo' : 'vx-linha-ponto'}
            cx={p.x}
            cy={p.y}
            r={i === ativo ? 4.5 : 3}
          />
        ))}
      </svg>
      {ponto && ativo !== null && (
        <b
          className="vx-dica vx-dica-visivel"
          style={{
            left: `${(ponto.x / LINHA_L) * 100}%`,
            bottom: `${(1 - ponto.y / LINHA_A) * 100}%`,
          }}
        >
          {serie[ativo].label} · {formatar(serie[ativo].total)}
        </b>
      )}
    </div>
  )
}

const RAIO = 40
const CIRCUNFERENCIA = 2 * Math.PI * RAIO
/** Vão entre as fatias, em unidades do perímetro. */
const VAO = 6

const FATIAS = [
  { chave: 'andamento', label: 'Em andamento', classe: 'vx-fatia-andamento' },
  { chave: 'revisao', label: 'Em revisão', classe: 'vx-fatia-revisao' },
  { chave: 'concluidos', label: 'Concluídos', classe: 'vx-fatia-concluidos' },
] as const

type Fatia = (typeof FATIAS)[number]['chave']

/**
 * Donut com as três fatias e a legenda ao lado. O número do meio é o de
 * projetos ATIVOS (andamento + revisão); os concluídos aparecem na roda e na
 * legenda, mas não somam nele — é o que "Projetos ativos" promete. Passar o
 * mouse numa fatia (ou no item da legenda) engrossa a fatia, apaga as
 * outras e põe o número dela no centro.
 */
export function Donut({ dados }: { dados: DistribuicaoProjetos }) {
  const [ativa, setAtiva] = useState<Fatia | null>(null)
  const total = dados.andamento + dados.revisao + dados.concluidos
  const ativos = dados.andamento + dados.revisao
  let deslocamento = 0
  const arcos = FATIAS.map((f) => {
    const fracao = total > 0 ? dados[f.chave] / total : 0
    const comprimento = Math.max(fracao * CIRCUNFERENCIA - (fracao > 0 ? VAO : 0), 0)
    const arco = { ...f, comprimento, inicio: deslocamento, valor: dados[f.chave] }
    deslocamento += fracao * CIRCUNFERENCIA
    return arco
  })
  const resumo = arcos.map((a) => `${a.label}: ${a.valor}`).join('; ')
  const destaque = arcos.find((a) => a.chave === ativa) ?? null
  const classeDe = (chave: Fatia, base: string) =>
    `${base}${ativa === null ? '' : ativa === chave ? ' vx-fatia-ativa' : ' vx-fatia-apagada'}`

  return (
    <div
      className="vx-donut"
      role="img"
      aria-label={`${ativos} projetos ativos — ${resumo}`}
      onMouseLeave={() => setAtiva(null)}
    >
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle className="vx-donut-trilho" cx="50" cy="50" r={RAIO} />
        {arcos.map((a) => (
          <circle
            key={a.chave}
            className={classeDe(a.chave, a.classe)}
            cx="50"
            cy="50"
            r={RAIO}
            strokeDasharray={`${a.comprimento} ${CIRCUNFERENCIA - a.comprimento}`}
            strokeDashoffset={-a.inicio}
            onMouseEnter={() => setAtiva(a.chave)}
          />
        ))}
      </svg>
      <div className="vx-donut-centro" data-testid="donut-centro">
        <strong>{destaque ? destaque.valor : <Numero valor={ativos} />}</strong>
        <small>{destaque ? destaque.label : `${dados.revisao} em revisão`}</small>
      </div>
      <ul className="vx-donut-legenda">
        {arcos.map((a) => (
          <li
            key={a.chave}
            className={classeDe(a.chave, a.classe)}
            onMouseEnter={() => setAtiva(a.chave)}
          >
            <i /> <span>{a.label}</span> <b>{a.valor}</b>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** A seta com a variação contra o mês anterior; some sem base de comparação. */
export function Variacao({ valor, tom }: { valor: number | null; tom: 'verde' | 'roxo' | 'ciano' }) {
  if (valor === null) return null
  const Seta = valor < 0 ? ArrowDown : ArrowUp
  return (
    <span className={`vx-variacao vx-variacao-${valor < 0 ? 'queda' : tom}`}>
      <Seta size={14} aria-hidden="true" />
      {Math.abs(valor)}%
      <span className="sr-only">{valor < 0 ? ' a menos' : ' a mais'} que no mês anterior</span>
    </span>
  )
}

const INTEIRO = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 })

/** Número que conta até o valor ao aparecer. */
export function Numero({
  valor,
  formatar = (n) => INTEIRO.format(n),
}: {
  valor: number
  formatar?: (n: number) => string
}) {
  const contado = useContagem(valor)
  return <>{formatar(Math.round(contado))}</>
}

/** "R$" menor que o número, sem centavos — como no mockup. */
export function ValorMoeda({ valor }: { valor: number }) {
  return (
    <>
      <span className="vx-moeda">R$</span> <Numero valor={valor} />
    </>
  )
}
