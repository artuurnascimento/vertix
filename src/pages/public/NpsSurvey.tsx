import { useState } from 'react'
import type { ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { CircleSlash, Heart, RotateCw } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import LogoMark from '../../components/ui/LogoMark'

const INVALID_UUID_CODE = '22P02'

interface NpsData {
  status: 'pendente' | 'respondido'
  score: number | null
  comentario: string | null
  projeto_nome: string
  cliente_nome: string
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-bg px-4 py-10 font-kanit sm:px-6 sm:py-16">
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
        <h1 className="hero-heading mt-6 text-2xl font-bold sm:text-3xl">{title}</h1>
        <p className="mt-3 max-w-sm text-sm font-light leading-relaxed text-muted">
          {message}
        </p>
      </motion.div>
    </Shell>
  )
}

/** Cor do botão de nota conforme a faixa NPS (detrator/neutro/promotor). */
function scoreClasses(n: number, selected: boolean): string {
  const base =
    'flex h-11 w-full items-center justify-center rounded-lg border text-sm font-semibold tabular-nums transition-all duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent'
  if (selected) {
    if (n <= 6) return `${base} border-red-400/50 bg-red-400/20 text-red-200`
    if (n <= 8) return `${base} border-amber-400/50 bg-amber-400/20 text-amber-200`
    return `${base} border-emerald-400/50 bg-emerald-400/20 text-emerald-200`
  }
  return `${base} border-white/10 bg-surface-2 text-muted hover:border-white/25 hover:text-ink`
}

export default function NpsSurvey() {
  const { token } = useParams<{ token: string }>()
  const queryClient = useQueryClient()
  const [score, setScore] = useState<number | null>(null)
  const [comentario, setComentario] = useState('')

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['nps', token],
    queryFn: async (): Promise<NpsData> => {
      const { data, error } = await supabase.rpc('get_nps_by_token', {
        p_token: token as string,
      })
      if (error) throw error
      return data as unknown as NpsData
    },
    retry: false,
  })

  const submit = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('submit_nps', {
        p_token: token as string,
        p_score: score as number,
        p_comentario: comentario,
      })
      if (error) throw new Error(error.message)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['nps', token] })
    },
  })

  if (isLoading) {
    return (
      <Shell>
        <div className="mt-14 h-72 animate-pulse rounded-2xl bg-surface-1 sm:mt-20" />
      </Shell>
    )
  }

  if (isError) {
    const code = (error as { code?: string } | null)?.code
    const invalid = code === INVALID_UUID_CODE
    return (
      <StatusScreen
        icon={<CircleSlash className="h-12 w-12 text-muted/40" />}
        title={invalid ? 'Link inválido' : 'Pesquisa não encontrada'}
        message="Verifique se o link está completo ou fale com a Vertix."
      />
    )
  }

  const survey = data as NpsData

  if (survey.status === 'respondido' || submit.isSuccess) {
    return (
      <StatusScreen
        icon={<Heart className="h-12 w-12 text-accent" />}
        title="Obrigado pelo retorno!"
        message="Sua avaliação nos ajuda a entregar cada vez melhor. Um abraço da equipe Vertix."
      />
    )
  }

  return (
    <Shell>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
        className="mt-12 rounded-2xl border border-white/5 bg-surface-1 px-6 py-10 sm:mt-16 sm:px-10"
      >
        <p className="text-xs font-medium uppercase tracking-[0.3em] text-accent">
          Pesquisa de satisfação
        </p>
        <h1 className="hero-heading mt-4 text-2xl font-bold leading-tight sm:text-3xl">
          Olá {survey.cliente_nome.split(' ')[0]}, como foi a entrega de{' '}
          <span className="text-accent">{survey.projeto_nome}</span>?
        </h1>
        <p className="mt-3 text-sm font-light leading-relaxed text-muted">
          De 0 a 10, o quanto você recomendaria a Vertix para um amigo ou colega?
        </p>

        <div className="mt-8 grid grid-cols-6 gap-2 sm:grid-cols-11">
          {Array.from({ length: 11 }, (_, n) => (
            <button
              key={n}
              type="button"
              onClick={() => setScore(n)}
              aria-pressed={score === n}
              aria-label={`Nota ${n}`}
              className={scoreClasses(n, score === n)}
            >
              {n}
            </button>
          ))}
        </div>
        <div className="mt-2 flex justify-between text-[11px] font-light text-muted/70">
          <span>Nada provável</span>
          <span>Muito provável</span>
        </div>

        <label className="mt-8 block text-sm font-medium text-ink">
          Quer contar o porquê? <span className="text-muted">(opcional)</span>
          <textarea
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            rows={3}
            placeholder="O que mais gostou ou o que poderíamos melhorar…"
            className="mt-2 w-full rounded-lg border border-white/5 bg-surface-2 px-4 py-3 text-base text-ink placeholder:text-muted/40 outline-none transition-all duration-200 focus:border-accent/60 focus:ring-2 focus:ring-accent/25 hover:border-white/10"
          />
        </label>

        <AnimatePresence>
          {submit.isError && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="mt-4 text-sm text-red-400"
            >
              Não foi possível registrar. Tente novamente.
            </motion.p>
          )}
        </AnimatePresence>

        <button
          type="button"
          onClick={() => submit.mutate()}
          disabled={score === null || submit.isPending}
          className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-6 py-3.5 text-sm font-semibold text-white transition-all duration-200 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {submit.isPending ? (
            <>
              <RotateCw className="h-4 w-4 animate-spin" />
              Enviando…
            </>
          ) : (
            'Enviar avaliação'
          )}
        </button>
      </motion.div>
    </Shell>
  )
}
