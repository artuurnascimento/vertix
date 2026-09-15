import { useEffect, useState } from 'react'
import { MotionConfig, animate, motion } from 'framer-motion'
import type { Variants } from 'framer-motion'
import { Mail, Rocket, ShieldCheck, Sparkles } from 'lucide-react'
import { FaWhatsapp } from 'react-icons/fa'
import LogoMark from '@/components/ui/LogoMark'
import { EMAIL_VERTIX, LINK_WHATSAPP, PROGRESSO_SITE } from '@/config/site'
import IlustracaoObra from './IlustracaoObra'
import './em-construcao.css'

/**
 * Página de bloqueio "Estamos em construção": substitui o site inteiro
 * enquanto SITE_EM_CONSTRUCAO estiver ligado (ver src/config/site.ts).
 * Entrada em cascata com framer-motion; a ilustração anima em CSS.
 */

const EASE = [0.16, 1, 0.3, 1] as const

const lista: Variants = {
  oculto: {},
  visivel: { transition: { staggerChildren: 0.12, delayChildren: 0.15 } },
}

const item: Variants = {
  oculto: { opacity: 0, y: 22, filter: 'blur(6px)' },
  visivel: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.8, ease: EASE },
  },
}

const DESTAQUES = [
  { Icone: Rocket, rotulo: 'Mais performance' },
  { Icone: Sparkles, rotulo: 'Novas funcionalidades' },
  { Icone: ShieldCheck, rotulo: 'Melhor experiência' },
]

function useContagem(alvo: number, atraso: number, duracao: number) {
  const [valor, setValor] = useState(0)
  useEffect(() => {
    const controle = animate(0, alvo, {
      delay: atraso,
      duration: duracao,
      ease: EASE,
      onUpdate: (v) => setValor(Math.round(v)),
    })
    return () => controle.stop()
  }, [alvo, atraso, duracao])
  return valor
}

export default function EmConstrucao() {
  const progresso = useContagem(PROGRESSO_SITE, 0.9, 1.6)

  useEffect(() => {
    const anterior = document.title
    document.title = 'Vertix — Estamos em construção'
    return () => {
      document.title = anterior
    }
  }, [])

  return (
    <MotionConfig reducedMotion="user">
      <div className="relative min-h-[100dvh] overflow-hidden bg-bg font-kanit text-ink">
        <div aria-hidden="true" className="ec-fundo pointer-events-none absolute inset-0" />
        <div aria-hidden="true" className="ec-grao pointer-events-none absolute inset-0" />

        <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-[1360px] flex-col px-5 sm:px-8 lg:px-12">
          <header className="flex items-center justify-between py-5 sm:py-7">
            <motion.a
              href="/"
              aria-label="Vertix"
              className="flex items-center gap-2.5"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7, ease: EASE }}
            >
              <LogoMark className="h-7 w-6" />
              <span className="text-lg font-bold uppercase tracking-[0.18em]">
                VERT<i className="not-italic text-accent">I</i>X
              </span>
            </motion.a>
            <motion.div
              className="flex items-center gap-3 text-[11px] font-medium uppercase tracking-[0.28em] text-muted"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7, ease: EASE, delay: 0.1 }}
            >
              <span className="ec-status-dot" aria-hidden="true" />
              Em construção
            </motion.div>
          </header>

          <main className="grid flex-1 items-center gap-10 py-4 lg:grid-cols-2 lg:gap-4 xl:grid-cols-[minmax(0,11fr)_minmax(0,13fr)]">
            <motion.section
              aria-labelledby="ec-titulo"
              variants={lista}
              initial="oculto"
              animate="visivel"
            >
              <motion.span variants={item} className="ec-pill">
                Novo site em breve
              </motion.span>

              <h1 id="ec-titulo" className="ec-titulo mt-6">
                <motion.span variants={item} className="ec-titulo-claro block whitespace-nowrap">
                  Estamos em
                </motion.span>
                <motion.span variants={item} className="ec-titulo-acento block whitespace-nowrap">
                  construção.
                </motion.span>
              </h1>

              <motion.p
                variants={item}
                className="mt-6 max-w-md text-base font-light leading-relaxed text-ink/80 sm:text-lg"
              >
                Estamos preparando algo novo para você.
                <br className="hidden sm:block" /> Em breve, este site estará no ar.
              </motion.p>

              <motion.div variants={item} className="mt-8 max-w-md">
                <div className="flex items-center gap-4">
                  <div
                    className="ec-barra flex-1"
                    role="progressbar"
                    aria-label="Progresso do novo site"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={progresso}
                  >
                    <motion.div
                      className="ec-barra-fill"
                      style={{ width: `${PROGRESSO_SITE}%` }}
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      transition={{ delay: 0.9, duration: 1.6, ease: EASE }}
                    >
                      <span className="ec-barra-brilho" aria-hidden="true" />
                    </motion.div>
                  </div>
                  <span className="w-11 text-right text-sm font-medium tabular-nums">
                    {progresso}%
                  </span>
                </div>
              </motion.div>

              <motion.div variants={item} className="mt-8 flex flex-wrap items-center gap-3">
                <a
                  href={LINK_WHATSAPP}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ec-btn ec-btn-primario"
                >
                  <FaWhatsapp className="h-[18px] w-[18px]" aria-hidden="true" />
                  Falar no WhatsApp
                </a>
                <a href={`mailto:${EMAIL_VERTIX}`} className="ec-btn ec-btn-fantasma">
                  <Mail className="h-4 w-4" aria-hidden="true" />
                  {EMAIL_VERTIX}
                </a>
              </motion.div>

              <motion.ul
                variants={item}
                className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4"
                aria-label="O que vem no site novo"
              >
                {DESTAQUES.map(({ Icone, rotulo }) => (
                  <li key={rotulo} className="ec-destaque">
                    <span className="ec-destaque-icone" aria-hidden="true">
                      <Icone className="h-4 w-4" />
                    </span>
                    {rotulo}
                  </li>
                ))}
              </motion.ul>
            </motion.section>

            <motion.div
              className="relative mx-auto w-full max-w-[560px] lg:max-w-none"
              initial={{ opacity: 0, y: 28, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 1.2, delay: 0.35, ease: EASE }}
            >
              <IlustracaoObra className="h-auto w-full" />
            </motion.div>
          </main>

          <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-[#22221B]/70 py-6 text-[11px] uppercase tracking-[0.22em] text-muted">
            <p className="flex items-center gap-3">
              <span className="font-semibold text-ink/80">Vertix</span>
              <span aria-hidden="true" className="h-px w-8 bg-[#22221B]" />
              <span>Estúdio de e-commerce e sistemas</span>
            </p>
            <div className="flex items-center gap-3">
              <span aria-hidden="true" className="hidden h-px w-10 bg-[#22221B] sm:block" />
              <a
                href={LINK_WHATSAPP}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="WhatsApp"
                className="ec-link-icone"
              >
                <FaWhatsapp className="h-4 w-4" />
              </a>
              <a href={`mailto:${EMAIL_VERTIX}`} aria-label="E-mail" className="ec-link-icone">
                <Mail className="h-4 w-4" />
              </a>
            </div>
          </footer>
        </div>
      </div>
    </MotionConfig>
  )
}
