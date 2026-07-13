import { useState } from 'react'
import type { FormEvent } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useMutation } from '@tanstack/react-query'
import { CheckCheck, LifeBuoy } from 'lucide-react'
import { supabase } from '../../lib/supabase'

/**
 * Seção "Precisa de ajuda?" do portal (Fase 19) — form colapsado que abre
 * um chamado de suporte sem exigir login. Permite abrir novos chamados
 * depois de uma confirmação (reseta o form ao invés de travar a seção).
 */

const inputClass =
  'w-full rounded-lg border border-white/5 bg-surface-2 px-4 py-3 text-sm text-ink placeholder:text-muted/40 outline-none transition-all duration-200 focus:border-accent/60 focus:ring-2 focus:ring-accent/25 hover:border-white/10'

interface PortalTicketFormProps {
  token: string
}

function ConfirmationBanner({ onNovoChamado }: { onNovoChamado: () => void }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-emerald-400/25 bg-emerald-400/10 px-5 py-6 text-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-full border border-emerald-400/25 bg-emerald-400/10">
        <CheckCheck aria-hidden className="h-[18px] w-[18px] text-emerald-300" />
      </span>
      <p className="text-sm font-medium text-ink">Chamado recebido</p>
      <p className="max-w-xs text-xs font-light leading-relaxed text-muted">
        Retornaremos em breve.
      </p>
      <button
        type="button"
        onClick={onNovoChamado}
        className="mt-1 text-xs font-medium text-accent transition-colors duration-200 hover:text-accent-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        Abrir novo chamado
      </button>
    </div>
  )
}

export default function PortalTicketForm({ token }: PortalTicketFormProps) {
  const [open, setOpen] = useState(false)
  const [titulo, setTitulo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [tituloError, setTituloError] = useState<string | null>(null)
  const [rootError, setRootError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('create_ticket', {
        p_token: token,
        p_titulo: titulo.trim(),
        p_descricao: descricao.trim(),
      })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      setRootError(null)
      setSent(true)
    },
    onError: () => {
      setRootError('Não foi possível enviar seu chamado. Tente novamente.')
    },
  })

  const resetForm = () => {
    setTitulo('')
    setDescricao('')
    setTituloError(null)
    setRootError(null)
    setSent(false)
    setOpen(false)
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (titulo.trim() === '') {
      setTituloError('Conte pra gente o assunto do chamado.')
      return
    }
    setTituloError(null)
    mutation.mutate()
  }

  if (sent) return <ConfirmationBanner onNovoChamado={resetForm} />

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3.5 rounded-xl border border-white/5 bg-surface-2 p-4 text-left transition-colors duration-200 hover:bg-white/5"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5">
          <LifeBuoy aria-hidden className="h-[18px] w-[18px] text-muted" />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-medium text-ink">
            Precisa de ajuda?
          </span>
          <span className="mt-0.5 block text-xs font-light text-muted">
            Abra um chamado e a equipe Vertix retorna em breve.
          </span>
        </span>
      </button>
    )
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.form
        key="ticket-form"
        onSubmit={handleSubmit}
        noValidate
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="rounded-xl border border-white/5 bg-surface-2 p-4"
      >
        <p className="text-sm font-medium text-ink">Abrir chamado</p>

        <label className="mt-4 flex flex-col gap-2">
          <span className="text-sm font-medium text-ink">
            Título
            <span aria-hidden className="ml-1 text-accent">
              *
            </span>
          </span>
          <input
            type="text"
            value={titulo}
            onChange={(e) => {
              setTitulo(e.target.value)
              if (tituloError) setTituloError(null)
            }}
            placeholder="Ex.: erro ao acessar o painel"
            aria-invalid={Boolean(tituloError)}
            className={inputClass}
          />
          {tituloError && (
            <span className="text-xs text-red-400">{tituloError}</span>
          )}
        </label>

        <label className="mt-4 flex flex-col gap-2">
          <span className="text-sm font-medium text-ink">Descrição</span>
          <textarea
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Detalhe o que está acontecendo (opcional)"
            rows={3}
            className={`${inputClass} resize-none`}
          />
        </label>

        {rootError && (
          <p role="alert" className="mt-3 text-xs text-red-400">
            {rootError}
          </p>
        )}

        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setOpen(false)}
            disabled={mutation.isPending}
            className="rounded-lg px-4 py-2.5 text-sm font-medium text-muted transition-colors hover:bg-white/5 hover:text-ink disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancelar
          </button>
          <div className="flex-1" />
          <button
            type="submit"
            disabled={mutation.isPending}
            className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_24px_-8px_rgba(108,91,242,0.6)] transition-colors duration-200 hover:bg-accent-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {mutation.isPending ? 'Enviando…' : 'Enviar chamado'}
          </button>
        </div>
      </motion.form>
    </AnimatePresence>
  )
}
