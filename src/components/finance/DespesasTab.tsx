import { useState } from 'react'
import { motion } from 'framer-motion'
import { Plus, Receipt, Repeat } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { Tables } from '../../lib/database.types'
import { formatBRL, formatDateBR } from '../../lib/commercial'
import { getExpenseCategoriaMeta } from './expenseSchema'
import ExpenseFormModal from './ExpenseFormModal'
import ConfirmDeleteButton from './ConfirmDeleteButton'
import CashFlowSummary from './CashFlowSummary'

type ExpenseRow = Tables<'expenses'> & {
  projects: Pick<Tables<'projects'>, 'id' | 'nome'> | null
}

const SKELETON_ROWS = 4
const ROW_STAGGER_S = 0.04
const MAX_STAGGER_ROWS = 10

export default function DespesasTab() {
  const queryClient = useQueryClient()
  const [formOpen, setFormOpen] = useState(false)
  const [expenseToEdit, setExpenseToEdit] = useState<ExpenseRow | null>(null)

  const { data: expenses, isLoading, isError } = useQuery({
    queryKey: ['expenses'],
    queryFn: async (): Promise<ExpenseRow[]> => {
      const { data, error } = await supabase
        .from('expenses')
        .select('*, projects(id, nome)')
        .order('data', { ascending: false })
      if (error) throw new Error(error.message)
      return data
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (expenseId: string) => {
      const { error } = await supabase.from('expenses').delete().eq('id', expenseId)
      if (error) throw new Error(error.message)
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['expenses'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
      ])
    },
  })

  const hasExpenses = (expenses?.length ?? 0) > 0

  return (
    <div>
      <CashFlowSummary />

      <div className="mt-8 flex items-center justify-between">
        <h2 className="font-kanit text-lg font-semibold text-ink">Despesas</h2>
        <button
          type="button"
          onClick={() => {
            setExpenseToEdit(null)
            setFormOpen(true)
          }}
          className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-[0_8px_24px_-8px_rgba(108,91,242,0.6)] transition-all duration-200 hover:bg-accent-2 hover:shadow-[0_10px_28px_-8px_rgba(85,70,224,0.7)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <Plus className="h-4 w-4" />
          Nova despesa
        </button>
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-white/5 bg-surface-1">
        {isLoading && (
          <div className="divide-y divide-white/5" aria-label="Carregando despesas">
            {Array.from({ length: SKELETON_ROWS }, (_, i) => (
              <div key={i} className="flex items-center gap-6 px-6 py-5">
                <div className="h-4 w-44 animate-pulse rounded bg-surface-2" />
                <div className="h-4 w-24 animate-pulse rounded bg-surface-2" />
                <div className="ml-auto h-4 w-24 animate-pulse rounded bg-surface-2" />
              </div>
            ))}
          </div>
        )}

        {isError && (
          <p className="px-6 py-10 text-center text-sm text-red-400">
            Não foi possível carregar as despesas. Recarregue a página.
          </p>
        )}

        {!isLoading && !isError && !hasExpenses && (
          <div className="flex flex-col items-center px-6 py-16 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full border border-accent/20 bg-accent/10">
              <Receipt className="h-6 w-6 text-accent" />
            </span>
            <h2 className="mt-5 text-lg font-semibold text-ink">
              Nenhuma despesa ainda
            </h2>
            <p className="mt-2 max-w-xs text-sm font-light leading-relaxed text-muted">
              Registre a primeira despesa para acompanhar o fluxo de caixa da
              Vertix.
            </p>
            <button
              type="button"
              onClick={() => {
                setExpenseToEdit(null)
                setFormOpen(true)
              }}
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-accent-2"
            >
              <Plus className="h-4 w-4" />
              Criar primeira despesa
            </button>
          </div>
        )}

        {!isLoading && !isError && hasExpenses && (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/5 text-[11px] uppercase tracking-widest text-muted/70">
                <th className="px-6 py-4 font-medium">Descrição</th>
                <th className="px-4 py-4 font-medium">Categoria</th>
                <th className="px-4 py-4 font-medium">Valor</th>
                <th className="hidden px-4 py-4 font-medium sm:table-cell">
                  Data
                </th>
                <th className="hidden px-4 py-4 font-medium lg:table-cell">
                  Projeto
                </th>
                <th className="px-4 py-4 text-right font-medium">
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {expenses!.map((expense, index) => {
                const meta = getExpenseCategoriaMeta(expense.categoria)
                return (
                  <motion.tr
                    key={expense.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.25,
                      delay: Math.min(index, MAX_STAGGER_ROWS) * ROW_STAGGER_S,
                    }}
                    onClick={() => {
                      setExpenseToEdit(expense)
                      setFormOpen(true)
                    }}
                    className="group cursor-pointer border-b border-white/5 transition-colors duration-150 last:border-b-0 hover:bg-white/[0.03]"
                  >
                    <td className="px-6 py-4">
                      <p className="font-medium text-ink">{expense.descricao}</p>
                      {expense.recorrente && (
                        <span className="mt-1 inline-flex items-center gap-1 rounded-full border border-accent/25 bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent">
                          <Repeat className="h-2.5 w-2.5" />
                          Recorrente
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${meta.badgeClass}`}
                      >
                        <span
                          aria-hidden
                          className={`h-1.5 w-1.5 rounded-full ${meta.dotClass}`}
                        />
                        {meta.label}
                      </span>
                    </td>
                    <td className="px-4 py-4 font-medium text-ink">
                      {formatBRL(expense.valor)}
                    </td>
                    <td className="hidden px-4 py-4 text-ink/90 sm:table-cell">
                      {formatDateBR(expense.data)}
                    </td>
                    <td className="hidden px-4 py-4 lg:table-cell">
                      <span className="text-ink/90">
                        {expense.projects?.nome ?? '—'}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div
                        className="flex justify-end"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <ConfirmDeleteButton
                          label={`Excluir ${expense.descricao}`}
                          isPending={deleteMutation.isPending}
                          onConfirm={() => deleteMutation.mutate(expense.id)}
                        />
                      </div>
                    </td>
                  </motion.tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <ExpenseFormModal
        open={formOpen}
        expense={expenseToEdit}
        onClose={() => {
          setFormOpen(false)
          setExpenseToEdit(null)
        }}
      />
    </div>
  )
}
