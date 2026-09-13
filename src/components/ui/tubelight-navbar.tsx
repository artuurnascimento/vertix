import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Tubelight Navbar (21st.dev) adaptado ao painel: as abas numa pílula de
 * vidro e a "lâmpada" — um traço aceso no topo do item ativo, com o halo
 * — que desliza de um item para o outro (framer-motion `layoutId`).
 *
 * Diferenças do original, de propósito: o item ativo vem da ROTA (o
 * layout já sabe em que área está), não de um clique guardado em estado;
 * o link é o do react-router; e não há `position: fixed` — o menu mora no
 * cabeçalho, e no celular quem manda é a barra de baixo.
 */

function cn(...inputs: Parameters<typeof clsx>): string {
  return twMerge(clsx(inputs))
}

export interface NavItem {
  name: string
  url: string
  icon: LucideIcon
  ativo: boolean
}

interface NavBarProps {
  items: NavItem[]
  className?: string
}

export function NavBar({ items, className }: NavBarProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-1 rounded-full border border-white/10 bg-surface-1/60 px-1 py-1 shadow-lg shadow-black/30 backdrop-blur-lg',
        className
      )}
    >
      {items.map((item) => {
        const Icon = item.icon
        return (
          <Link
            key={item.name}
            to={item.url}
            aria-current={item.ativo ? 'page' : undefined}
            className={cn(
              'relative cursor-pointer rounded-full px-6 py-2 text-sm font-semibold transition-colors',
              'text-ink/80 hover:text-white',
              item.ativo && 'text-white'
            )}
          >
            <span className="hidden md:inline">{item.name}</span>
            <span className="md:hidden">
              <Icon size={18} strokeWidth={2.5} />
            </span>
            {item.ativo && (
              <motion.div
                layoutId="lamp"
                className="absolute inset-0 -z-10 w-full rounded-full bg-accent/15"
                initial={false}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              >
                <div className="absolute -top-2 left-1/2 h-1 w-8 -translate-x-1/2 rounded-t-full bg-accent">
                  <div className="absolute -left-2 -top-2 h-6 w-12 rounded-full bg-accent/30 blur-md" />
                  <div className="absolute -top-1 h-6 w-8 rounded-full bg-accent/30 blur-md" />
                  <div className="absolute left-2 top-0 h-4 w-4 rounded-full bg-accent/30 blur-sm" />
                </div>
              </motion.div>
            )}
          </Link>
        )
      })}
    </div>
  )
}
