import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import {
  EMPRESA_FIELD_META,
  EMPRESA_KEYS,
  empresaSchema,
  type EmpresaFormValues,
} from './settingsSchema'

type FieldErrors = Partial<Record<keyof EmpresaFormValues, string>>

const inputClass =
  'w-full rounded-lg border border-white/5 bg-surface-2 px-4 py-3 text-base text-ink placeholder:text-muted/50 outline-none transition-colors duration-200 focus:border-accent/60 focus:ring-2 focus:ring-accent/25 disabled:cursor-not-allowed disabled:opacity-60 sm:py-2.5 sm:text-sm'

const labelClass = 'text-[11px] font-medium uppercase tracking-widest text-muted'

interface CompanySettingsCardProps {
  values: EmpresaFormValues
  isAdmin: boolean
}

export default function CompanySettingsCard({
  values: initialValues,
  isAdmin,
}: CompanySettingsCardProps) {
  const queryClient = useQueryClient()
  const prefersReducedMotion = useReducedMotion()
  const [values, setValues] = useState<EmpresaFormValues>(initialValues)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [rootError, setRootError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<number | null>(null)

  useEffect(() => {
    setValues(initialValues)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(initialValues)])

  const isDirty = EMPRESA_KEYS.some((key) => values[key] !== initialValues[key])

  const mutation = useMutation({
    mutationFn: async (formValues: EmpresaFormValues) => {
      const changedKeys = EMPRESA_KEYS.filter(
        (key) => formValues[key] !== initialValues[key]
      )
      if (changedKeys.length === 0) return
      const upserts = changedKeys.map((key) => ({ chave: key, valor: formValues[key] }))
      const { error } = await supabase.from('settings').upsert(upserts, {
        onConflict: 'chave',
      })
      if (error) throw new Error(error.message)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['settings'] })
      setSavedAt(Date.now())
      setRootError(null)
    },
    onError: () => {
      setRootError('Não foi possível salvar os dados da empresa. Tente novamente.')
    },
  })

  const setField = (key: keyof EmpresaFormValues, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }))
    setSavedAt(null)
  }

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setRootError(null)
    const parsed = empresaSchema.safeParse(values)
    if (!parsed.success) {
      const fieldErrors: FieldErrors = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof EmpresaFormValues
        if (!fieldErrors[key]) fieldErrors[key] = issue.message
      }
      setErrors(fieldErrors)
      return
    }
    setErrors({})
    mutation.mutate(parsed.data)
  }

  return (
    <motion.section
      initial={prefersReducedMotion ? undefined : { opacity: 0, y: 8 }}
      animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
      className="rounded-2xl border border-white/5 bg-surface-1 p-6 sm:p-7"
    >
      <div>
        <h2 className="text-lg font-semibold text-ink">Dados da empresa</h2>
        <p className="mt-0.5 text-xs font-light text-muted">
          Usados em propostas, contratos e comunicações com clientes.
        </p>
      </div>

      {!isAdmin && (
        <p
          role="status"
          className="mt-4 rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-xs text-muted"
        >
          Apenas administradores podem editar os dados da empresa.
        </p>
      )}

      <form onSubmit={handleSubmit} className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {EMPRESA_KEYS.map((key) => {
          const meta = EMPRESA_FIELD_META[key]
          return (
            <label
              key={key}
              className={`flex flex-col gap-1.5 ${key === 'empresa_endereco' ? 'sm:col-span-2' : ''}`}
            >
              <span className={labelClass}>{meta.label}</span>
              <input
                type={meta.type}
                value={values[key]}
                disabled={!isAdmin}
                onChange={(e) => setField(key, e.target.value)}
                placeholder={meta.placeholder}
                className={inputClass}
              />
              {errors[key] && (
                <span className="text-xs text-red-400">{errors[key]}</span>
              )}
            </label>
          )
        })}

        {rootError && (
          <p
            role="alert"
            className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm text-red-400 sm:col-span-2"
          >
            {rootError}
          </p>
        )}

        {isAdmin && (
          <div className="flex items-center justify-end gap-3 sm:col-span-2">
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
