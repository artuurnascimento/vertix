import { z } from 'zod'
import type { StatusMeta } from '../../lib/format'
import { parseValor } from './receivableSchema'

/** Categorias de despesa aceitas (mesmo check constraint do banco). */
export const EXPENSE_CATEGORIAS = [
  'hosting',
  'ferramentas',
  'trafego',
  'impostos',
  'outros',
] as const

export type ExpenseCategoria = (typeof EXPENSE_CATEGORIAS)[number]

/** Badge colorida por categoria — hosting=sky, ferramentas=accent, trafego=amber, impostos=red, outros=muted. */
export const EXPENSE_CATEGORIA_META: Record<ExpenseCategoria, StatusMeta> = {
  hosting: {
    label: 'Hosting',
    badgeClass: 'border-sky-400/20 bg-sky-400/10 text-sky-300',
    dotClass: 'bg-sky-400',
  },
  ferramentas: {
    label: 'Ferramentas',
    badgeClass: 'border-accent/25 bg-accent/10 text-accent',
    dotClass: 'bg-accent',
  },
  trafego: {
    label: 'Tráfego',
    badgeClass: 'border-amber-400/20 bg-amber-400/10 text-amber-300',
    dotClass: 'bg-amber-400',
  },
  impostos: {
    label: 'Impostos',
    badgeClass: 'border-red-400/25 bg-red-400/10 text-red-300',
    dotClass: 'bg-red-400',
  },
  outros: {
    label: 'Outros',
    badgeClass: 'border-white/10 bg-white/5 text-muted',
    dotClass: 'bg-muted',
  },
}

export function getExpenseCategoriaMeta(categoria: string): StatusMeta {
  return (
    EXPENSE_CATEGORIA_META[categoria as ExpenseCategoria] ??
    EXPENSE_CATEGORIA_META.outros
  )
}

const DATE_ISO_REGEX = /^\d{4}-\d{2}-\d{2}$/

export const expenseSchema = z.object({
  descricao: z.string().trim().min(1, 'Informe a descrição da despesa.'),
  categoria: z.enum(EXPENSE_CATEGORIAS, {
    error: 'Selecione a categoria.',
  }),
  valor: z
    .string()
    .refine((raw) => parseValor(raw) !== null, 'Informe um valor válido.')
    .refine(
      (raw) => (parseValor(raw) ?? 0) > 0,
      'O valor deve ser maior que zero.'
    ),
  data: z.string().regex(DATE_ISO_REGEX, 'Informe a data da despesa.'),
  recorrente: z.boolean(),
  project_id: z.string(),
})

export type ExpenseFormValues = z.infer<typeof expenseSchema>

export const EMPTY_EXPENSE_VALUES: ExpenseFormValues = {
  descricao: '',
  categoria: 'outros',
  valor: '',
  data: '',
  recorrente: false,
  project_id: '',
}

/** Converte o form validado no payload de insert/update. */
export function expenseFormToPayload(values: ExpenseFormValues) {
  return {
    descricao: values.descricao,
    categoria: values.categoria,
    valor: parseValor(values.valor) ?? 0,
    data: values.data,
    recorrente: values.recorrente,
    project_id: values.project_id === '' ? null : values.project_id,
  }
}
