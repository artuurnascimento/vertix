import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { Tables } from '../../lib/database.types'
import { todayLocalISO } from './receivableSchema'
import {
  EMPTY_EXPENSE_VALUES,
  EXPENSE_CATEGORIAS,
  expenseFormToPayload,
  expenseSchema,
  getExpenseCategoriaMeta,
} from './expenseSchema'
import type { ExpenseFormValues } from './expenseSchema'

type Expense = Tables<'expenses'>
type ProjectOption = Pick<Tables<'projects'>, 'id' | 'nome'>

interface ExpenseFormModalProps {
  open: boolean
  /** Despesa em edição — null/undefined = modo criação. */
  expense?: Expense | null
  onClose: () => void
}

type FieldErrors = Partial<Record<keyof ExpenseFormValues, string>>

function valuesFromExpense(expense: Expense): ExpenseFormValues {
  return {
    descricao: expense.descricao,
    categoria:
      EXPENSE_CATEGORIAS.find((c) => c === expense.categoria) ?? 'outros',
    valor: String(expense.valor),
    data: expense.data,
    recorrente: expense.recorrente,
    project_id: expense.project_id ?? '',
  }
}

const inputClass =
  'w-full rounded-lg border border-white/5 bg-surface-2 px-4 py-2.5 text-sm text-ink placeholder:text-muted/50 outline-none transition-colors duration-200 focus:border-accent/60 focus:ring-2 focus:ring-accent/25'

const labelClass = 'text-xs font-medium uppercase tracking-widest text-muted'

export default function ExpenseFormModal({
  open,
  expense,
  onClose,
}: ExpenseFormModalProps) {
  const queryClient = useQueryClient()
  const [values, setValues] = useState<ExpenseFormValues>(EMPTY_EXPENSE_VALUES)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [rootError, setRootError] = useState<string | null>(null)

  const isEdit = Boolean(expense)

  useEffect(() => {
    if (open) {
      setValues(
        expense
          ? valuesFromExpense(expense)
          : { ...EMPTY_EXPENSE_VALUES, data: todayLocalISO() }
      )
      setErrors({})
      setRootError(null)
    }
  }, [open, expense])

  useEffect(() => {
    if (!open) return
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  const { data: projectOptions } = useQuery({
    queryKey: ['expenses', 'projects-options'],
    enabled: open,
    queryFn: async (): Promise<ProjectOption[]> => {
      const { data, error } = await supabase
        .from('projects')
        .select('id, nome')
        .order('nome', { ascending: true })
      if (error) throw new Error(error.message)
      return data
    },
  })

  const mutation = useMutation({
    mutationFn: async (formValues: ExpenseFormValues) => {
      const payload = expenseFormToPayload(formValues)
      if (expense) {
        const { error } = await supabase
          .from('expenses')
          .update(payload)
          .eq('id', expense.id)
        if (error) throw new Error(error.message)
      } else {
        const { error } = await supabase.from('expenses').insert(payload)
        if (error) throw new Error(error.message)
      }
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['expenses'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
      ])
      onClose()
    },
    onError: () => {
      setRootError('Não foi possível salvar a despesa. Tente novamente.')
    },
  })

  const setField = <K extends keyof ExpenseFormValues>(
    field: K,
    value: ExpenseFormValues[K]
  ) => {
    setValues((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setRootError(null)
    const parsed = expenseSchema.safeParse(values)
    if (!parsed.success) {
      const fieldErrors: FieldErrors = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof ExpenseFormValues
        if (!fieldErrors[key]) fieldErrors[key] = issue.message
      }
      setErrors(fieldErrors)
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
            aria-label={isEdit ? 'Editar despesa' : 'Nova despesa'}
            className="w-full max-w-md rounded-2xl border border-white/5 bg-surface-1 p-7 font-kanit shadow-[0_24px_80px_-32px_rgba(108,91,242,0.35)]"
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold text-ink">
                  {isEdit ? 'Editar despesa' : 'Nova despesa'}
                </h2>
                <p className="mt-0.5 text-xs font-light text-muted">
                  Custos fixos ou variáveis da operação.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Fechar"
                className="rounded-lg p-1.5 text-muted transition-colors duration-200 hover:bg-white/5 hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
              <label className="flex flex-col gap-1.5">
                <span className={labelClass}>Descrição *</span>
                <input
                  type="text"
                  value={values.descricao}
                  onChange={(e) => setField('descricao', e.target.value)}
                  placeholder="Servidor de produção"
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
                  <span className={labelClass}>Categoria *</span>
                  <select
                    value={values.categoria}
                    onChange={(e) =>
                      setField(
                        'categoria',
                        e.target.value as ExpenseFormValues['categoria']
                      )
                    }
                    className={`${inputClass} appearance-none`}
                  >
                    {EXPENSE_CATEGORIAS.map((categoria) => (
                      <option key={categoria} value={categoria}>
                        {getExpenseCategoriaMeta(categoria).label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className={labelClass}>Valor (R$) *</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    value={values.valor}
                    onChange={(e) => setField('valor', e.target.value)}
                    placeholder="150.00"
                    className={inputClass}
                  />
                  {errors.valor && (
                    <span className="text-xs text-red-400">{errors.valor}</span>
                  )}
                </label>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-1.5">
                  <span className={labelClass}>Data *</span>
                  <input
                    type="date"
                    value={values.data}
                    onChange={(e) => setField('data', e.target.value)}
                    className={`${inputClass} [color-scheme:dark]`}
                  />
                  {errors.data && (
                    <span className="text-xs text-red-400">{errors.data}</span>
                  )}
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className={labelClass}>Projeto</span>
                  <select
                    value={values.project_id}
                    onChange={(e) => setField('project_id', e.target.value)}
                    className={`${inputClass} appearance-none`}
                  >
                    <option value="">Nenhum</option>
                    {(projectOptions ?? []).map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.nome}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="flex items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={values.recorrente}
                  onChange={(e) => setField('recorrente', e.target.checked)}
                  className="h-4 w-4 rounded border-white/20 bg-surface-2 text-accent accent-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                />
                <span className="text-sm text-ink/90">
                  Despesa recorrente (repete todo mês)
                </span>
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
                  className="rounded-lg border border-white/10 px-4 py-2.5 text-sm font-medium text-muted transition-colors duration-200 hover:bg-white/5 hover:text-ink"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={mutation.isPending}
                  className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_24px_-8px_rgba(108,91,242,0.6)] transition-all duration-200 hover:bg-accent-2 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  {mutation.isPending
                    ? 'Salvando…'
                    : isEdit
                      ? 'Salvar alterações'
                      : 'Criar despesa'}
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
