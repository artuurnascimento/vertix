import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, Copy, X } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

interface InviteUserModalProps {
  open: boolean
  onClose: () => void
}

type Role = 'admin' | 'colaborador'

interface InviteFormValues {
  nome: string
  email: string
  role: Role
}

interface InviteResult {
  senha_temporaria: string
  email: string
}

const EMPTY_VALUES: InviteFormValues = { nome: '', email: '', role: 'colaborador' }

const inputClass =
  'w-full rounded-lg border border-white/5 bg-surface-2 px-4 py-3 text-base text-ink placeholder:text-muted/50 outline-none transition-colors duration-200 focus:border-accent/60 focus:ring-2 focus:ring-accent/25 sm:py-2.5 sm:text-sm'

const labelClass = 'text-[11px] font-medium uppercase tracking-widest text-muted'

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  return 'Não foi possível enviar o convite. Tente novamente.'
}

export default function InviteUserModal({ open, onClose }: InviteUserModalProps) {
  const queryClient = useQueryClient()
  const [values, setValues] = useState<InviteFormValues>(EMPTY_VALUES)
  const [rootError, setRootError] = useState<string | null>(null)
  const [result, setResult] = useState<InviteResult | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (open) {
      setValues(EMPTY_VALUES)
      setRootError(null)
      setResult(null)
      setCopied(false)
    }
  }, [open])

  const handleClose = () => {
    if (result) {
      void queryClient.invalidateQueries({ queryKey: ['team-profiles'] })
    }
    onClose()
  }

  const mutation = useMutation({
    mutationFn: async (formValues: InviteFormValues) => {
      const { data, error } = await supabase.functions.invoke<{
        ok?: boolean
        error?: string
        senha_temporaria?: string
      }>('invite-user', { body: formValues })

      if (error) {
        throw new Error(
          'Função indisponível — verifique se o Supabase Functions está rodando.'
        )
      }
      if (!data?.ok || !data.senha_temporaria) {
        throw new Error(data?.error ?? 'Não foi possível enviar o convite.')
      }
      return { senha_temporaria: data.senha_temporaria, email: formValues.email }
    },
    onSuccess: (data) => {
      setResult(data)
      setRootError(null)
    },
    onError: (error: unknown) => {
      setRootError(getErrorMessage(error))
    },
  })

  const setField = <K extends keyof InviteFormValues>(
    field: K,
    value: InviteFormValues[K]
  ) => {
    setValues((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setRootError(null)
    if (!values.nome.trim() || !values.email.trim()) {
      setRootError('Preencha nome e email.')
      return
    }
    mutation.mutate(values)
  }

  const handleCopy = async () => {
    if (!result) return
    await navigator.clipboard.writeText(result.senha_temporaria)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-bg/70 px-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !mutation.isPending) handleClose()
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
            role="dialog"
            aria-modal="true"
            aria-label="Convidar membro da equipe"
            className="w-full max-w-md rounded-2xl border border-white/5 bg-surface-1 p-7 font-kanit shadow-[0_24px_80px_-32px_rgba(108,91,242,0.35)]"
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold text-ink">
                  {result ? 'Convite enviado' : 'Convidar membro'}
                </h2>
                <p className="mt-0.5 text-xs font-light text-muted">
                  {result
                    ? 'Compartilhe a senha temporária com segurança.'
                    : 'Cria acesso ao painel para um novo membro da equipe.'}
                </p>
              </div>
              <button
                type="button"
                onClick={handleClose}
                aria-label="Fechar"
                className="rounded-lg p-1.5 text-muted transition-colors duration-200 hover:bg-white/5 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {result ? (
              <div className="mt-6 flex flex-col gap-4">
                <p className="rounded-lg border border-amber-400/25 bg-amber-400/10 px-4 py-2.5 text-xs text-amber-300">
                  Guarde agora — a senha temporária não será exibida de novo.
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 truncate rounded-lg border border-white/5 bg-surface-2 px-4 py-3 font-mono text-sm text-ink">
                    {result.senha_temporaria}
                  </code>
                  <button
                    type="button"
                    onClick={handleCopy}
                    aria-label="Copiar senha temporária"
                    className="shrink-0 rounded-lg border border-white/10 p-3 text-muted transition-colors duration-200 hover:bg-white/5 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-emerald-400" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </button>
                </div>
                <p className="text-xs font-light text-muted">
                  Enviada para <span className="text-ink">{result.email}</span>.
                </p>
                <div className="mt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_24px_-8px_rgba(108,91,242,0.6)] transition-all duration-200 hover:bg-accent-2"
                  >
                    Concluir
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
                <label className="flex flex-col gap-1.5">
                  <span className={labelClass}>Nome *</span>
                  <input
                    type="text"
                    value={values.nome}
                    onChange={(e) => setField('nome', e.target.value)}
                    placeholder="Marina Duarte"
                    className={inputClass}
                  />
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className={labelClass}>Email *</span>
                  <input
                    type="email"
                    value={values.email}
                    onChange={(e) => setField('email', e.target.value)}
                    placeholder="marina@vertix.com.br"
                    className={inputClass}
                  />
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className={labelClass}>Papel</span>
                  <select
                    value={values.role}
                    onChange={(e) => setField('role', e.target.value as Role)}
                    className={`${inputClass} appearance-none`}
                  >
                    <option value="colaborador">Colaborador</option>
                    <option value="admin">Admin</option>
                  </select>
                </label>

                {rootError && (
                  <p
                    role="alert"
                    className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm text-red-400"
                  >
                    {rootError}
                  </p>
                )}

                <div className="mt-2 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="rounded-lg border border-white/10 px-4 py-2.5 text-sm font-medium text-muted transition-colors duration-200 hover:bg-white/5 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={mutation.isPending}
                    className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_24px_-8px_rgba(108,91,242,0.6)] transition-all duration-200 hover:bg-accent-2 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {mutation.isPending ? 'Enviando…' : 'Convidar'}
                  </button>
                </div>
              </form>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}
