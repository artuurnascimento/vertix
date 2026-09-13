import * as React from 'react'
import { NavLink, type NavLinkProps } from 'react-router-dom'
import { cva, type VariantProps } from 'class-variance-authority'

/**
 * Glass Button (21st.dev) adaptado ao painel: a pílula de vidro com o brilho
 * de borda e a sombra colorida embaixo. O visual mora em `.glass-button-*`
 * (src/index.css). Além do botão original, há o `GlassNavLink` — mesma
 * estrutura, mas um link do router, porque o menu do painel navega.
 */

function cn(...inputs: (string | undefined | null | false)[]): string {
  return inputs.filter(Boolean).join(' ')
}

const glassButtonVariants = cva(
  'relative isolate all-unset cursor-pointer rounded-full transition-all',
  {
    variants: {
      size: {
        default: 'text-base font-medium',
        sm: 'text-sm font-medium',
        lg: 'text-lg font-medium',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: { size: 'default' },
  }
)

const glassButtonTextVariants = cva(
  'glass-button-text relative block select-none tracking-tighter',
  {
    variants: {
      size: {
        default: 'px-6 py-3.5',
        sm: 'px-4 py-2',
        lg: 'px-8 py-4',
        icon: 'flex h-10 w-10 items-center justify-center',
      },
    },
    defaultVariants: { size: 'default' },
  }
)

export interface GlassButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof glassButtonVariants> {
  contentClassName?: string
}

const GlassButton = React.forwardRef<HTMLButtonElement, GlassButtonProps>(
  ({ className, children, size, contentClassName, ...props }, ref) => (
    <div className={cn('glass-button-wrap cursor-pointer rounded-full', className)}>
      <button className={cn('glass-button', glassButtonVariants({ size }))} ref={ref} {...props}>
        <span className={cn(glassButtonTextVariants({ size }), contentClassName)}>{children}</span>
      </button>
      <div className="glass-button-shadow rounded-full" />
    </div>
  )
)
GlassButton.displayName = 'GlassButton'

export interface GlassNavLinkProps
  extends Omit<NavLinkProps, 'className' | 'children'>,
    VariantProps<typeof glassButtonVariants> {
  className?: string
  contentClassName?: string
  children: React.ReactNode
  /** Força o estado ativo (o menu do topo decide por área, não pela rota exata). */
  ativo?: boolean
}

/** A mesma pílula de vidro, como link do router; `.is-active` quando a rota bate. */
function GlassNavLink({ className, children, size, contentClassName, ativo, ...props }: GlassNavLinkProps) {
  return (
    <NavLink
      {...props}
      className={({ isActive }) =>
        cn('glass-button-wrap rounded-full', (ativo ?? isActive) && 'is-active', className)
      }
      aria-current={ativo === undefined ? undefined : ativo ? 'page' : undefined}
    >
      <span className={cn('glass-button block', glassButtonVariants({ size }))}>
        <span className={cn(glassButtonTextVariants({ size }), contentClassName)}>{children}</span>
      </span>
      <span className="glass-button-shadow rounded-full" />
    </NavLink>
  )
}

export { GlassButton, GlassNavLink, glassButtonVariants }
