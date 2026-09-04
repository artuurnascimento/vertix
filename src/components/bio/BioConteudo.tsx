import { Mail } from 'lucide-react'
import LogoMark from '../ui/LogoMark'
import BioButton from './BioButton'
import { agrupaPorFormato } from './bioLinks'
import type { BioLink } from './bioLinks'

/**
 * Miolo da página de bio: marca, botões nos três formatos e contatos.
 * Sem acesso a dados aqui de propósito — a página pública e a prévia do
 * console renderizam este mesmo componente com listas de origens diferentes.
 */

export const BIO_FRASE =
  'Lojas Shopify que vendem e sistemas que resolvem. Somos Shopify Partners.'

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

  return (
    <div className="flex flex-col items-center">
      <header className="flex flex-col items-center text-center">
        <LogoMark className="h-12 w-12" />
        <h1 className="mt-3 font-kanit text-lg font-bold uppercase tracking-[0.08em] text-ink">
          Vertix<span className="text-accent">✱</span>Studio
        </h1>
        <p className="mt-2 max-w-[17rem] text-sm font-light leading-snug text-muted">
          {BIO_FRASE}
        </p>
      </header>

      <div className="mt-5 flex w-full flex-col gap-2.5">
        {destaque.map((link) => (
          <div key={link.id} className="relative">
            {/* Luzes atrás do vidro: sem elas o desfoque não tem o que
                desfocar e o efeito some no fundo escuro. */}
            <span
              aria-hidden
              className="pointer-events-none absolute -left-6 -top-8 h-40 w-40 rounded-full bg-accent/70 blur-3xl"
            />
            <span
              aria-hidden
              className="pointer-events-none absolute -bottom-10 -right-4 h-36 w-44 rounded-full bg-[#C4B5FD]/50 blur-3xl"
            />
            <span
              aria-hidden
              className="pointer-events-none absolute left-1/3 top-1/2 h-24 w-24 rounded-full bg-white/25 blur-2xl"
            />
            <BioButton link={link} inerte={inerte} />
          </div>
        ))}
        {largos.map((link) => (
          <BioButton key={link.id} link={link} inerte={inerte} />
        ))}
        {grade.length > 0 && (
          <div className="grid grid-cols-2 gap-2.5">
            {grade.map((link) => (
              <BioButton key={link.id} link={link} inerte={inerte} />
            ))}
          </div>
        )}
      </div>

      <nav aria-label="Contatos" className="mt-5 flex items-center gap-3">
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

      <p className="mt-4 text-xs font-light text-muted">
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
