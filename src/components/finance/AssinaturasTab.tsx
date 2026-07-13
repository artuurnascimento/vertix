import { useState } from 'react'
import { motion } from 'framer-motion'
import { CalendarClock, Plus, RefreshCw } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import type { Tables } from '../../lib/database.types'
import { formatBRL } from '../../lib/commercial'
import SubscriptionFormModal from './SubscriptionFormModal'
import ConfirmDeleteButton from './ConfirmDeleteButton'
import FinanceToast from './FinanceToast'

type SubscriptionRow = Tables<'subscriptions'> & {
  clients: Pick<Tables<'clients'>, 'id' | 'nome' | 'empresa'> | null
  projects: Pick<Tables<'projects'>, 'id' | 'nome'> | null
}

const SKELETON_ROWS = 3
const ROW_STAGGER_S = 0.04
const MAX_STAGGER_ROWS = 10
const TOAST_TIMEOUT_MS = 4000

export default function AssinaturasTab() {
  const queryClient = useQueryClient()
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'

  const [formOpen, setFormOpen] = useState(false)
  const [subscriptionToEdit, setSubscriptionToEdit] =
    useState<SubscriptionRow | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const showToast = (message: string) => {
    setToastMessage(message)
    setTimeout(() => setToastMessage(null), TOAST_TIMEOUT_MS)
  }

  const { data: subscriptions, isLoading, isError } = useQuery({
    queryKey: ['subscriptions'],
    queryFn: async (): Promise<SubscriptionRow[]> => {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*, clients(id, nome, empresa), projects(id, nome)')
        .order('created_at', { ascending: false })
      if (error) throw new Error(error.message)
      return data
    },
  })

  const toggleAtivo = useMutation({
    mutationFn: async (input: { id: string; ativo: boolean }) => {
      const { error } = await supabase
        .from('subscriptions')
        .update({ ativo: input.ativo })
        .eq('id', input.id)
      if (error) throw new Error(error.message)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['subscriptions'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (subscriptionId: string) => {
      const { error } = await supabase
        .from('subscriptions')
        .delete()
        .eq('id', subscriptionId)
      if (error) throw new Error(error.message)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['subscriptions'] })
    },
  })

  const generateCharges = useMutation({
    mutationFn: async (): Promise<number> => {
      const { data, error } = await supabase.rpc(
        'generate_subscription_receivables'
      )
      if (error) throw new Error(error.message)
      return data ?? 0
    },
    onSuccess: async (count) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['receivables'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
      ])
      showToast(
        count === 0
          ? 'Nenhuma cobrança nova — todas já existiam para este mês.'
          : `${count} cobrança${count > 1 ? 's' : ''} gerada${count > 1 ? 's' : ''} para este mês.`
      )
    },
    onError: () => {
      showToast('Não foi possível gerar as cobranças. Tente novamente.')
    },
  })

  const hasSubscriptions = (subscriptions?.length ?? 0) > 0

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-kanit text-lg font-semibold text-ink">
          Assinaturas
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          {isAdmin && (
            <button
              type="button"
              onClick={() => generateCharges.mutate()}
              disabled={generateCharges.isPending}
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2.5 text-sm font-medium text-ink transition-colors duration-200 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw
                className={`h-4 w-4 ${generateCharges.isPending ? 'animate-spin' : ''}`}
              />
              Gerar cobranças do mês
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setSubscriptionToEdit(null)
              setFormOpen(true)
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-[0_8px_24px_-8px_rgba(108,91,242,0.6)] transition-all duration-200 hover:bg-accent-2 hover:shadow-[0_10px_28px_-8px_rgba(85,70,224,0.7)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <Plus className="h-4 w-4" />
            Nova assinatura
          </button>
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-white/5 bg-surface-1">
        {isLoading && (
          <div className="divide-y divide-white/5" aria-label="Carregando assinaturas">
            {Array.from({ length: SKELETON_ROWS }, (_, i) => (
              <div key={i} className="flex items-center gap-6 px-6 py-5">
                <div className="h-4 w-44 animate-pulse rounded bg-surface-2" />
                <div className="h-4 w-32 animate-pulse rounded bg-surface-2" />
                <div className="ml-auto h-4 w-24 animate-pulse rounded bg-surface-2" />
              </div>
            ))}
          </div>
        )}

        {isError && (
          <p className="px-6 py-10 text-center text-sm text-red-400">
            Não foi possível carregar as assinaturas. Recarregue a página.
          </p>
        )}

        {!isLoading && !isError && !hasSubscriptions && (
          <div className="flex flex-col items-center px-6 py-16 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full border border-accent/20 bg-accent/10">
              <CalendarClock className="h-6 w-6 text-accent" />
            </span>
            <h2 className="mt-5 text-lg font-semibold text-ink">
              Nenhuma assinatura ainda
            </h2>
            <p className="mt-2 max-w-xs text-sm font-light leading-relaxed text-muted">
              Cadastre manutenções recorrentes para gerar as cobranças
              mensais automaticamente.
            </p>
            <button
              type="button"
              onClick={() => {
                setSubscriptionToEdit(null)
                setFormOpen(true)
              }}
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-accent-2"
            >
              <Plus className="h-4 w-4" />
              Criar primeira assinatura
            </button>
          </div>
        )}

        {!isLoading && !isError && hasSubscriptions && (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/5 text-[11px] uppercase tracking-widest text-muted/70">
                <th className="px-6 py-4 font-medium">Descrição</th>
                <th className="hidden px-4 py-4 font-medium md:table-cell">
                  Cliente
                </th>
                <th className="px-4 py-4 font-medium">Valor mensal</th>
                <th className="hidden px-4 py-4 font-medium sm:table-cell">
                  Dia venc.
                </th>
                <th className="px-4 py-4 font-medium">Ativo</th>
                <th className="px-4 py-4 text-right font-medium">
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {subscriptions!.map((sub, index) => (
                <motion.tr
                  key={sub.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.25,
                    delay: Math.min(index, MAX_STAGGER_ROWS) * ROW_STAGGER_S,
                  }}
                  onClick={() => {
                    setSubscriptionToEdit(sub)
                    setFormOpen(true)
                  }}
                  className="group cursor-pointer border-b border-white/5 transition-colors duration-150 last:border-b-0 hover:bg-white/[0.03]"
                >
                  <td className="px-6 py-4">
                    <p className="font-medium text-ink">{sub.descricao}</p>
                    <p className="mt-0.5 text-xs font-light text-muted">
                      {sub.projects?.nome ?? '—'}
                    </p>
                  </td>
                  <td className="hidden px-4 py-4 md:table-cell">
                    <p className="text-ink/90">{sub.clients?.nome ?? '—'}</p>
                    {sub.clients?.empresa && (
                      <p className="mt-0.5 text-xs font-light text-muted">
                        {sub.clients.empresa}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-4 font-medium text-ink">
                    {formatBRL(sub.valor_mensal)}
                  </td>
                  <td className="hidden px-4 py-4 text-ink/90 sm:table-cell">
                    Dia {sub.dia_vencimento}
                  </td>
                  <td className="px-4 py-4">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={sub.ativo}
                      aria-label={sub.ativo ? 'Desativar assinatura' : 'Ativar assinatura'}
                      onClick={(event) => {
                        event.stopPropagation()
                        toggleAtivo.mutate({ id: sub.id, ativo: !sub.ativo })
                      }}
                      disabled={toggleAtivo.isPending}
                      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-60 ${
                        sub.ativo ? 'bg-emerald-500/80' : 'bg-white/10'
                      }`}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform duration-200 ${
                          sub.ativo ? 'translate-x-[18px]' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <div
                      className="flex justify-end"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <ConfirmDeleteButton
                        label={`Excluir ${sub.descricao}`}
                        isPending={deleteMutation.isPending}
                        onConfirm={() => deleteMutation.mutate(sub.id)}
                      />
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <SubscriptionFormModal
        open={formOpen}
        subscription={subscriptionToEdit}
        onClose={() => {
          setFormOpen(false)
          setSubscriptionToEdit(null)
        }}
      />

      <FinanceToast message={toastMessage} />
    </div>
  )
}
