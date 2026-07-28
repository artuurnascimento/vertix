import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface FeatureStep {
  step: string
  title: string
  content: string
  image: string
}

interface FeatureStepsProps {
  features: FeatureStep[]
  className?: string
}

/** Altura de scroll dedicada a cada etapa (em vh). */
const STEP_SCROLL_VH = 100

export function FeatureSteps({ features, className }: FeatureStepsProps) {
  const [current, setCurrent] = useState(0)
  const [progress, setProgress] = useState(0)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const sync = () => {
      const el = wrapperRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const range = el.offsetHeight - window.innerHeight
      if (range <= 0) return
      const value = Math.min(Math.max(-rect.top / range, 0), 0.999)
      const position = value * features.length
      const index = Math.floor(position)
      setCurrent(index)
      setProgress(Math.round((position - index) * 100))
    }
    sync()
    window.addEventListener('scroll', sync, { passive: true })
    window.addEventListener('resize', sync)
    return () => {
      window.removeEventListener('scroll', sync)
      window.removeEventListener('resize', sync)
    }
  }, [features.length])

  const goTo = (index: number) => {
    const el = wrapperRef.current
    if (!el) return
    const start = window.scrollY + el.getBoundingClientRect().top
    const range = el.offsetHeight - window.innerHeight
    window.scrollTo({
      top: start + (index / features.length) * range + 2,
      behavior: 'smooth',
    })
  }

  return (
    <div
      ref={wrapperRef}
      className={cn('relative w-full', className)}
      style={{ height: `${features.length * STEP_SCROLL_VH}vh` }}
    >
      <div className="sticky top-0 flex min-h-screen w-full items-center py-10">
        <div className="grid w-full grid-cols-1 gap-8 md:grid-cols-2 md:gap-14">
          <div className="order-2 flex flex-col justify-center gap-6 md:order-1 md:gap-7">
            {features.map((feature, index) => {
              const isActive = index === current
              const isDone = index < current
              return (
                <button
                  key={feature.step}
                  type="button"
                  onClick={() => goTo(index)}
                  aria-current={isActive ? 'step' : undefined}
                  className="group flex items-start gap-5 text-start"
                >
                  <motion.span
                    animate={{ scale: isActive ? 1.1 : 1 }}
                    transition={{ duration: 0.3 }}
                    className={cn(
                      'flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-sm font-semibold transition-colors duration-300',
                      isActive
                        ? 'border-accent bg-accent text-white'
                        : isDone
                          ? 'border-accent/40 bg-accent/10 text-accent'
                          : 'border-[#22221B] bg-[#141410] text-muted group-hover:border-accent/40',
                    )}
                  >
                    {isDone ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      String(index + 1).padStart(2, '0')
                    )}
                  </motion.span>

                  <span className="min-w-0 flex-1">
                    <motion.span
                      animate={{ opacity: isActive ? 1 : 0.4 }}
                      transition={{ duration: 0.4 }}
                      className="block"
                    >
                      <span className="block text-lg font-semibold leading-snug text-ink md:text-xl">
                        {feature.title}
                      </span>
                      <span className="mt-1 block text-sm font-light leading-relaxed text-muted md:text-[0.95rem]">
                        {feature.content}
                      </span>
                    </motion.span>
                    <span className="mt-4 block h-[2px] w-full overflow-hidden rounded-full bg-[#22221B]">
                      <span
                        className="block h-full bg-accent"
                        style={{
                          width: isActive
                            ? `${progress}%`
                            : isDone
                              ? '100%'
                              : '0%',
                          transition: 'width 75ms linear',
                        }}
                      />
                    </span>
                  </span>
                </button>
              )
            })}
          </div>

          <div
            className="relative order-1 h-[220px] overflow-hidden rounded-2xl border border-[#22221B] sm:h-[300px] md:order-2 md:h-auto md:min-h-[460px]"
            style={{ perspective: '1000px' }}
          >
            <AnimatePresence initial={false}>
              <motion.div
                key={current}
                className="absolute inset-0"
                initial={{ y: 80, opacity: 0, rotateX: -12 }}
                animate={{ y: 0, opacity: 1, rotateX: 0 }}
                exit={{ y: -80, opacity: 0, rotateX: 12 }}
                transition={{ duration: 0.5, ease: 'easeInOut' }}
              >
                <img
                  src={features[current].image}
                  alt={features[current].title}
                  width={1600}
                  height={1000}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-bg via-bg/50 to-transparent" />
                <div className="absolute bottom-5 left-6 text-start">
                  <p className="text-[11px] uppercase tracking-[0.25em] text-accent">
                    {features[current].step}
                  </p>
                  <p className="mt-1 text-lg font-semibold text-ink">
                    {features[current].title}
                  </p>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  )
}
