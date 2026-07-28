import { cn } from '@/lib/utils'
import FadeIn from '../ui/FadeIn'
import { AnimatedGroup } from '../ui/animated-group'
import { TestimonialCard } from '../ui/testimonial-card'
import type { TestimonialAuthor } from '../ui/testimonial-card'

interface Testimonial {
  author: TestimonialAuthor
  text: string
  href?: string
}

const TESTIMONIALS: Testimonial[] = [
  {
    author: {
      name: 'Mariana Costa',
      handle: '@siriusambiental',
      avatar:
        'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop&crop=face',
    },
    text: 'O SAAM centralizou licenças, relatórios e monitoramento num painel só. A Vertix entendeu nossa operação antes de escrever uma linha de código.',
  },
  {
    author: {
      name: 'Rafael Almeida',
      handle: '@facepass',
      avatar:
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face',
    },
    text: 'O FacePass eliminou crachá e planilha na portaria. Reconhecimento facial rápido e um painel que qualquer pessoa da equipe usa sem treinamento.',
  },
  {
    author: {
      name: 'Juliana Ferreira',
      handle: '@lojaengland',
      avatar:
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&h=150&fit=crop&crop=face',
    },
    text: 'Migraram nossa loja para a Shopify sem perder uma venda. O checkout novo converte muito mais e o tema ficou com a nossa cara.',
  },
  {
    author: {
      name: 'Pedro Santos',
      handle: '@orizonbrasil',
      avatar:
        'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face',
    },
    text: 'A Orizon precisava de um sistema de gestão do nosso jeito. Entregaram rápido, com design impecável e suporte que responde de verdade.',
  },
]

interface Brand {
  name: string
  className: string
}

const BRANDS: Brand[] = [
  { name: 'SAAM', className: 'text-xl font-light tracking-[0.35em]' },
  { name: 'FacePass', className: 'text-xl font-semibold tracking-tight' },
  { name: 'England', className: 'font-serif text-xl italic tracking-wide' },
  { name: 'Orizon', className: 'text-lg font-bold uppercase tracking-[0.25em]' },
  { name: 'Vybe', className: 'text-2xl font-black italic uppercase' },
  {
    name: 'Sirius Ambiental',
    className: 'text-base font-light uppercase tracking-[0.2em]',
  },
]

export default function TestimonialsSection() {
  return (
    <section
      aria-label="Depoimentos de clientes"
      className="flex flex-col items-center gap-10 overflow-hidden bg-bg py-20 text-center sm:gap-14 md:py-28"
    >
      <FadeIn y={40}>
        <div className="flex flex-col items-center gap-4 px-4 sm:gap-6">
          <h2
            className="hero-heading font-black uppercase leading-none tracking-tight"
            style={{ fontSize: 'clamp(3rem, 12vw, 160px)' }}
          >
            Clientes
          </h2>
          <p
            className="max-w-[600px] font-light leading-relaxed text-muted"
            style={{ fontSize: 'clamp(1rem, 2vw, 1.35rem)' }}
          >
            Quem já subiu com a gente — lojas e sistemas rodando em produção.
          </p>
        </div>
      </FadeIn>

      <div className="relative flex w-full flex-col items-center justify-center overflow-hidden">
        <div className="group flex flex-row overflow-hidden p-2 [--duration:40s] [--gap:1rem] [gap:var(--gap)]">
          {[0, 1].map((copyIndex) => (
            <div
              key={copyIndex}
              aria-hidden={copyIndex > 0}
              className="flex shrink-0 animate-marquee flex-row justify-around [gap:var(--gap)] group-hover:[animation-play-state:paused] motion-reduce:[animation-play-state:paused]"
            >
              {[...Array(2)].map((_, setIndex) =>
                TESTIMONIALS.map((testimonial, i) => (
                  <TestimonialCard key={`${setIndex}-${i}`} {...testimonial} />
                )),
              )}
            </div>
          ))}
        </div>

        <div className="pointer-events-none absolute inset-y-0 left-0 hidden w-1/3 bg-gradient-to-r from-bg sm:block" />
        <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-1/3 bg-gradient-to-l from-bg sm:block" />
      </div>

      <AnimatedGroup
        variants={{
          container: {
            visible: {
              transition: { staggerChildren: 0.06, delayChildren: 0.2 },
            },
          },
          item: {
            hidden: { opacity: 0, filter: 'blur(12px)', y: 12 },
            visible: {
              opacity: 1,
              filter: 'blur(0px)',
              y: 0,
              transition: { type: 'spring', bounce: 0.3, duration: 1.5 },
            },
          },
        }}
        className="mx-auto mt-2 grid w-full max-w-4xl grid-cols-2 items-center gap-x-8 gap-y-10 px-6 sm:grid-cols-3 md:gap-x-14"
      >
        {BRANDS.map((brand) => (
          <div key={brand.name} className="flex items-center justify-center">
            <span
              className={cn(
                'whitespace-nowrap text-muted/60 transition-colors duration-300 hover:text-ink',
                brand.className,
              )}
            >
              {brand.name}
            </span>
          </div>
        ))}
      </AnimatedGroup>
    </section>
  )
}
