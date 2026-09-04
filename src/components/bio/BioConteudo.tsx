import { useLayoutEffect, useRef } from 'react'
import type { CSSProperties } from 'react'
import { Mail } from 'lucide-react'
import BioButton from './BioButton'
import { ENTRADA_BASE_S, ENTRADA_PASSO_S, agrupaPorFormato } from './bioLinks'
import type { BioLink } from './bioLinks'

/**
 * Miolo da página de bio: marca, botões nos três formatos e contatos.
 * Sem acesso a dados aqui de propósito — a página pública e a prévia do
 * console renderizam este mesmo componente com listas de origens diferentes.
 */

const INSTAGRAM_URL = 'https://instagram.com/byvertix'
const EMAIL_CONTATO = 'contato@vertix.studio'

/** Glifo do Instagram desenhado aqui: lucide-react removeu ícones de marca. */
function InstagramGlifo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <path d="M17.5 6.5h.01" />
    </svg>
  )
}

interface BioConteudoProps {
  links: BioLink[]
  /** Prévia do console: botões não navegam nem registram clique. */
  inerte?: boolean
}

export default function BioConteudo({ links, inerte = false }: BioConteudoProps) {
  const { destaque, largos, grade } = agrupaPorFormato(links)
  const marcaRef = useRef<HTMLElement>(null)

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
  }, [inerte])

  // Contatos e rodapé entram por último, depois de todos os botões.
  const ordemContatos = links.length
  const entradaDe = (ordem: number) =>
    ({ '--entrada-atraso': `${ENTRADA_BASE_S + ordem * ENTRADA_PASSO_S}s` }) as CSSProperties
  // Ordem de entrada na tela: destaque, depois largos, depois a grade.
  const ordemDe = (link: BioLink) =>
    [...destaque, ...largos, ...grade].findIndex((l) => l.id === link.id)

  return (
    <div className="flex flex-col items-center">
      {/* Marca animada, a mesma abertura do painel: as lâminas do símbolo se
          desenham subindo ao vértice e a palavra entra com o "I" em indigo. */}
      <header ref={marcaRef} className="flex flex-col items-center text-center">
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
      </header>

      <div className="mt-4 flex w-full flex-col gap-2.5">
        {destaque.map((link) => (
          <BioButton key={link.id} link={link} inerte={inerte} ordem={ordemDe(link)} />
        ))}
        {largos.map((link) => (
          <BioButton key={link.id} link={link} inerte={inerte} ordem={ordemDe(link)} />
        ))}
        {grade.length > 0 && (
          <div className="grid grid-cols-2 gap-2.5">
            {grade.map((link) => (
              <BioButton key={link.id} link={link} inerte={inerte} ordem={ordemDe(link)} />
            ))}
          </div>
        )}
      </div>

      <nav
        aria-label="Contatos"
        className="vx-entrada mt-5 flex items-center gap-3"
        style={entradaDe(ordemContatos)}
      >
        <a
          href={inerte ? undefined : INSTAGRAM_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Instagram da Vertix"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-surface-1 text-muted transition-colors duration-200 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <InstagramGlifo className="h-4 w-4" />
        </a>
        <a
          href={inerte ? undefined : `mailto:${EMAIL_CONTATO}`}
          aria-label="Email da Vertix"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-surface-1 text-muted transition-colors duration-200 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <Mail className="h-4 w-4" aria-hidden="true" />
        </a>
      </nav>

      <p
        className="vx-entrada mt-4 text-xs font-light text-muted"
        style={entradaDe(ordemContatos + 1)}
      >
        <a
          href={inerte ? undefined : 'https://www.vertix.studio'}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-ink transition-colors duration-200 hover:text-accent"
        >
          vertix.studio
        </a>
      </p>
    </div>
  )
}
