import type { MouseEvent } from 'react'
import { useRef } from 'react'
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from 'framer-motion'
import FadeIn from '../ui/FadeIn'
import LogoMark from '../ui/LogoMark'
import { ContactButton } from '../ui/buttons'
import StarField from '../ui/StarField'
import TechConstellation from './TechConstellation'

const NAV_LINKS = [
  { label: 'Sobre', href: '#sobre' },
  { label: 'Serviços', href: '#servicos' },
  { label: 'Planos', href: '#planos' },
  { label: 'Projetos', href: '#projetos' },
  { label: 'Contato', href: '#contato' },
]

export default function HeroSection() {
  const sectionRef = useRef<HTMLElement>(null)
  const reduce = useReducedMotion()

  // Parallax lento respondendo ao mouse (springs = movimento de luxo).
  const mx = useMotionValue(0)
  const my = useMotionValue(0)
  const sx = useSpring(mx, { stiffness: 45, damping: 22, mass: 0.6 })
  const sy = useSpring(my, { stiffness: 45, damping: 22, mass: 0.6 })

  const starsX = useTransform(sx, (v) => v * 8)
  const starsY = useTransform(sy, (v) => v * 8)
  const logosX = useTransform(sx, (v) => v * 24)
  const logosY = useTransform(sy, (v) => v * 24)

  const handleMouseMove = (e: MouseEvent<HTMLElement>) => {
    if (reduce) return
    const rect = sectionRef.current?.getBoundingClientRect()
    if (!rect) return
    mx.set((e.clientX - rect.left) / rect.width - 0.5)
    my.set((e.clientY - rect.top) / rect.height - 0.5)
  }

  const handleMouseLeave = () => {
    mx.set(0)
    my.set(0)
  }

  return (
    <section
      ref={sectionRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="relative flex h-screen flex-col overflow-hidden"
      style={{ backgroundColor: '#050507' }}
    >
      {/* Gradientes ambiente azul/violeta desvanecendo pro preto */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(60% 45% at 50% 30%, rgba(108,91,242,0.18), transparent 70%),' +
            'radial-gradient(46% 42% at 72% 66%, rgba(64,96,224,0.12), transparent 72%),' +
            'radial-gradient(42% 36% at 26% 62%, rgba(120,80,240,0.10), transparent 74%)',
        }}
        animate={reduce ? undefined : { opacity: [0.85, 1, 0.85] }}
        transition={
          reduce
            ? undefined
            : { duration: 12, repeat: Infinity, ease: 'easeInOut' }
        }
      />

      {/* Poeira estelar (parallax raso) */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ x: starsX, y: starsY }}
      >
        <StarField />
      </motion.div>

      {/* Constelação de logos (parallax mais profundo) */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[5]"
        style={{ x: logosX, y: logosY }}
      >
        <TechConstellation />
      </motion.div>

      {/* Vinheta pra afundar as bordas no preto */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(125% 125% at 50% 45%, transparent 52%, rgba(0,0,0,0.92) 100%)',
        }}
      />

      {/* Grão sutil */}
      <svg
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.04] mix-blend-overlay"
      >
        <filter id="heroGrain">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.9"
            numOctaves="2"
            stitchTiles="stitch"
          />
        </filter>
        <rect width="100%" height="100%" filter="url(#heroGrain)" />
      </svg>

      {/* Nav */}
      <FadeIn delay={0} y={-20}>
        <nav
          aria-label="Navegação principal"
          className="relative z-20 flex items-center justify-between px-6 pt-6 md:px-10 md:pt-8"
        >
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium uppercase tracking-wider text-ink transition-opacity duration-200 hover:opacity-70 md:text-lg lg:text-[1.4rem]"
            >
              {link.label}
            </a>
          ))}
        </nav>
      </FadeIn>

      {/* Logo central fixa + glow violeta respirando */}
      <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
        <FadeIn delay={0.2} y={20}>
          <div className="relative flex items-center gap-3 sm:gap-4">
            <motion.div
              aria-hidden
              className="absolute left-1/2 top-1/2 -z-10 -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{
                width: 560,
                height: 340,
                background:
                  'radial-gradient(ellipse at center, rgba(108,91,242,0.42), rgba(108,91,242,0) 70%)',
                filter: 'blur(30px)',
              }}
              animate={
                reduce
                  ? undefined
                  : { opacity: [0.55, 0.9, 0.55], scale: [1, 1.06, 1] }
              }
              transition={
                reduce
                  ? undefined
                  : { duration: 6, repeat: Infinity, ease: 'easeInOut' }
              }
            />
            <LogoMark
              className="h-14 w-auto sm:h-20 md:h-24"
              style={{
                filter: 'drop-shadow(0 8px 44px rgba(108,91,242,0.5))',
              }}
            />
            <span
              className="hero-heading text-6xl font-black uppercase leading-none tracking-tight sm:text-7xl md:text-8xl"
              style={{
                filter: 'drop-shadow(0 6px 40px rgba(180,180,220,0.15))',
              }}
            >
              VERT
              <span style={{ WebkitTextFillColor: '#6C5BF2' }}>I</span>X
            </span>
          </div>
        </FadeIn>
      </div>

      {/* Tagline + CTA */}
      <div className="relative z-20 mt-auto flex items-end justify-between px-6 pb-7 sm:pb-8 md:px-10 md:pb-10">
        <FadeIn delay={0.35} y={20}>
          <p
            className="max-w-[160px] font-light uppercase leading-snug tracking-wide text-ink sm:max-w-[220px] md:max-w-[260px]"
            style={{ fontSize: 'clamp(0.75rem, 1.4vw, 1.5rem)' }}
          >
            estúdio de e-commerce &amp; sistemas — lojas que vendem, software que
            escala
          </p>
        </FadeIn>
        <FadeIn delay={0.5} y={20}>
          <ContactButton />
        </FadeIn>
      </div>
    </section>
  )
}
