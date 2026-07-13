import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { Tables } from '../../lib/database.types'
import {
  FORMAS_PAGAMENTO,
  receivableFormToPayload,
  receivableSchema,
} from './receivableSchema'
import type { ReceivableFormValues } from './receivableSchema'

type ClientOption = Pick<Tables<'clients'>, 'id' | 'nome' | 'empresa'>
type ProjectOption = Pick<Tables<'projects'>, 'id' | 'nome'>

interface ReceivableFormModalProps {
  open: boolean
  onClose: () => void
}

type FieldErrors = Partial<Record<keyof ReceivableFormValues, string>>

const EMPTY_VALUES: ReceivableFormValues = {
  client_id: '',
  project_id: '',
  descricao: '',
  valor: '',
  vencimento: '',
  forma_pagamento: '',
}

const inputClass =
  'w-full rounded-lg border border-white/5 bg-surface-2 px-4 py-3 text-base text-ink placeholder:text-muted/50 outline-none transition-colors duration-200 focus:border-accent/60 focus:ring-2 focus:ring-accent/25 sm:py-2.5 sm:text-sm'

const labelClass = 'text-xs font-medium uppercase tracking-widest text-muted'

export default function ReceivableFormModal({
  open,
  onClose,
}: ReceivableFormModalProps) {
  const queryClient = useQueryClient()
  const [values, setValues] = useState<ReceivableFormValues>(EMPTY_VALUES)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [rootError, setRootError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setValues(EMPTY_VALUES)
      setErrors({})
      setRootError(null)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  const { data: clientOptions } = useQuery({
    queryKey: ['receivables', 'clients-options'],
    enabled: open,
    queryFn: async (): Promise<ClientOption[]> => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, nome, empresa')
        .order('nome', { ascending: true })
      if (error) throw new Error(error.message)
      return data
    },
  })

  const { data: projectOptions } = useQuery({
    queryKey: ['receivables', 'projects-options', values.client_id],
    enabled: open && values.client_id !== '',
    queryFn: async (): Promise<ProjectOption[]> => {
      const { data, error } = await supabase
        .from('projects')
        .select('id, nome')
        .eq('client_id', values.client_id)
        .order('nome', { ascending: true })
      if (error) throw new Error(error.message)
      return data
    },
  })

  const mutation = useMutation({
    mutationFn: async (formValues: ReceivableFormValues) => {
      const payload = receivableFormToPayload(formValues)
      const { error } = await supabase.from('receivables').insert(payload)
      if (error) throw new Error(error.message)
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['receivables'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
      ])
      onClose()
    },
    onError: () => {
      setRootError('Não foi possível criar a cobrança. Tente novamente.')
    },
  })

  const setField = (field: keyof ReceivableFormValues, value: string) => {
    setValues((prev) => ({ ...prev, [field]: value }))
  }

  /** Trocar de cliente invalida o projeto selecionado. */
  const setClient = (clientId: string) => {
    setValues((prev) => ({ ...prev, client_id: clientId, project_id: '' }))
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setRootError(null)
    const parsed = receivableSchema.safeParse(values)
    if (!parsed.success) {
      const fieldErrors: FieldErrors = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof ReceivableFormValues
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

  const hasClient = values.client_id !== ''

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
            aria-label="Nova cobrança"
            className="w-full max-w-md rounded-2xl border border-white/5 bg-surface-1 p-7 font-kanit shadow-[0_24px_80px_-32px_rgba(108,91,242,0.35)]"
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold text-ink">
                  Nova cobrança
                </h2>
                <p className="mt-0.5 text-xs font-light text-muted">
                  O recebível nasce pendente até o pagamento.
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
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-1.5">
                  <span className={labelClass}>Cliente *</span>
                  <select
                    name="client_id"
                    value={values.client_id}
                    onChange={(e) => setClient(e.target.value)}
                    className={`${inputClass} appearance-none`}
                  >
                    <option value="">Selecionar…</option>
                    {(clientOptions ?? []).map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.empresa
                          ? `${client.nome} — ${client.empresa}`
                          : client.nome}
                      </option>
                    ))}
                  </select>
                  {errors.client_id && (
                    <span className="text-xs text-red-400">
                      {errors.client_id}
                    </span>
                  )}
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className={labelClass}>Projeto *</span>
                  <select
                    name="project_id"
                    value={values.project_id}
                    onChange={(e) => setField('project_id', e.target.value)}
                    disabled={!hasClient}
                    className={`${inputClass} appearance-none disabled:cursor-not-allowed disabled:opacity-50`}
                  >
                    <option value="">
                      {hasClient ? 'Selecionar…' : 'Escolha o cliente antes'}
                    </option>
                    {(projectOptions ?? []).map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.nome}
                      </option>
                    ))}
                  </select>
                  {errors.project_id && (
                    <span className="text-xs text-red-400">
                      {errors.project_id}
                    </span>
                  )}
                </label>
              </div>

              <label className="flex flex-col gap-1.5">
                <span className={labelClass}>Descrição *</span>
                <input
                  type="text"
                  name="descricao"
                  value={values.descricao}
                  onChange={(e) => setField('descricao', e.target.value)}
                  placeholder="Entrada — 50% do projeto"
                  className={inputClass}
                />
                {errors.descricao && (
                  <span className="text-xs text-red-400">
                    {errors.descricao}
                  </span>
                )}
              </label>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-1.5">
                  <span className={labelClass}>Valor (R$) *</span>
                  <input
                    type="number"
                    name="valor"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    value={values.valor}
                    onChange={(e) => setField('valor', e.target.value)}
                    placeholder="4500.00"
                    className={inputClass}
                  />
                  {errors.valor && (
                    <span className="text-xs text-red-400">{errors.valor}</span>
                  )}
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className={labelClass}>Vencimento *</span>
                  <input
                    type="date"
                    name="vencimento"
                    value={values.vencimento}
                    onChange={(e) => setField('vencimento', e.target.value)}
                    className={`${inputClass} [color-scheme:dark]`}
                  />
                  {errors.vencimento && (
                    <span className="text-xs text-red-400">
                      {errors.vencimento}
                    </span>
                  )}
                </label>
              </div>

              <label className="flex flex-col gap-1.5">
                <span className={labelClass}>Forma de pagamento</span>
                <select
                  value={values.forma_pagamento}
                  onChange={(e) => setField('forma_pagamento', e.target.value)}
                  className={`${inputClass} appearance-none`}
                >
                  <option value="">Selecionar…</option>
                  {FORMAS_PAGAMENTO.map((forma) => (
                    <option key={forma} value={forma}>
                      {forma}
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
                  className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_24px_-8px_rgba(108,91,242,0.6)] transition-all duration-200 hover:bg-accent-2 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  {mutation.isPending ? 'Salvando…' : 'Criar cobrança'}
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
