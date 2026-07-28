import { useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Check, X } from 'lucide-react'
import type { PointerEvent, ReactNode } from 'react'
import { cn } from '@/lib/utils'
import FadeIn from '../ui/FadeIn'
import { ContactButton } from '../ui/buttons'

type PlanMode = 'lojas' | 'sistemas'

interface Feature {
  text: string
  included: boolean
}

interface Plan {
  name: string
  price: string
  description: string
  bg: string
  featured?: boolean
  badge?: string
  features: Feature[]
}

const MODES: Array<{ id: PlanMode; label: string }> = [
  { id: 'lojas', label: 'Lojas Shopify' },
  { id: 'sistemas', label: 'Sistemas' },
]

const PLANS: Record<PlanMode, Plan[]> = {
  lojas: [
    {
      name: 'Loja Essencial',
      price: '4.900',
      description: 'Sua loja Shopify no ar, pronta pra vender.',
      bg: '#141410',
      features: [
        { text: 'Tema Shopify sob medida', included: true },
        { text: 'Checkout otimizado', included: true },
        { text: 'Até 50 produtos cadastrados', included: true },
        { text: 'Domínio, e-mail e analytics', included: true },
        { text: 'Integração com ERP e logística', included: false },
        { text: 'Automações de marketing', included: false },
      ],
    },
    {
      name: 'Loja Completa',
      price: '8.900',
      description: 'Migração ou loja nova com tudo integrado.',
      bg: '#17142B',
      featured: true,
      badge: 'Mais escolhido',
      features: [
        { text: 'Tema Shopify sob medida', included: true },
        { text: 'Checkout otimizado', included: true },
        { text: 'Migração de qualquer plataforma', included: true },
        { text: 'Integração com ERP e logística', included: true },
        { text: 'Automações de marketing + SEO', included: true },
        { text: '60 dias de suporte pós-lançamento', included: true },
      ],
    },
  ],
  sistemas: [
    {
      name: 'Sistema Essencial',
      price: '12.900',
      description: 'O MVP do seu sistema rodando em produção.',
      bg: '#141410',
      features: [
        { text: 'Levantamento e protótipo', included: true },
        { text: 'Painel web responsivo', included: true },
        { text: 'Banco de dados + autenticação', included: true },
        { text: 'Deploy e treinamento da equipe', included: true },
        { text: 'Integrações com sistemas externos', included: false },
        { text: 'Suporte contínuo', included: false },
      ],
    },
    {
      name: 'Sistema Completo',
      price: '24.900',
      description: 'Operação inteira digitalizada, do banco à interface.',
      bg: '#17142B',
      featured: true,
      badge: 'Sob medida total',
      features: [
        { text: 'Tudo do Sistema Essencial', included: true },
        { text: 'Integrações com sistemas externos', included: true },
        { text: 'Dashboards e relatórios', included: true },
        { text: 'Controle de acesso por perfil', included: true },
        { text: 'Automações de processos', included: true },
        { text: 'Suporte contínuo com SLA', included: true },
      ],
    },
  ],
}

interface SpotlightCardProps {
  children: ReactNode
  className?: string
}

/** Anel de 1px que segue o cursor (spotlight indigo), via CSS mask. */
function SpotlightCard({ children, className }: SpotlightCardProps) {
  const ref = useRef<HTMLDivElement>(null)

  const handleMove = (e: PointerEvent<HTMLDivElement>) => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    el.style.setProperty('--spot-x', `${e.clientX - rect.left}px`)
    el.style.setProperty('--spot-y', `${e.clientY - rect.top}px`)
  }

  const handleLeave = () => {
    const el = ref.current
    if (!el) return
    el.style.setProperty('--spot-x', '-9999px')
    el.style.setProperty('--spot-y', '-9999px')
  }

  return (
    <div
      ref={ref}
      onPointerMove={handleMove}
      onPointerLeave={handleLeave}
      className={cn('relative rounded-2xl', className)}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-10 rounded-2xl"
        style={{
          padding: '1px',
          background:
            'radial-gradient(circle 460px at var(--spot-x, -9999px) var(--spot-y, -9999px), rgba(108, 91, 242, 0.7), transparent 60%)',
          WebkitMask:
            'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
          WebkitMaskComposite: 'xor',
          mask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
          maskComposite: 'exclude',
        }}
      />
      {children}
    </div>
  )
}

function PricingCard({ plan }: { plan: Plan }) {
  return (
    <SpotlightCard className="h-full">
      <div
        className={cn(
          'relative flex h-full flex-col rounded-2xl border p-7 text-start sm:p-8',
          plan.featured ? 'border-accent/50' : 'border-[#22221B]',
        )}
        style={{ backgroundColor: plan.bg }}
      >
        {plan.badge && (
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-accent px-3 py-1 text-xs font-medium uppercase tracking-wider text-white">
            {plan.badge}
          </div>
        )}

        <FadeIn delay={0} y={16}>
          <div className="text-[11px] uppercase tracking-[0.2em] text-muted">
            {plan.name}
          </div>
        </FadeIn>
        <div className="mt-3 border-t border-[#22221B]" />

        <FadeIn delay={0.1} y={16}>
          <div className="mt-8 flex items-baseline gap-2">
            <span className="text-lg text-muted">R$</span>
            <span className="text-[2.75rem] font-semibold leading-none tracking-tight text-ink">
              {plan.price}
            </span>
          </div>
          <p className="mt-2 text-xs uppercase tracking-widest text-accent">
            Pagamento único · escopo fechado
          </p>
        </FadeIn>

        <FadeIn delay={0.2} y={16}>
          <p className="mt-4 text-sm font-light leading-relaxed text-muted">
            {plan.description}
          </p>
        </FadeIn>

        <FadeIn delay={0.3} y={16}>
          <div className="mt-7">
            {plan.featured ? (
              <ContactButton label="Começar projeto" href="#contato" />
            ) : (
              <a
                href="#contato"
                className="inline-flex items-center justify-center whitespace-nowrap rounded-full border-2 border-[#22221B] px-8 py-3 text-xs font-medium uppercase tracking-widest text-ink transition-colors duration-200 hover:border-accent sm:text-sm"
              >
                Falar com a gente
              </a>
            )}
          </div>
        </FadeIn>

        <FadeIn delay={0.4} y={16} className="flex flex-1">
          <ul className="mt-7 flex w-full flex-1 flex-col">
            {plan.features.map((feature, i) => (
              <li
                key={feature.text}
                className={cn(
                  'flex items-center gap-3 py-4 text-sm',
                  i !== 0 && 'border-t border-[#22221B]',
                  feature.included ? 'text-ink/85' : 'text-muted/60',
                )}
              >
                <span
                  className={cn(
                    'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border',
                    feature.included
                      ? 'border-accent/40 bg-accent/10'
                      : 'border-[#22221B] bg-transparent',
                  )}
                >
                  {feature.included ? (
                    <Check className="h-3 w-3 text-accent" />
                  ) : (
                    <X className="h-3 w-3 text-muted/60" />
                  )}
                </span>
                {feature.text}
              </li>
            ))}
          </ul>
        </FadeIn>
      </div>
    </SpotlightCard>
  )
}

export default function PricingSection() {
  const [mode, setMode] = useState<PlanMode>('lojas')

  return (
    <section
      id="planos"
      className="flex flex-col items-center gap-10 bg-bg px-5 py-20 text-center sm:gap-12 sm:px-8 md:py-28"
    >
      <FadeIn y={40}>
        <h2
          className="hero-heading font-black uppercase leading-none tracking-tight"
          style={{ fontSize: 'clamp(3rem, 12vw, 160px)' }}
        >
          Planos
        </h2>
      </FadeIn>

      <FadeIn delay={0.15} y={20}>
        <p
          className="max-w-[600px] font-light leading-relaxed text-muted"
          style={{ fontSize: 'clamp(1rem, 2vw, 1.35rem)' }}
        >
          Pagamento único, escopo fechado, sem mensalidade escondida. Loja e
          sistema são projetos diferentes — escolhe a sua frente.
        </p>
      </FadeIn>

      <FadeIn delay={0.25} y={20}>
        <div
          role="tablist"
          aria-label="Tipo de projeto"
          className="relative flex items-center rounded-full border border-[#22221B] bg-[#141410] p-1"
        >
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              role="tab"
              aria-selected={mode === m.id}
              onClick={() => setMode(m.id)}
              className={cn(
                'relative rounded-full px-5 py-2.5 text-xs font-medium uppercase tracking-wider transition-colors duration-200 sm:px-7 sm:text-sm',
                mode === m.id ? 'text-white' : 'text-muted hover:text-ink',
              )}
            >
              {mode === m.id && (
                <motion.span
                  layoutId="plan-toggle-pill"
                  className="absolute inset-0 rounded-full bg-accent"
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.5 }}
                />
              )}
              <span className="relative z-10">{m.label}</span>
            </button>
          ))}
        </div>
      </FadeIn>

      <motion.div
        key={mode}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="mx-auto grid w-full max-w-3xl grid-cols-1 gap-6 md:grid-cols-2"
      >
        {PLANS[mode].map((plan) => (
          <PricingCard key={plan.name} plan={plan} />
        ))}
      </motion.div>

      <p className="text-xs uppercase tracking-widest text-muted">
        Valores de referência — todo projeto fecha com proposta sob medida.
      </p>
    </section>
  )
}
