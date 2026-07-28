import { useState } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import FadeIn from '../ui/FadeIn'
import { FeatureSteps } from '../ui/feature-steps'
import type { FeatureStep } from '../ui/feature-steps'

type ProcessMode = 'lojas' | 'sistemas'

const MODES: Array<{ id: ProcessMode; label: string }> = [
  { id: 'lojas', label: 'Lojas Shopify' },
  { id: 'sistemas', label: 'Sistemas' },
]

const STEPS: Record<ProcessMode, FeatureStep[]> = {
  lojas: [
    {
      step: 'Etapa 01',
      title: 'Alinhamento estratégico',
      content:
        'Você recebe um briefing direto no WhatsApp pra gente entender produto, público e visão de marca. Daí sai a estratégia da loja — feita pra vender todo dia.',
      image:
        'https://images.unsplash.com/photo-1552664730-d307ca884978?q=80&w=1600&auto=format&fit=crop',
    },
    {
      step: 'Etapa 02',
      title: 'Identidade visual',
      content:
        'Criamos a cara da sua marca: paleta, tipografia, logo e ícones — tudo alinhado ao seu posicionamento no nicho.',
      image:
        'https://images.unsplash.com/photo-1561070791-2526d30994b5?q=80&w=1600&auto=format&fit=crop',
    },
    {
      step: 'Etapa 03',
      title: 'Design e construção da loja',
      content:
        'Tema Shopify sob medida, banners, vitrines, capas de coleção e artes pra redes. A loja inteira montada, com material visual completo.',
      image:
        'https://images.unsplash.com/photo-1522542550221-31fd19575a2d?q=80&w=1600&auto=format&fit=crop',
    },
    {
      step: 'Etapa 04',
      title: 'Lançamento e entrega',
      content:
        'Ajustes finais, loja no ar e um drive com todos os arquivos. Você recebe tudo pronto — estrutura, branding e performance.',
      image:
        'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?q=80&w=1600&auto=format&fit=crop',
    },
  ],
  sistemas: [
    {
      step: 'Etapa 01',
      title: 'Levantamento e diagnóstico',
      content:
        'Sentamos com quem vive a operação pra mapear processos, gargalos e o que o sistema precisa resolver de verdade.',
      image:
        'https://images.unsplash.com/photo-1531403009284-440f080d1e12?q=80&w=1600&auto=format&fit=crop',
    },
    {
      step: 'Etapa 02',
      title: 'Protótipo navegável',
      content:
        'Antes de qualquer código, você navega pelas telas e aprova o fluxo. Mudança aqui custa minutos, não semanas.',
      image:
        'https://images.unsplash.com/photo-1559028012-481c04fa702d?q=80&w=1600&auto=format&fit=crop',
    },
    {
      step: 'Etapa 03',
      title: 'Desenvolvimento em sprints',
      content:
        'Construímos em ciclos curtos, com entregas que você acompanha rodando — sem sumir por meses pra voltar com surpresa.',
      image:
        'https://images.unsplash.com/photo-1555066931-4365d14bab8c?q=80&w=1600&auto=format&fit=crop',
    },
    {
      step: 'Etapa 04',
      title: 'Deploy e treinamento',
      content:
        'Sistema em produção, equipe treinada e suporte por perto. Você assume a operação sabendo usar cada tela.',
      image:
        'https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=1600&auto=format&fit=crop',
    },
  ],
}

export default function ProcessSection() {
  const [mode, setMode] = useState<ProcessMode>('lojas')

  return (
    <section
      id="processo"
      className="flex flex-col items-center gap-10 bg-bg px-5 py-20 text-center sm:gap-12 sm:px-8 md:py-28"
    >
      <FadeIn y={40}>
        <h2
          className="hero-heading font-black uppercase leading-none tracking-tight"
          style={{ fontSize: 'clamp(3rem, 12vw, 160px)' }}
        >
          Processo
        </h2>
      </FadeIn>

      <FadeIn delay={0.15} y={20}>
        <p
          className="max-w-[640px] font-light leading-relaxed text-muted"
          style={{ fontSize: 'clamp(1rem, 2vw, 1.35rem)' }}
        >
          Do alinhamento ao lançamento — o caminho que todo projeto percorre
          aqui dentro. Escolhe a frente e vê o passo a passo.
        </p>
      </FadeIn>

      <FadeIn delay={0.25} y={20}>
        <div
          role="tablist"
          aria-label="Tipo de processo"
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
                  layoutId="process-toggle-pill"
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
        className="mx-auto w-full max-w-container"
      >
        <FeatureSteps features={STEPS[mode]} />
      </motion.div>
    </section>
  )
}
