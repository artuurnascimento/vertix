import type { CSSProperties, MouseEvent } from 'react'
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
import {
  ENTRADA_BASE_S,
  ENTRADA_PASSO_S,
  ICONE_BASE_S,
  ICONE_PASSO_S,
  destinoFinal,
} from './bioLinks'
import type { BioLink } from './bioLinks'
import { registrarClique } from './bioData'
import BioScanIlustracao from './BioScanIlustracao'

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

/** Glifo oficial do WhatsApp: a biblioteca de ícones não traz marcas. */
function WhatsAppGlifo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
    </svg>
  )
}

function IconeDoLink({
  nome,
  className,
}: {
  nome: string | null
  className?: string
}) {
  if (nome === 'whatsapp') return <WhatsAppGlifo className={className} />
  const Icone = (nome && ICONES[nome]) || Sparkles
  return <Icone className={className} aria-hidden="true" />
}

interface BioButtonProps {
  link: BioLink
  /** Prévia do console: mostra o botão sem registrar clique nem navegar. */
  inerte?: boolean
  /** Posição na sequência de entrada (0 = primeiro a aparecer). */
  ordem?: number
}


export default function BioButton({ link, inerte = false, ordem = 0 }: BioButtonProps) {
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

  const entrada = {
    '--entrada-atraso': `${ENTRADA_BASE_S + ordem * ENTRADA_PASSO_S}s`,
  } as CSSProperties

  if (link.formato === 'destaque') {
    return (
      <motion.a
        {...comum}
        {...animacao}
        style={entrada}
        className="vx-entrada vx-scan-card group relative block overflow-hidden rounded-2xl p-4 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        {/* Aro violeta no topo, como no banner do Scan. */}
        <span aria-hidden className="vx-scan-aro absolute inset-x-0 top-0 h-[2px]" />
        {link.chamada && (
          <span className="block text-[10px] font-semibold uppercase tracking-[0.22em] text-accent">
            {link.chamada}
          </span>
        )}
        {/* Uma linha só: tamanho fluido pela largura da tela, sem quebra. */}
        <span className="vx-scan-titulo mt-1.5 block font-kanit font-bold leading-[1.1] tracking-tight text-ink">
          {link.rotulo}
        </span>
        {link.descricao && (
          <span className="mt-2 block text-[13px] font-light leading-snug text-muted">
            {link.descricao}
          </span>
        )}
        <span className="mt-2.5 flex items-center justify-between gap-2.5">
          <span className="vx-btn-roxo relative flex h-[52px] min-w-0 flex-1 items-center justify-center gap-2 overflow-hidden rounded-2xl px-4">
            <span className="whitespace-nowrap font-kanit text-[15px] font-extrabold uppercase tracking-[0.08em] text-white">
              {link.texto_botao?.trim() || 'Quero saber'}
            </span>
            <ArrowUpRight
              className="h-[18px] w-[18px] shrink-0 text-white transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </span>
          <BioScanIlustracao />
        </span>
      </motion.a>
    )
  }

  if (link.formato === 'largo') {
    return (
      <motion.a
        {...comum}
        {...animacao}
        style={entrada}
        className={`vx-entrada flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
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
      style={entrada}
      className="vx-entrada vx-borda-degrade flex flex-col items-center gap-2 rounded-xl p-3 text-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <span
        className="vx-icone-traco flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent ring-1 ring-accent/20"
        style={
          {
            '--atraso-traco': `${ICONE_BASE_S + ordem * ICONE_PASSO_S}s`,
          } as CSSProperties
        }
      >
        <IconeDoLink nome={link.icone} className="h-5 w-5" />
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
