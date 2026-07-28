import { useRef } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import type { MotionValue } from 'framer-motion'
import type { CSSProperties } from 'react'
import FadeIn from '../ui/FadeIn'
import LogoMark from '../ui/LogoMark'
import { LiveProjectButton } from '../ui/buttons'

interface Shot {
  from: string
  to: string
}

interface Project {
  n: string
  name: string
  cat: string
  shots: [Shot, Shot, Shot]
}

const PROJECTS: Project[] = [
  {
    n: '01',
    name: 'SAAM',
    cat: 'Sistema · Gestão ambiental',
    shots: [
      { from: '#16123F', to: '#6C5BF2' },
      { from: '#0C0C0C', to: '#5546E0' },
      { from: '#123B4F', to: '#3BB0E0' },
    ],
  },
  {
    n: '02',
    name: 'FacePass',
    cat: 'Sistema · Acesso facial',
    shots: [
      { from: '#2A1E66', to: '#8B7BF6' },
      { from: '#0F2430', to: '#3BB0E0' },
      { from: '#1D1140', to: '#6C5BF2' },
    ],
  },
  {
    n: '03',
    name: 'Orizon Gestão',
    cat: 'Sistema · Gestão empresarial',
    shots: [
      { from: '#0B1F3A', to: '#9BE22D' },
      { from: '#0C0C0C', to: '#5546E0' },
      { from: '#0B1F3A', to: '#3BB0E0' },
    ],
  },
]

const CARD_SCALE_STEP = 0.03
const CARD_TOP_OFFSET = 28

interface ShotBoxProps {
  shot: Shot
  className?: string
  style?: CSSProperties
}

function ShotBox({ shot, className = '', style }: ShotBoxProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-[40px] sm:rounded-[50px] md:rounded-[60px] ${className}`}
      style={{
        background: `linear-gradient(135deg, ${shot.from}, ${shot.to})`,
        ...style,
      }}
    >
      <LogoMark className="absolute -bottom-8 -right-6 w-32 opacity-10" />
    </div>
  )
}

interface ProjectCardProps {
  project: Project
  index: number
  total: number
  progress: MotionValue<number>
}

function ProjectCard({ project, index, total, progress }: ProjectCardProps) {
  const targetScale = 1 - (total - 1 - index) * CARD_SCALE_STEP
  const scale = useTransform(progress, [index / total, 1], [1, targetScale])

  return (
    <div className="sticky top-24 flex h-[85vh] items-start justify-center md:top-32">
      <motion.div
        style={{ scale, top: `${index * CARD_TOP_OFFSET}px` }}
        className="relative flex w-full max-w-6xl flex-col gap-6 rounded-[40px] border-2 border-ink bg-bg p-4 sm:rounded-[50px] sm:p-6 md:rounded-[60px] md:p-8"
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4 sm:gap-8">
            <span
              className="hero-heading font-black leading-none"
              style={{ fontSize: 'clamp(3rem, 10vw, 140px)' }}
            >
              {project.n}
            </span>
            <div>
              <p className="text-xs uppercase tracking-widest text-muted sm:text-sm">
                {project.cat}
              </p>
              <h3
                className="font-medium uppercase text-ink"
                style={{ fontSize: 'clamp(1.2rem, 3vw, 2.4rem)' }}
              >
                {project.name}
              </h3>
            </div>
          </div>
          <LiveProjectButton />
        </div>

        <div className="flex gap-3 sm:gap-4">
          <div className="flex w-[40%] flex-col gap-3 sm:gap-4">
            <ShotBox shot={project.shots[0]} style={{ height: 'clamp(130px, 16vw, 230px)' }} />
            <ShotBox shot={project.shots[1]} style={{ height: 'clamp(160px, 22vw, 340px)' }} />
          </div>
          <ShotBox shot={project.shots[2]} className="w-[60%]" />
        </div>
      </motion.div>
    </div>
  )
}

export default function ProjectsSection() {
  const listRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: listRef,
    offset: ['start start', 'end end'],
  })

  return (
    <section
      id="projetos"
      className="relative z-10 -mt-10 rounded-t-[40px] bg-bg px-5 pb-24 pt-20 sm:-mt-12 sm:rounded-t-[50px] sm:px-8 md:-mt-14 md:rounded-t-[60px] md:px-10"
    >
      <FadeIn y={40}>
        <h2
          className="hero-heading text-center font-black uppercase leading-none tracking-tight"
          style={{ fontSize: 'clamp(3rem, 12vw, 160px)' }}
        >
          Projetos
        </h2>
      </FadeIn>

      <div ref={listRef} className="mt-10">
        {PROJECTS.map((project, i) => (
          <ProjectCard
            key={project.n}
            project={project}
            index={i}
            total={PROJECTS.length}
            progress={scrollYProgress}
          />
        ))}
      </div>
    </section>
  )
}
