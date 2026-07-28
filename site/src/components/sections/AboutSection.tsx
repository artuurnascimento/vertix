import { Code2, Palette, ShoppingBag, Workflow } from 'lucide-react'
import FadeIn from '../ui/FadeIn'
import AnimatedText from '../ui/AnimatedText'
import { ContactButton } from '../ui/buttons'

const ABOUT_TEXT =
  'Somos a Vertix, estúdio que une e-commerce e software sob medida. Criamos e migramos lojas Shopify que vendem de verdade, construímos sistemas que escalam e cuidamos do design de ponta a ponta. Vamos colocar sua marca no vértice?'

const ICON_CLASS =
  'h-[80px] w-[80px] sm:h-[110px] sm:w-[110px] md:h-[140px] md:w-[140px]'

export default function AboutSection() {
  return (
    <section
      id="sobre"
      className="relative flex min-h-screen flex-col items-center justify-center px-5 py-20 sm:px-8 md:px-10"
    >
      <FadeIn
        delay={0.1}
        x={-80}
        y={0}
        duration={0.9}
        className="absolute left-[1%] top-[4%] sm:left-[2%] md:left-[4%]"
      >
        <ShoppingBag className={`${ICON_CLASS} text-accent opacity-60`} strokeWidth={1} />
      </FadeIn>
      <FadeIn
        delay={0.25}
        x={-80}
        y={0}
        duration={0.9}
        className="absolute bottom-[8%] left-[3%] sm:left-[6%] md:left-[10%]"
      >
        <Workflow className={`${ICON_CLASS} text-muted opacity-50`} strokeWidth={1} />
      </FadeIn>
      <FadeIn
        delay={0.15}
        x={80}
        y={0}
        duration={0.9}
        className="absolute right-[1%] top-[4%] sm:right-[2%] md:right-[4%]"
      >
        <Code2 className={`${ICON_CLASS} text-muted opacity-50`} strokeWidth={1} />
      </FadeIn>
      <FadeIn
        delay={0.3}
        x={80}
        y={0}
        duration={0.9}
        className="absolute bottom-[8%] right-[3%] sm:right-[6%] md:right-[10%]"
      >
        <Palette className={`${ICON_CLASS} text-accent opacity-60`} strokeWidth={1} />
      </FadeIn>

      <div className="relative z-10 flex flex-col items-center gap-10 sm:gap-14 md:gap-16">
        <FadeIn y={40}>
          <h2
            className="hero-heading text-center font-black uppercase leading-none tracking-tight"
            style={{ fontSize: 'clamp(3rem, 12vw, 160px)' }}
          >
            Quem somos
          </h2>
        </FadeIn>
        <AnimatedText
          text={ABOUT_TEXT}
          className="max-w-[560px] text-center font-medium leading-relaxed text-ink"
          style={{ fontSize: 'clamp(1rem, 2vw, 1.35rem)' }}
        />
      </div>

      <div className="relative z-10 mt-16 sm:mt-20 md:mt-24">
        <FadeIn delay={0.2} y={20}>
          <ContactButton />
        </FadeIn>
      </div>
    </section>
  )
}
