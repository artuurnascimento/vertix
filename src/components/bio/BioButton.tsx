import type { MouseEvent } from 'react'
import {
  ArrowUpRight,
  Layers,
  LayoutTemplate,
  MessageCircle,
  Radar,
  Settings,
  Sparkles,
  Store,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'
import { destinoFinal } from './bioLinks'
import type { BioLink } from './bioLinks'
import { registrarClique } from './bioData'
import BorderBeam from '../ui/BorderBeam'

/**
 * Um botão do link de bio, nos três formatos. O formato vem do banco, então a
 * página inteira é remontável pelo console sem deploy.
 */

const ICONES: Record<string, LucideIcon> = {
  radar: Radar,
  'message-circle': MessageCircle,
  store: Store,
  settings: Settings,
  layout: LayoutTemplate,
  layers: Layers,
}

function IconeDoLink({
  nome,
  className,
}: {
  nome: string | null
  className?: string
}) {
  const Icone = (nome && ICONES[nome]) || Sparkles
  return <Icone className={className} aria-hidden="true" />
}

interface BioButtonProps {
  link: BioLink
  /** Prévia do console: mostra o botão sem registrar clique nem navegar. */
  inerte?: boolean
}

export default function BioButton({ link, inerte = false }: BioButtonProps) {
  const prefersReducedMotion = useReducedMotion()
  const href = destinoFinal(link)

  // Link que não dá para montar (número inválido) some, em vez de quebrar.
  if (!href) return null

  const ehConversa = link.tipo_destino === 'whatsapp'

  const comum = {
    href: inerte ? undefined : href,
    target: '_blank',
    rel: 'noopener noreferrer',
    onClick: inerte
      ? (e: MouseEvent) => e.preventDefault()
      : () => registrarClique(link.id),
  }

  const animacao = prefersReducedMotion
    ? {}
    : { whileHover: { y: -2 }, whileTap: { scale: 0.985 } }

  if (link.formato === 'destaque') {
    return (
      <motion.a
        {...comum}
        {...animacao}
        className="block rounded-2xl border border-accent bg-gradient-to-br from-[#241A5E] to-accent-2 p-5 text-left transition-shadow duration-200 hover:shadow-[0_16px_40px_-16px_rgba(108,91,242,0.7)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        {link.chamada && (
          <span className="block text-[11px] font-medium uppercase tracking-[0.18em] text-white/70">
            {link.chamada}
          </span>
        )}
        <span className="mt-1.5 block text-xl font-bold leading-tight text-white">
          {link.rotulo}
        </span>
        {link.descricao && (
          <span className="mt-1.5 block text-sm font-light leading-snug text-white/80">
            {link.descricao}
          </span>
        )}
        <span className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-bg">
          {link.texto_botao?.trim() || 'Quero saber'}
          <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
        </span>
      </motion.a>
    )
  }

  if (link.formato === 'largo') {
    return (
      <motion.a
        {...comum}
        {...animacao}
        className={`flex items-center gap-3 rounded-xl border px-4 py-3.5 transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
          ehConversa
            ? 'border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/15'
            : 'border-white/10 bg-surface-1 hover:bg-surface-2'
        }`}
      >
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
            ehConversa
              ? 'bg-emerald-500 text-emerald-950'
              : 'bg-surface-2 text-accent'
          }`}
        >
          <IconeDoLink nome={link.icone} className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-ink">
            {link.rotulo}
          </span>
          {link.descricao && (
            <span className="block truncate text-xs font-light text-muted">
              {link.descricao}
            </span>
          )}
        </span>
        <ArrowUpRight className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
      </motion.a>
    )
  }

  return (
    <motion.a
      {...comum}
      {...animacao}
      className="relative flex flex-col gap-3 rounded-xl border border-white/10 bg-surface-1 p-4 transition-colors duration-200 hover:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      {/* Atraso derivado da posição: cards vizinhos não giram em sincronia. */}
      <BorderBeam delay={(link.posicao / 10) % 4 * 3} />
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-2 text-accent">
        <IconeDoLink nome={link.icone} className="h-4 w-4" />
      </span>
      <span>
        <span className="block text-sm font-semibold leading-tight text-ink">
          {link.rotulo}
        </span>
        {link.descricao && (
          <span className="mt-0.5 block text-xs font-light leading-snug text-muted">
            {link.descricao}
          </span>
        )}
      </span>
    </motion.a>
  )
}
