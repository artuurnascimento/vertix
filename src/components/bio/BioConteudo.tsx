import { useLayoutEffect, useRef } from 'react'
import BioButton from './BioButton'
import { agrupaPorFormato } from './bioLinks'
import type { BioLink } from './bioLinks'

/**
 * Miolo da página de bio: marca e botões nos três formatos. Sem contatos nem
 * rodapé — é link de bio para o Instagram, quem chega já veio de lá.
 * Sem acesso a dados aqui de propósito — a página pública e a prévia do
 * console renderizam este mesmo componente com listas de origens diferentes.
 */

interface BioConteudoProps {
  links: BioLink[]
  /** Prévia do console: botões não navegam nem registram clique. */
  inerte?: boolean
}

export default function BioConteudo({ links, inerte = false }: BioConteudoProps) {
  const { destaque, largos, grade } = agrupaPorFormato(links)
  const marcaRef = useRef<HTMLElement>(null)
  const linhaRef = useRef<HTMLSpanElement>(null)

  // Abertura: a marca nasce no centro da tela, se desenha ali e sobe até o
  // lugar dela. A distância depende da altura de cada aparelho, então é
  // medida antes da primeira pintura e entregue ao CSS por variável. A prévia
  // do console não faz isso (o "centro" ali seria o do painel, não da tela).
  useLayoutEffect(() => {
    if (inerte) return
    const el = marcaRef.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    // O CSS já traz um padrão (metade da altura da tela menos a posição
    // final da marca). A medição só refina quando a janela tem altura real:
    // em painel oculto ela reporta zero e o cálculo sairia errado.
    const r = el.getBoundingClientRect()
    const desloc = window.innerHeight / 2 - (r.top + r.height / 2)
    if (window.innerHeight > 0 && desloc > 0) {
      el.style.setProperty('--marca-desloc', `${Math.round(desloc)}px`)
    }
    el.classList.add('vx-marca-centro')

    // Enquanto a palavra não entrou, o símbolo sozinho fica centralizado:
    // a linha começa deslocada em metade da largura da palavra (mais o vão)
    // e desliza para o lugar quando ela aparece.
    const linha = linhaRef.current
    const simbolo = linha?.firstElementChild
    if (linha && simbolo) {
      const desvio = (linha.getBoundingClientRect().width - simbolo.getBoundingClientRect().width) / 2
      linha.style.setProperty('--marca-desvio', `${Math.round(desvio)}px`)
    }
  }, [inerte])

  // Ordem de entrada na tela: destaque, depois largos, depois a grade.
  const ordemDe = (link: BioLink) =>
    [...destaque, ...largos, ...grade].findIndex((l) => l.id === link.id)

  return (
    <div className="flex flex-1 flex-col items-center">
      {/* Marca animada no formato horizontal: símbolo à esquerda se desenha
          subindo ao vértice e a palavra entra ao lado com o "I" em indigo. */}
      <header ref={marcaRef} className="flex flex-col items-center text-center">
        <span ref={linhaRef} className="vx-marca-linha flex items-center gap-3">
        <svg
          viewBox="0 0 132 162"
          className="vx-bio-marca-simbolo"
          fill="none"
          aria-hidden="true"
          style={{ overflow: 'visible' }}
        >
          <path
            className="vx-bio-lamina-a"
            d="M6 132 L66 14 L126 132"
            stroke="#6C5BF2"
            strokeWidth="26"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <path
            className="vx-bio-lamina-b"
            d="M34 150 L66 88 L98 150"
            stroke="#F4F4F0"
            strokeWidth="20"
            strokeLinejoin="round"
            strokeLinecap="round"
            opacity="0.85"
          />
        </svg>
        <h1 className="vx-bio-marca-word font-kanit">
          VERT<span className="vx-bio-marca-i">I</span>X
        </h1>
        </span>
      </header>

      <div className="mt-3 flex w-full flex-1 flex-col justify-center gap-[clamp(10px,2.2vh,20px)] pb-2">
        {destaque.map((link) => (
          <BioButton key={link.id} link={link} inerte={inerte} ordem={ordemDe(link)} />
        ))}
        {largos.map((link) => (
          <BioButton key={link.id} link={link} inerte={inerte} ordem={ordemDe(link)} />
        ))}
        {grade.length > 0 && (
          <div className="grid grid-cols-2 gap-[clamp(10px,2.2vh,20px)]">
            {grade.map((link, i) => (
              <BioButton
                key={link.id}
                link={link}
                inerte={inerte}
                ordem={ordemDe(link)}
                // Xadrez em duas colunas: violeta em (linha par, coluna par) e
                // (linha ímpar, coluna ímpar); branco nas outras.
                iconeViolet={(i % 2 === 0) === (Math.floor(i / 2) % 2 === 0)}
              />
            ))}
          </div>
        )}
      </div>

    </div>
  )
}
