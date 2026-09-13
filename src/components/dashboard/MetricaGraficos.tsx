import { ArrowDown, ArrowUp } from 'lucide-react'
import type { DistribuicaoProjetos, PontoMensal } from './metricas'

/**
 * Os gráficos dos cards do topo — pequenos, sem biblioteca, cada um com um
 * `aria-label` que diz em palavras o que o desenho mostra.
 */

type Props = { serie: PontoMensal[]; formatar: (n: number) => string }

const descrever = ({ serie, formatar }: Props) =>
  serie.map((m) => `${m.label}: ${formatar(m.total)}`).join('; ')

/**
 * Barras dos últimos meses. `prisma` dá o volume 3D do card de receita;
 * `rotulos` escreve o mês embaixo de cada barra (o card de negociação).
 * Altura mínima de 4% para um mês zerado ainda aparecer como barra.
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
        <span key={m.key}>
          <i style={{ height: `${Math.max((m.total / maior) * 100, 4)}%` }} />
          {rotulos && <em>{m.label}</em>}
        </span>
      ))}
    </div>
  )
}

const LINHA_L = 240
const LINHA_A = 72
const LINHA_MARGEM = 8

/** Linha com um ponto por mês e a área embaixo esfumada. */
export function Linha({ serie, formatar }: Props) {
  const maior = Math.max(...serie.map((m) => m.total), 1)
  const passo = (LINHA_L - LINHA_MARGEM * 2) / Math.max(serie.length - 1, 1)
  const pontos = serie.map((m, i) => ({
    x: LINHA_MARGEM + i * passo,
    y: LINHA_A - LINHA_MARGEM - (m.total / maior) * (LINHA_A - LINHA_MARGEM * 2),
  }))
  const caminho = pontos.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y}`).join(' ')
  const area = `${caminho} L${pontos[pontos.length - 1].x} ${LINHA_A} L${pontos[0].x} ${LINHA_A} Z`
  return (
    <svg
      className="vx-linha"
      viewBox={`0 0 ${LINHA_L} ${LINHA_A}`}
      role="img"
      aria-label={descrever({ serie, formatar })}
    >
      <defs>
        <linearGradient id="vx-linha-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8f7aff" stopOpacity="0.35" />
          <stop offset="1" stopColor="#8f7aff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#vx-linha-area)" />
      <path d={caminho} fill="none" stroke="#a48fff" strokeWidth="2" strokeLinejoin="round" />
      {pontos.map((p, i) => (
        <circle key={serie[i].key} cx={p.x} cy={p.y} r="3" fill="#f4f5ff" />
      ))}
    </svg>
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

/**
 * Donut com as três fatias e a legenda ao lado. O número do meio é o de
 * projetos ATIVOS (andamento + revisão); os concluídos aparecem na roda e na
 * legenda, mas não somam nele — é o que "Projetos ativos" promete.
 */
export function Donut({ dados }: { dados: DistribuicaoProjetos }) {
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
  return (
    <div className="vx-donut" role="img" aria-label={`${ativos} projetos ativos — ${resumo}`}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle className="vx-donut-trilho" cx="50" cy="50" r={RAIO} />
        {arcos.map((a) => (
          <circle
            key={a.chave}
            className={a.classe}
            cx="50"
            cy="50"
            r={RAIO}
            strokeDasharray={`${a.comprimento} ${CIRCUNFERENCIA - a.comprimento}`}
            strokeDashoffset={-a.inicio}
          />
        ))}
      </svg>
      <div className="vx-donut-centro">
        <strong>{ativos}</strong>
        <small>{dados.revisao} em revisão</small>
      </div>
      <ul className="vx-donut-legenda">
        {arcos.map((a) => (
          <li key={a.chave} className={a.classe}>
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

const REAIS = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 })

/** "R$" menor que o número, sem centavos — como no mockup. */
export function ValorMoeda({ valor }: { valor: number }) {
  return (
    <>
      <span className="vx-moeda">R$</span> {REAIS.format(valor)}
    </>
  )
}
