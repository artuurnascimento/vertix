import { useEffect, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { CheckCheck, LinkIcon, RotateCw } from 'lucide-react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import LogoMark from '../../components/ui/LogoMark'
import WizardIntro from '../../components/public-briefing/WizardIntro'
import WizardProgress from '../../components/public-briefing/WizardProgress'
import WizardReview from '../../components/public-briefing/WizardReview'
import QuestionField from '../../components/public-briefing/QuestionField'
import SuccessBurst from '../../components/public-briefing/SuccessBurst'
import { SPRING_SCREEN, slideVariants } from '../../components/public-briefing/motion'
import { parseBriefingByToken, parseSubmitResult } from '../../lib/briefing'
import type { BriefingPergunta } from '../../lib/briefing'

/** Código Postgres para uuid malformado — tratado como link inválido. */
const INVALID_UUID_CODE = '22P02'

/** Delay entre selecionar um card visual e avançar automaticamente. */
const AUTO_ADVANCE_MS = 350

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-bg px-4 py-8 font-kanit sm:px-6 sm:py-14">
      <div aria-hidden className="app-ambient pointer-events-none fixed inset-0" />
      <div className="relative mx-auto w-full max-w-xl">
        <header className="flex items-center gap-2.5">
          <LogoMark className="h-7 w-7" />
          <span className="text-sm font-semibold tracking-[0.35em] text-ink">
            VERTIX
          </span>
        </header>
        {children}
      </div>
    </div>
  )
}

function StatusScreen({
  icon,
  title,
  message,
  celebrate,
  onRetry,
  alert,
}: {
  icon: ReactNode
  title: string
  message: string
  /** Dispara o burst de partículas uma única vez (tela de sucesso). */
  celebrate?: boolean
  /** Quando presente, exibe botão "Recarregar" (erro de carregamento). */
  onRetry?: () => void
  /** Anuncia a tela via aria-live para leitores de tela (erro/status). */
  alert?: boolean
}) {
  const reducedMotion = useReducedMotion()
  return (
    <Shell>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
        role={alert ? 'alert' : undefined}
        className="relative mt-14 flex flex-col items-center rounded-2xl border border-white/5 bg-surface-1 px-6 py-16 text-center sm:mt-20"
      >
        {celebrate && !reducedMotion && <SuccessBurst />}
        {icon}
        <h1 className="hero-heading mt-6 text-2xl font-bold sm:text-3xl">
          {title}
        </h1>
        <p className="mt-3 max-w-sm text-sm font-light leading-relaxed text-muted">
          {message}
        </p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-6 touch-manipulation rounded-lg bg-accent px-5 py-3 text-sm font-semibold text-white shadow-[0_8px_24px_-8px_rgba(108,91,242,0.6)] transition-colors duration-200 hover:bg-accent-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Recarregar
          </button>
        )}
      </motion.div>
    </Shell>
  )
}

function SuccessCheck() {
  return (
    <span className="flex h-16 w-16 items-center justify-center rounded-full border border-emerald-400/25 bg-emerald-400/10">
      <motion.svg viewBox="0 0 24 24" fill="none" className="h-7 w-7" aria-hidden>
        <motion.path
          d="M4 12.5 9.5 18 20 6.5"
          stroke="#34d399"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.6, delay: 0.15, ease: 'easeOut' }}
        />
      </motion.svg>
    </span>
  )
}

function InvalidLinkScreen() {
  return (
    <StatusScreen
      icon={
        <span className="flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-white/5">
          <LinkIcon className="h-6 w-6 text-muted" />
        </span>
      }
      title="Link inválido ou expirado"
      message="Este link de briefing não é válido. Peça um novo link para a equipe Vertix."
    />
  )
}

function LoadErrorScreen({ onRetry }: { onRetry: () => void }) {
  return (
    <StatusScreen
      alert
      icon={
        <span className="flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-white/5">
          <RotateCw className="h-6 w-6 text-muted" />
        </span>
      }
      title="Não foi possível carregar o briefing"
      message="Houve um problema de conexão. Tente novamente."
      onRetry={onRetry}
    />
  )
}

function AlreadySubmittedScreen() {
  return (
    <StatusScreen
      icon={
        <span className="flex h-16 w-16 items-center justify-center rounded-full border border-emerald-400/25 bg-emerald-400/10">
          <CheckCheck className="h-6 w-6 text-emerald-300" />
        </span>
      }
      title="Briefing já enviado — obrigado!"
      message="Já recebemos suas respostas. A equipe Vertix entra em contato em breve."
    />
  )
}

function SuccessScreen() {
  return (
    <StatusScreen
      icon={<SuccessCheck />}
      title="Briefing enviado!"
      message="Recebemos seu briefing. Foi um prazer ouvir sobre seu projeto — a equipe Vertix entra em contato em breve."
      celebrate
    />
  )
}

// ---------------------------------------------------------------------------
// Wizard — uma pergunta por tela
// ---------------------------------------------------------------------------

type WizardStage =
  | { kind: 'intro' }
  | { kind: 'pergunta'; index: number }
  | { kind: 'revisao' }

interface BriefingWizardProps {
  perguntas: BriefingPergunta[]
  projetoNome: string
  isSubmitting: boolean
  rootError: string | null
  onSubmit: (respostas: Record<string, string>) => void
}

const ghostButtonClass =
  'min-h-11 touch-manipulation rounded-lg px-4 py-2.5 text-sm font-medium text-muted transition-colors hover:bg-white/5 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'

function BriefingWizard({
  perguntas,
  projetoNome,
  isSubmitting,
  rootError,
  onSubmit,
}: BriefingWizardProps) {
  const reducedMotion = useReducedMotion()
  const [stage, setStage] = useState<WizardStage>({ kind: 'intro' })
  const [direction, setDirection] = useState(1)
  const [values, setValues] = useState<Record<string, string>>({})
  const [stepError, setStepError] = useState<string | null>(null)
  const [shakeKey, setShakeKey] = useState(0)
  const [fromReview, setFromReview] = useState(false)
  const autoAdvanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearAutoAdvance = () => {
    if (autoAdvanceTimer.current) {
      clearTimeout(autoAdvanceTimer.current)
      autoAdvanceTimer.current = null
    }
  }
  useEffect(() => clearAutoAdvance, [])

  const goTo = (next: WizardStage, dir: number) => {
    clearAutoAdvance()
    setDirection(dir)
    setStepError(null)
    setStage(next)
  }

  /** Avança sem validar (Pular, auto-avanço visual e pós-validação). */
  const goForward = () => {
    if (stage.kind !== 'pergunta') return
    if (fromReview) {
      setFromReview(false)
      goTo({ kind: 'revisao' }, 1)
      return
    }
    if (stage.index >= perguntas.length - 1) {
      goTo({ kind: 'revisao' }, 1)
      return
    }
    goTo({ kind: 'pergunta', index: stage.index + 1 }, 1)
  }

  /** Continuar: valida a pergunta atual antes de avançar. */
  const advance = () => {
    if (stage.kind !== 'pergunta') return
    const pergunta = perguntas[stage.index]
    const vazio = (values[pergunta.id] ?? '').trim() === ''
    if (pergunta.obrigatoria && vazio) {
      setStepError(
        pergunta.tipo === 'select' || pergunta.tipo === 'escolha_visual'
          ? 'Escolha uma das opções para continuar.'
          : 'Essa a gente precisa saber para continuar.'
      )
      setShakeKey((k) => k + 1)
      return
    }
    goForward()
  }

  const back = () => {
    if (stage.kind === 'revisao') {
      goTo({ kind: 'pergunta', index: perguntas.length - 1 }, -1)
      return
    }
    if (stage.kind !== 'pergunta') return
    if (fromReview) {
      setFromReview(false)
      goTo({ kind: 'revisao' }, -1)
      return
    }
    if (stage.index > 0) goTo({ kind: 'pergunta', index: stage.index - 1 }, -1)
  }

  const handleVisualSelect = (perguntaId: string, valor: string) => {
    setValues((prev) => ({ ...prev, [perguntaId]: valor }))
    setStepError(null)
    clearAutoAdvance()
    autoAdvanceTimer.current = setTimeout(goForward, AUTO_ADVANCE_MS)
  }

  const handleSubmit = () => {
    const respostas: Record<string, string> = {}
    for (const pergunta of perguntas) {
      const value = (values[pergunta.id] ?? '').trim()
      if (value !== '') respostas[pergunta.id] = value
    }
    onSubmit(respostas)
  }

  const variants = slideVariants(reducedMotion)

  const stageKey =
    stage.kind === 'pergunta' ? `pergunta-${stage.index}` : stage.kind

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
      className="mt-8 sm:mt-12"
    >
      {stage.kind !== 'intro' && (
        <WizardProgress
          current={stage.kind === 'pergunta' ? stage.index : 0}
          total={perguntas.length}
          isReview={stage.kind === 'revisao'}
        />
      )}

      <AnimatePresence mode="popLayout" initial={false} custom={direction}>
        <motion.div
          key={stageKey}
          custom={direction}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={reducedMotion ? { duration: 0.12 } : SPRING_SCREEN}
        >
          {stage.kind === 'intro' && (
            <WizardIntro
              projetoNome={projetoNome}
              totalPerguntas={perguntas.length}
              onStart={() => goTo({ kind: 'pergunta', index: 0 }, 1)}
            />
          )}

          {stage.kind === 'pergunta' && (() => {
            const pergunta = perguntas[stage.index]
            const errorId = stepError ? `erro-${pergunta.id}` : undefined
            const handleFormSubmit = (event: FormEvent<HTMLFormElement>) => {
              event.preventDefault()
              advance()
            }
            return (
              <form
                onSubmit={handleFormSubmit}
                noValidate
                className="flex min-h-[340px] flex-col rounded-2xl border border-white/5 bg-surface-1 p-5 shadow-[0_24px_80px_-40px_rgba(108,91,242,0.3)] sm:p-8"
              >
                <motion.div
                  key={shakeKey}
                  animate={
                    shakeKey > 0 && !reducedMotion
                      ? { x: [0, -8, 8, -5, 5, 0] }
                      : { x: 0 }
                  }
                  transition={{ duration: 0.4 }}
                >
                  <QuestionField
                    pergunta={pergunta}
                    value={values[pergunta.id] ?? ''}
                    errorId={errorId}
                    onChange={(value) =>
                      setValues((prev) => ({ ...prev, [pergunta.id]: value }))
                    }
                    onAdvance={advance}
                    onVisualSelect={(valor) =>
                      handleVisualSelect(pergunta.id, valor)
                    }
                  />
                </motion.div>

                <div aria-live="polite" className="mt-3 min-h-6">
                  {stepError && (
                    <p
                      id={`erro-${pergunta.id}`}
                      role="alert"
                      className="text-sm text-red-400"
                    >
                      {stepError}
                    </p>
                  )}
                </div>

                <div className="mt-auto flex items-center gap-2 pt-6">
                  {(stage.index > 0 || fromReview) && (
                    <button type="button" onClick={back} className={ghostButtonClass}>
                      Voltar
                    </button>
                  )}
                  <div className="flex-1" />
                  {!pergunta.obrigatoria && (
                    <button
                      type="button"
                      onClick={goForward}
                      className={`${ghostButtonClass} text-xs`}
                    >
                      Pular
                    </button>
                  )}
                  <motion.button
                    type="submit"
                    whileHover={reducedMotion ? undefined : { scale: 1.02, y: -1 }}
                    whileTap={reducedMotion ? undefined : { scale: 0.98 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 24 }}
                    className="min-h-11 touch-manipulation rounded-lg bg-accent px-6 py-3 text-sm font-semibold text-white shadow-[0_8px_24px_-8px_rgba(108,91,242,0.6)] transition-colors duration-200 hover:bg-accent-2 hover:shadow-[0_10px_28px_-8px_rgba(85,70,224,0.7)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  >
                    Continuar
                  </motion.button>
                </div>
              </form>
            )
          })()}

          {stage.kind === 'revisao' && (
            <WizardReview
              perguntas={perguntas}
              values={values}
              isSubmitting={isSubmitting}
              rootError={rootError}
              onEdit={(index) => {
                setFromReview(true)
                goTo({ kind: 'pergunta', index }, -1)
              }}
              onBack={back}
              onSubmit={handleSubmit}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// Página pública — busca por token, estados e envio
// ---------------------------------------------------------------------------

export default function BriefingForm() {
  const { token } = useParams<{ token: string }>()
  const [rootError, setRootError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState<'success' | 'ja_preenchido' | null>(
    null
  )

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['public-briefing', token],
    enabled: Boolean(token),
    retry: false,
    queryFn: async () => {
      const { data: payload, error } = await supabase.rpc(
        'get_briefing_by_token',
        { t: token ?? '' }
      )
      if (error) {
        if (error.code === INVALID_UUID_CODE) return null
        throw new Error(error.message)
      }
      return parseBriefingByToken(payload)
    },
  })

  const mutation = useMutation({
    mutationFn: async (respostas: Record<string, string>) => {
      const { data: payload, error } = await supabase.rpc('submit_briefing', {
        t: token ?? '',
        p_respostas: respostas,
      })
      if (error) throw new Error(error.message)
      return parseSubmitResult(payload)
    },
    onSuccess: (result) => {
      if (result.success) {
        setSubmitted('success')
        return
      }
      if (result.error === 'ja_preenchido') {
        setSubmitted('ja_preenchido')
        return
      }
      setRootError('Este link não é mais válido. Peça um novo à equipe Vertix.')
    },
    onError: () => {
      setRootError('Não foi possível enviar suas respostas. Tente novamente.')
    },
  })

  if (submitted === 'success') return <SuccessScreen />
  if (submitted === 'ja_preenchido') return <AlreadySubmittedScreen />

  if (isLoading) {
    return (
      <Shell>
        <div className="mt-14 sm:mt-20" aria-label="Carregando briefing">
          <div className="h-9 w-64 animate-pulse rounded bg-surface-2" />
          <div className="mt-3 h-4 w-80 max-w-full animate-pulse rounded bg-surface-2" />
          <div className="mt-8 h-96 animate-pulse rounded-2xl bg-surface-1" />
        </div>
      </Shell>
    )
  }

  if (isError) return <LoadErrorScreen onRetry={() => refetch()} />
  if (!data) return <InvalidLinkScreen />
  if (data.briefing.status === 'preenchido') return <AlreadySubmittedScreen />

  return (
    <Shell>
      <BriefingWizard
        perguntas={data.perguntas}
        projetoNome={data.projeto_nome}
        isSubmitting={mutation.isPending}
        rootError={rootError}
        onSubmit={(respostas) => {
          setRootError(null)
          mutation.mutate(respostas)
        }}
      />
    </Shell>
  )
}
