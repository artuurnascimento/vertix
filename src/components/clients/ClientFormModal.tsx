import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { Tables } from '../../lib/database.types'
import {
  CLIENT_ORIGENS,
  clientFormToPayload,
  clientSchema,
} from '../../lib/schemas'
import type { ClientFormValues } from '../../lib/schemas'

type Client = Tables<'clients'>

interface ClientFormModalProps {
  open: boolean
  /** Cliente em edição — null/undefined = modo criação. */
  client?: Client | null
  onClose: () => void
}

type FieldErrors = Partial<Record<keyof ClientFormValues, string>>

const EMPTY_VALUES: ClientFormValues = {
  nome: '',
  empresa: '',
  email: '',
  telefone: '',
  origem: '',
}

function valuesFromClient(client: Client): ClientFormValues {
  const origem = CLIENT_ORIGENS.find((o) => o === client.origem) ?? ''
  return {
    nome: client.nome,
    empresa: client.empresa ?? '',
    email: client.email ?? '',
    telefone: client.telefone ?? '',
    origem,
  }
}

const inputClass =
  'w-full rounded-lg border border-white/5 bg-surface-2 px-4 py-3 text-base text-ink placeholder:text-muted/50 outline-none transition-colors duration-200 focus:border-accent/60 focus:ring-2 focus:ring-accent/25 sm:py-2.5 sm:text-sm'

const labelClass =
  'text-xs font-medium uppercase tracking-widest text-muted'

export default function ClientFormModal({
  open,
  client,
  onClose,
}: ClientFormModalProps) {
  const queryClient = useQueryClient()
  const [values, setValues] = useState<ClientFormValues>(EMPTY_VALUES)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [rootError, setRootError] = useState<string | null>(null)

  const isEdit = Boolean(client)

  useEffect(() => {
    if (open) {
      setValues(client ? valuesFromClient(client) : EMPTY_VALUES)
      setErrors({})
      setRootError(null)
    }
  }, [open, client])

  useEffect(() => {
    if (!open) return
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  const mutation = useMutation({
    mutationFn: async (formValues: ClientFormValues) => {
      const payload = clientFormToPayload(formValues)
      if (client) {
        const { error } = await supabase
          .from('clients')
          .update(payload)
          .eq('id', client.id)
        if (error) throw new Error(error.message)
      } else {
        const { error } = await supabase.from('clients').insert(payload)
        if (error) throw new Error(error.message)
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['clients'] })
      if (client) {
        await queryClient.invalidateQueries({ queryKey: ['client', client.id] })
      }
      onClose()
    },
    onError: () => {
      setRootError('Não foi possível salvar o cliente. Tente novamente.')
    },
  })

  const setField = (field: keyof ClientFormValues, value: string) => {
    setValues((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setRootError(null)
    const parsed = clientSchema.safeParse(values)
    if (!parsed.success) {
      const fieldErrors: FieldErrors = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof ClientFormValues
        if (!fieldErrors[key]) fieldErrors[key] = issue.message
      }
      setErrors(fieldErrors)
      const firstInvalidField = Object.keys(fieldErrors)[0]
      if (firstInvalidField) {
        const el = event.currentTarget.elements.namedItem(firstInvalidField)
        if (el instanceof HTMLElement) el.focus()
      }
      return
    }
    setErrors({})
    mutation.mutate(parsed.data)
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
            if (event.target === event.currentTarget) onClose()
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
            role="dialog"
            aria-modal="true"
            aria-label={isEdit ? 'Editar cliente' : 'Novo cliente'}
            className="w-full max-w-md rounded-2xl border border-white/5 bg-surface-1 p-7 font-kanit shadow-[0_24px_80px_-32px_rgba(108,91,242,0.35)]"
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold text-ink">
                  {isEdit ? 'Editar cliente' : 'Novo cliente'}
                </h2>
                <p className="mt-0.5 text-xs font-light text-muted">
                  {isEdit
                    ? 'Atualize os dados da conta.'
                    : 'Cadastre uma nova conta no CRM.'}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Fechar"
                className="rounded-lg p-1.5 text-muted transition-colors duration-200 hover:bg-white/5 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
              <label className="flex flex-col gap-1.5">
                <span className={labelClass}>Nome *</span>
                <input
                  type="text"
                  name="nome"
                  value={values.nome}
                  onChange={(e) => setField('nome', e.target.value)}
                  placeholder="Marina Duarte"
                  className={inputClass}
                />
                {errors.nome && (
                  <span className="text-xs text-red-400">{errors.nome}</span>
                )}
              </label>

              <label className="flex flex-col gap-1.5">
                <span className={labelClass}>Empresa</span>
                <input
                  type="text"
                  value={values.empresa}
                  onChange={(e) => setField('empresa', e.target.value)}
                  placeholder="Duarte Modas"
                  className={inputClass}
                />
              </label>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-1.5">
                  <span className={labelClass}>Email</span>
                  <input
                    type="text"
                    name="email"
                    inputMode="email"
                    value={values.email}
                    onChange={(e) => setField('email', e.target.value)}
                    placeholder="contato@empresa.com"
                    className={inputClass}
                  />
                  {errors.email && (
                    <span className="text-xs text-red-400">{errors.email}</span>
                  )}
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className={labelClass}>Telefone</span>
                  <input
                    type="tel"
                    value={values.telefone}
                    onChange={(e) => setField('telefone', e.target.value)}
                    placeholder="(11) 99999-0000"
                    className={inputClass}
                  />
                </label>
              </div>

              <label className="flex flex-col gap-1.5">
                <span className={labelClass}>Origem</span>
                <select
                  value={values.origem}
                  onChange={(e) => setField('origem', e.target.value)}
                  className={`${inputClass} appearance-none`}
                >
                  <option value="">Selecionar…</option>
                  {CLIENT_ORIGENS.map((origem) => (
                    <option key={origem} value={origem}>
                      {origem}
                    </option>
                  ))}
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
                  onClick={onClose}
                  className="rounded-lg border border-white/10 px-4 py-2.5 text-sm font-medium text-muted transition-colors duration-200 hover:bg-white/5 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={mutation.isPending}
                  className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_24px_-8px_rgba(108,91,242,0.6)] transition-all duration-200 hover:bg-accent-2 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {mutation.isPending
                    ? 'Salvando…'
                    : isEdit
                      ? 'Salvar alterações'
                      : 'Criar cliente'}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}
