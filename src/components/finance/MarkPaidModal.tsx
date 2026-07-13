import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Ban, HandCoins, Undo2, X } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { formatBRL, formatDateBR } from '../../lib/commercial'
import {
  FORMAS_PAGAMENTO,
  markPaidSchema,
  todayLocalISO,
} from './receivableSchema'

/** Subconjunto do recebível necessário para as ações do modal. */
export interface MarkPaidReceivable {
  id: string
  project_id: string
  descricao: string
  valor: number
  status: string
  pago_em: string | null
  forma_pagamento: string | null
}

interface MarkPaidModalProps {
  open: boolean
  /** Recebível alvo — pendente abre o form de pagamento, pago abre o desfazer. */
  receivable: MarkPaidReceivable | null
  onClose: () => void
}

type ModalView = 'pagar' | 'confirmar-cancelamento' | 'confirmar-desfazer'

interface MarkPaidInput {
  pagoEm: string
  formaPagamento: string | null
}

const inputClass =
  'w-full rounded-lg border border-white/5 bg-surface-2 px-4 py-3 text-base text-ink placeholder:text-muted/50 outline-none transition-colors duration-200 focus:border-accent/60 focus:ring-2 focus:ring-accent/25 sm:py-2.5 sm:text-sm'

const labelClass = 'text-xs font-medium uppercase tracking-widest text-muted'

const secondaryButtonClass =
  'rounded-lg border border-white/10 px-4 py-2.5 text-sm font-medium text-muted transition-colors duration-200 hover:bg-white/5 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent'

export default function MarkPaidModal({
  open,
  receivable,
  onClose,
}: MarkPaidModalProps) {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  const [view, setView] = useState<ModalView>('pagar')
  const [pagoEm, setPagoEm] = useState('')
  const [formaPagamento, setFormaPagamento] = useState('')
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [rootError, setRootError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setView(receivable?.status === 'pago' ? 'confirmar-desfazer' : 'pagar')
      setPagoEm(todayLocalISO())
      setFormaPagamento(
        FORMAS_PAGAMENTO.find((f) => f === receivable?.forma_pagamento) ?? ''
      )
      setFieldError(null)
      setRootError(null)
    }
  }, [open, receivable])

  useEffect(() => {
    if (!open) return
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  const invalidateFinance = async (projectId?: string) => {
    const invalidations = [
      queryClient.invalidateQueries({ queryKey: ['receivables'] }),
      queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
    ]
    if (projectId) {
      invalidations.push(
        queryClient.invalidateQueries({ queryKey: ['activity', projectId] })
      )
    }
    await Promise.all(invalidations)
  }

  const markPaid = useMutation({
    mutationFn: async (input: MarkPaidInput): Promise<string> => {
      if (!receivable) throw new Error('Recebível não selecionado.')
      const { error } = await supabase
        .from('receivables')
        .update({
          status: 'pago',
          pago_em: input.pagoEm,
          forma_pagamento: input.formaPagamento,
        })
        .eq('id', receivable.id)
      if (error) throw new Error(error.message)

      const { error: logError } = await supabase.from('activity_log').insert({
        project_id: receivable.project_id,
        user_id: user?.id ?? null,
        tipo: 'financeiro',
        descricao: `Recebido ${formatBRL(receivable.valor)} — ${receivable.descricao}`,
      })
      if (logError) throw new Error(logError.message)
      return receivable.project_id
    },
    onSuccess: async (projectId) => {
      await invalidateFinance(projectId)
      onClose()
    },
    onError: () => {
      setRootError('Não foi possível registrar o pagamento. Tente novamente.')
    },
  })

  const cancelCharge = useMutation({
    mutationFn: async () => {
      if (!receivable) throw new Error('Recebível não selecionado.')
      const { error } = await supabase
        .from('receivables')
        .update({ status: 'cancelado' })
        .eq('id', receivable.id)
      if (error) throw new Error(error.message)
    },
    onSuccess: async () => {
      await invalidateFinance()
      onClose()
    },
    onError: () => {
      setRootError('Não foi possível cancelar a cobrança. Tente novamente.')
    },
  })

  const undoPayment = useMutation({
    mutationFn: async () => {
      if (!receivable) throw new Error('Recebível não selecionado.')
      const { error } = await supabase
        .from('receivables')
        .update({ status: 'pendente', pago_em: null, forma_pagamento: null })
        .eq('id', receivable.id)
      if (error) throw new Error(error.message)
    },
    onSuccess: async () => {
      await invalidateFinance()
      onClose()
    },
    onError: () => {
      setRootError('Não foi possível desfazer o pagamento. Tente novamente.')
    },
  })

  const handlePaySubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setRootError(null)
    const parsed = markPaidSchema.safeParse({
      pago_em: pagoEm,
      forma_pagamento: formaPagamento,
    })
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message ?? 'Dados inválidos.')
      return
    }
    setFieldError(null)
    markPaid.mutate({
      pagoEm: parsed.data.pago_em,
      formaPagamento:
        parsed.data.forma_pagamento === '' ? null : parsed.data.forma_pagamento,
    })
  }

  const ariaLabel =
    view === 'pagar'
      ? 'Marcar como pago'
      : view === 'confirmar-cancelamento'
        ? 'Cancelar cobrança'
        : 'Desfazer pagamento'

  return createPortal(
    <AnimatePresence>
      {open && receivable && (
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
            aria-label={ariaLabel}
            className="w-full max-w-md rounded-2xl border border-white/5 bg-surface-1 p-7 font-kanit shadow-[0_24px_80px_-32px_rgba(108,91,242,0.35)]"
          >
            {view === 'pagar' && (
              <>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-emerald-400/25 bg-emerald-400/10">
                      <HandCoins className="h-4 w-4 text-emerald-300" />
                    </span>
                    <div>
                      <h2 className="text-lg font-semibold text-ink">
                        Marcar como pago
                      </h2>
                      <p className="mt-0.5 text-xs font-light text-muted">
                        {receivable.descricao} ·{' '}
                        <span className="font-medium tabular-nums text-ink/80">
                          {formatBRL(receivable.valor)}
                        </span>
                      </p>
                    </div>
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

                <form
                  onSubmit={handlePaySubmit}
                  className="mt-6 flex flex-col gap-4"
                >
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <label className="flex flex-col gap-1.5">
                      <span className={labelClass}>Data do pagamento *</span>
                      <input
                        type="date"
                        value={pagoEm}
                        onChange={(e) => setPagoEm(e.target.value)}
                        className={`${inputClass} [color-scheme:dark]`}
                      />
                      {fieldError && (
                        <span className="text-xs text-red-400">
                          {fieldError}
                        </span>
                      )}
                    </label>

                    <label className="flex flex-col gap-1.5">
                      <span className={labelClass}>Forma de pagamento</span>
                      <select
                        value={formaPagamento}
                        onChange={(e) => setFormaPagamento(e.target.value)}
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
                  </div>

                  {rootError && (
                    <p
                      role="alert"
                      className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm text-red-400"
                    >
                      {rootError}
                    </p>
                  )}

                  <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setRootError(null)
                        setView('confirmar-cancelamento')
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg px-2 py-2 text-xs font-medium text-muted/70 transition-colors duration-200 hover:bg-red-500/10 hover:text-red-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-400"
                    >
                      <Ban className="h-3.5 w-3.5" />
                      Cancelar cobrança
                    </button>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={onClose}
                        className={secondaryButtonClass}
                      >
                        Voltar
                      </button>
                      <button
                        type="submit"
                        disabled={markPaid.isPending}
                        className="rounded-lg bg-emerald-500/90 px-5 py-2.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
                      >
                        {markPaid.isPending
                          ? 'Registrando…'
                          : 'Confirmar pagamento'}
                      </button>
                    </div>
                  </div>
                </form>
              </>
            )}

            {view === 'confirmar-cancelamento' && (
              <>
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-red-500/20 bg-red-500/10">
                    <Ban className="h-4 w-4 text-red-400" />
                  </span>
                  <h2 className="text-base font-semibold text-ink">
                    Cancelar cobrança?
                  </h2>
                </div>
                <p className="mt-3 text-sm font-light leading-relaxed text-muted">
                  <span className="font-medium text-ink">
                    {receivable.descricao}
                  </span>{' '}
                  de{' '}
                  <span className="font-medium text-ink">
                    {formatBRL(receivable.valor)}
                  </span>{' '}
                  será marcada como cancelada e sai dos totais a receber.
                </p>

                {rootError && (
                  <p
                    role="alert"
                    className="mt-4 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm text-red-400"
                  >
                    {rootError}
                  </p>
                )}

                <div className="mt-5 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setView('pagar')}
                    className={secondaryButtonClass}
                  >
                    Voltar
                  </button>
                  <button
                    type="button"
                    onClick={() => cancelCharge.mutate()}
                    disabled={cancelCharge.isPending}
                    className="rounded-lg bg-red-500/90 px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400"
                  >
                    {cancelCharge.isPending
                      ? 'Cancelando…'
                      : 'Cancelar cobrança'}
                  </button>
                </div>
              </>
            )}

            {view === 'confirmar-desfazer' && (
              <>
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-amber-400/25 bg-amber-400/10">
                    <Undo2 className="h-4 w-4 text-amber-300" />
                  </span>
                  <h2 className="text-base font-semibold text-ink">
                    Desfazer pagamento?
                  </h2>
                </div>
                <p className="mt-3 text-sm font-light leading-relaxed text-muted">
                  <span className="font-medium text-ink">
                    {receivable.descricao}
                  </span>{' '}
                  de{' '}
                  <span className="font-medium text-ink">
                    {formatBRL(receivable.valor)}
                  </span>
                  {receivable.pago_em
                    ? ` (pago em ${formatDateBR(receivable.pago_em)})`
                    : ''}{' '}
                  voltará para pendente. Data e forma de pagamento serão
                  limpas.
                </p>

                {rootError && (
                  <p
                    role="alert"
                    className="mt-4 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm text-red-400"
                  >
                    {rootError}
                  </p>
                )}

                <div className="mt-5 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className={secondaryButtonClass}
                  >
                    Voltar
                  </button>
                  <button
                    type="button"
                    onClick={() => undoPayment.mutate()}
                    disabled={undoPayment.isPending}
                    className="rounded-lg border border-amber-400/30 bg-amber-400/15 px-4 py-2.5 text-sm font-semibold text-amber-300 transition-colors duration-200 hover:bg-amber-400/25 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
                  >
                    {undoPayment.isPending
                      ? 'Desfazendo…'
                      : 'Desfazer pagamento'}
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}
