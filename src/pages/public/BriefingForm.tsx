import { useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { CheckCheck, LinkIcon } from 'lucide-react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import LogoMark from '../../components/ui/LogoMark'
import {
  parseBriefingByToken,
  parseSubmitResult,
} from '../../lib/briefing'
import type { BriefingPergunta } from '../../lib/briefing'

/** Código Postgres para uuid malformado — tratado como link inválido. */
const INVALID_UUID_CODE = '22P02'

const FIELD_STAGGER_S = 0.05

type FieldElement = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement

const fieldClass =
  'w-full rounded-lg border border-white/5 bg-surface-2 px-4 py-3 text-sm text-ink placeholder:text-muted/40 outline-none transition-all duration-200 focus:border-accent/60 focus:ring-2 focus:ring-accent/25 hover:border-white/10'

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-bg px-4 py-10 font-kanit sm:px-6 sm:py-16">
      <div className="mx-auto w-full max-w-2xl">
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
}: {
  icon: ReactNode
  title: string
  message: string
}) {
  return (
    <Shell>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
        className="mt-14 flex flex-col items-center rounded-2xl border border-white/5 bg-surface-1 px-6 py-16 text-center sm:mt-20"
      >
        {icon}
        <h1 className="hero-heading mt-6 text-2xl font-bold sm:text-3xl">
          {title}
        </h1>
        <p className="mt-3 max-w-sm text-sm font-light leading-relaxed text-muted">
          {message}
        </p>
      </motion.div>
    </Shell>
  )
}

function SuccessCheck() {
  return (
    <span className="flex h-16 w-16 items-center justify-center rounded-full border border-emerald-400/25 bg-emerald-400/10">
      <motion.svg
        viewBox="0 0 24 24"
        fill="none"
        className="h-7 w-7"
        aria-hidden
      >
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
      message="Recebemos seu briefing. A equipe Vertix entra em contato em breve."
    />
  )
}

interface BriefingFieldProps {
  pergunta: BriefingPergunta
  value: string
  error?: string
  index: number
  onChange: (value: string) => void
  registerRef: (element: FieldElement | null) => void
}

function BriefingField({
  pergunta,
  value,
  error,
  index,
  onChange,
  registerRef,
}: BriefingFieldProps) {
  const errorId = `erro-${pergunta.id}`
  const shared = {
    id: `campo-${pergunta.id}`,
    'aria-invalid': Boolean(error),
    'aria-describedby': error ? errorId : undefined,
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * FIELD_STAGGER_S }}
      className="flex flex-col gap-2"
    >
      <label
        htmlFor={`campo-${pergunta.id}`}
        className="text-sm font-medium leading-snug text-ink"
      >
        {pergunta.label}
        {pergunta.obrigatoria && (
          <span aria-hidden className="ml-1 text-accent">
            *
          </span>
        )}
      </label>

      {pergunta.tipo === 'texto' && (
        <input
          {...shared}
          ref={registerRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Sua resposta"
          className={fieldClass}
        />
      )}

      {pergunta.tipo === 'numero' && (
        <input
          {...shared}
          ref={registerRef}
          type="number"
          inputMode="numeric"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0"
          className={fieldClass}
        />
      )}

      {pergunta.tipo === 'textarea' && (
        <textarea
          {...shared}
          ref={registerRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
          placeholder="Conte com detalhes…"
          className={`${fieldClass} min-h-28 resize-y leading-relaxed`}
        />
      )}

      {pergunta.tipo === 'select' && (
        <select
          {...shared}
          ref={registerRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`${fieldClass} appearance-none`}
        >
          <option value="">Selecionar…</option>
          {(pergunta.opcoes ?? []).map((opcao) => (
            <option key={opcao} value={opcao}>
              {opcao}
            </option>
          ))}
        </select>
      )}

      {error && (
        <span id={errorId} className="text-xs text-red-400">
          {error}
        </span>
      )}
    </motion.div>
  )
}

export default function BriefingForm() {
  const { token } = useParams<{ token: string }>()
  const [values, setValues] = useState<Record<string, string>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [rootError, setRootError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState<'success' | 'ja_preenchido' | null>(
    null
  )
  const fieldRefs = useRef(new Map<string, FieldElement>())

  const { data, isLoading, isError } = useQuery({
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

  if (isError || !data) return <InvalidLinkScreen />
  if (data.briefing.status === 'preenchido') return <AlreadySubmittedScreen />

  const { perguntas, projeto_nome: projetoNome } = data

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setRootError(null)

    const nextErrors: Record<string, string> = {}
    for (const pergunta of perguntas) {
      const value = (values[pergunta.id] ?? '').trim()
      if (pergunta.obrigatoria && value === '') {
        nextErrors[pergunta.id] =
          pergunta.tipo === 'select'
            ? 'Selecione uma opção para continuar.'
            : 'Este campo é obrigatório.'
      }
    }
    setErrors(nextErrors)

    const firstInvalid = perguntas.find((p) => nextErrors[p.id])
    if (firstInvalid) {
      const element = fieldRefs.current.get(firstInvalid.id)
      element?.focus()
      element?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }

    const respostas: Record<string, string> = {}
    for (const pergunta of perguntas) {
      const value = (values[pergunta.id] ?? '').trim()
      if (value !== '') respostas[pergunta.id] = value
    }
    mutation.mutate(respostas)
  }

  return (
    <Shell>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
        className="mt-10 sm:mt-14"
      >
        <h1 className="hero-heading text-3xl font-bold leading-tight sm:text-4xl">
          Briefing — {projetoNome}
        </h1>
        <p className="mt-3 text-sm font-light leading-relaxed text-muted">
          Suas respostas orientam cada decisão do projeto — leva poucos
          minutos.
        </p>

        <form
          onSubmit={handleSubmit}
          noValidate
          className="mt-8 rounded-2xl border border-white/5 bg-surface-1 p-5 shadow-[0_24px_80px_-40px_rgba(108,91,242,0.3)] sm:p-8"
        >
          <div className="flex flex-col gap-7">
            {perguntas.map((pergunta, index) => (
              <BriefingField
                key={pergunta.id}
                pergunta={pergunta}
                index={index}
                value={values[pergunta.id] ?? ''}
                error={errors[pergunta.id]}
                onChange={(value) =>
                  setValues((prev) => ({ ...prev, [pergunta.id]: value }))
                }
                registerRef={(element) => {
                  if (element) fieldRefs.current.set(pergunta.id, element)
                  else fieldRefs.current.delete(pergunta.id)
                }}
              />
            ))}
          </div>

          {rootError && (
            <p
              role="alert"
              className="mt-6 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm text-red-400"
            >
              {rootError}
            </p>
          )}

          <div className="mt-8 flex flex-col gap-3">
            <button
              type="submit"
              disabled={mutation.isPending}
              className="w-full rounded-lg bg-accent px-5 py-3.5 text-sm font-semibold text-white shadow-[0_8px_24px_-8px_rgba(108,91,242,0.6)] transition-all duration-200 hover:bg-accent-2 hover:shadow-[0_10px_28px_-8px_rgba(85,70,224,0.7)] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              {mutation.isPending ? 'Enviando…' : 'Enviar briefing'}
            </button>
            <p className="text-center text-[11px] font-light text-muted/70">
              Campos marcados com <span className="text-accent">*</span> são
              obrigatórios.
            </p>
          </div>
        </form>
      </motion.div>
    </Shell>
  )
}
