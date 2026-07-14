import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { normalizeValorHora, VALOR_HORA_KEY, valorHoraSchema } from './settingsSchema'

const inputClass =
  'w-full rounded-lg border border-white/5 bg-surface-2 py-3 pl-10 pr-4 text-base text-ink placeholder:text-muted/50 outline-none transition-colors duration-200 focus:border-accent/60 focus:ring-2 focus:ring-accent/25 disabled:cursor-not-allowed disabled:opacity-60 sm:py-2.5 sm:text-sm'

const labelClass = 'text-[11px] font-medium uppercase tracking-widest text-muted'

interface BillingSettingsCardProps {
  value: string
  isAdmin: boolean
}

export default function BillingSettingsCard({
  value: initialValue,
  isAdmin,
}: BillingSettingsCardProps) {
  const queryClient = useQueryClient()
  const prefersReducedMotion = useReducedMotion()
  const [value, setValue] = useState(initialValue)
  const [error, setError] = useState<string | null>(null)
  const [rootError, setRootError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<number | null>(null)

  useEffect(() => {
    setValue(initialValue)
  }, [initialValue])

  const isDirty = value !== initialValue

  const mutation = useMutation({
    mutationFn: async (raw: string) => {
      const normalized = normalizeValorHora(raw)
      const { error: upsertError } = await supabase
        .from('settings')
        .upsert({ chave: VALOR_HORA_KEY, valor: normalized }, { onConflict: 'chave' })
      if (upsertError) throw new Error(upsertError.message)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['settings'] })
      setSavedAt(Date.now())
      setRootError(null)
    },
    onError: () => {
      setRootError('Não foi possível salvar o valor da hora. Tente novamente.')
    },
  })

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setRootError(null)
    const parsed = valorHoraSchema.safeParse(value)
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Valor inválido.')
      return
    }
    setError(null)
    mutation.mutate(parsed.data)
  }

  return (
    <motion.section
      initial={prefersReducedMotion ? undefined : { opacity: 0, y: 8 }}
      animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1], delay: prefersReducedMotion ? 0 : 0.05 }}
      className="rounded-2xl border border-white/5 bg-surface-1 p-6 sm:p-7"
    >
      <div>
        <h2 className="text-lg font-semibold text-ink">Faturamento</h2>
        <p className="mt-0.5 text-xs font-light text-muted">
          Usado no cálculo de rentabilidade dos projetos.
        </p>
      </div>

      {!isAdmin && (
        <p
          role="status"
          className="mt-4 rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-xs text-muted"
        >
          Apenas administradores podem editar o valor da hora.
        </p>
      )}

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4 sm:max-w-xs">
        <label className="flex flex-col gap-1.5">
          <span className={labelClass}>Valor da hora</span>
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-muted">
              R$
            </span>
            <input
              type="text"
              inputMode="decimal"
              value={value}
              disabled={!isAdmin}
              onChange={(e) => {
                setValue(e.target.value)
                setSavedAt(null)
              }}
              placeholder="150"
              className={inputClass}
            />
          </div>
          {error && <span className="text-xs text-red-400">{error}</span>}
        </label>

        {rootError && (
          <p
            role="alert"
            className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm text-red-400"
          >
            {rootError}
          </p>
        )}

        {isAdmin && (
          <div className="flex items-center justify-end gap-3">
            {savedAt && !isDirty && (
              <span className="text-xs font-medium text-emerald-400">
                Alterações salvas.
              </span>
            )}
            <button
              type="submit"
              disabled={!isDirty || mutation.isPending}
              className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_24px_-8px_rgba(108,91,242,0.6)] transition-all duration-200 hover:bg-accent-2 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {mutation.isPending ? 'Salvando…' : 'Salvar alterações'}
            </button>
          </div>
        )}
      </form>
    </motion.section>
  )
}
