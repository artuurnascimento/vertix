import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { X } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { Tables } from '../../lib/database.types'

/**
 * Modal criar/editar conta de anúncio. Fee mensal (só na criação) gera uma
 * assinatura no MRR e vincula via subscription_id — se o insert da conta
 * falhar, a assinatura recém-criada é removida (rollback manual).
 */

const ACT_ID_RE = /^act_\d+$/
const FEE_DIA_VENCIMENTO = 5

const inputClass =
  'w-full rounded-lg border border-white/5 bg-surface-2 px-4 py-3 text-base text-ink placeholder:text-muted/40 outline-none transition-all duration-200 focus:border-accent/60 focus:ring-2 focus:ring-accent/25 hover:border-white/10 sm:py-2.5 sm:text-sm'
const labelClass = 'text-[11px] font-medium uppercase tracking-widest text-muted'

interface AdAccountModalProps {
  open: boolean
  account: Tables<'ad_accounts'> | null
  onClose: () => void
}

export default function AdAccountModal({
  open,
  account,
  onClose,
}: AdAccountModalProps) {
  const queryClient = useQueryClient()
  const prefersReducedMotion = useReducedMotion()
  const isEdit = account !== null

  const [clientId, setClientId] = useState('')
  const [nome, setNome] = useState('')
  const [actId, setActId] = useState('')
  const [status, setStatus] = useState('ativo')
  const [fee, setFee] = useState('')
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setClientId(account?.client_id ?? '')
    setNome(account?.nome ?? '')
    setActId(account?.meta_account_id ?? '')
    setStatus(account?.status ?? 'ativo')
    setFee('')
    setErro(null)
  }, [open, account])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const { data: clientes } = useQuery({
    queryKey: ['ad-accounts', 'clients-options'],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, nome, empresa')
        .order('nome')
      if (error) throw new Error(error.message)
      return data
    },
  })

  const mutation = useMutation({
    mutationFn: async () => {
      const base = {
        client_id: clientId,
        nome: nome.trim(),
        meta_account_id: actId.trim(),
        status,
      }

      if (isEdit && account) {
        const { error } = await supabase
          .from('ad_accounts')
          .update(base)
          .eq('id', account.id)
        if (error) throw new Error(error.message)
        return
      }

      // Criação: fee opcional vira assinatura no MRR antes da conta.
      let subscriptionId: string | null = null
      const feeValor = fee.trim() === '' ? null : Number(fee.replace(',', '.'))
      if (feeValor && feeValor > 0) {
        const clienteNome =
          clientes?.find((c) => c.id === clientId)?.nome ?? 'cliente'
        const { data: sub, error: subError } = await supabase
          .from('subscriptions')
          .insert({
            client_id: clientId,
            descricao: `Gestão de tráfego — ${clienteNome}`,
            valor_mensal: feeValor,
            dia_vencimento: FEE_DIA_VENCIMENTO,
            ativo: true,
          })
          .select('id')
          .single()
        if (subError) throw new Error(subError.message)
        subscriptionId = sub.id
      }

      const { error } = await supabase
        .from('ad_accounts')
        .insert({ ...base, subscription_id: subscriptionId })
      if (error) {
        // Rollback manual da assinatura órfã.
        if (subscriptionId) {
          await supabase.from('subscriptions').delete().eq('id', subscriptionId)
        }
        throw new Error(error.message)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ad-accounts'] })
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] })
      onClose()
    },
    onError: (err: Error) => {
      setErro(
        err.message.includes('duplicate') || err.message.includes('unique')
          ? 'Já existe uma conta com esse ID (act_...).'
          : 'Não foi possível salvar. Verifique os campos e tente de novo.'
      )
    },
  })

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (clientId === '') return setErro('Escolha o cliente.')
    if (nome.trim() === '') return setErro('Dê um nome interno para a conta.')
    if (!ACT_ID_RE.test(actId.trim())) {
      return setErro('ID da conta inválido — formato esperado: act_1234567890.')
    }
    setErro(null)
    mutation.mutate()
  }

  if (!open) return null

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={prefersReducedMotion ? undefined : { opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose()
        }}
      >
        <motion.div
          initial={prefersReducedMotion ? undefined : { opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          role="dialog"
          aria-modal="true"
          aria-label={isEdit ? 'Editar conta de anúncio' : 'Nova conta de anúncio'}
          className="w-full max-w-md rounded-2xl border border-white/10 bg-surface-1 p-6"
        >
          <div className="flex items-center justify-between">
            <h2 className="font-kanit text-lg font-semibold text-ink">
              {isEdit ? 'Editar conta de anúncio' : 'Nova conta de anúncio'}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              className="rounded-lg p-2 text-muted transition-colors duration-150 hover:bg-white/5 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} noValidate className="mt-5 flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className={labelClass}>
                Cliente <span aria-hidden className="text-accent">*</span>
              </span>
              <select
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className={inputClass}
              >
                <option value="">Selecione…</option>
                {(clientes ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                    {c.empresa ? ` — ${c.empresa}` : ''}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className={labelClass}>
                Nome interno <span aria-hidden className="text-accent">*</span>
              </span>
              <input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex.: Loja X — BM principal"
                className={inputClass}
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className={labelClass}>
                ID da conta Meta <span aria-hidden className="text-accent">*</span>
              </span>
              <input
                type="text"
                value={actId}
                onChange={(e) => setActId(e.target.value)}
                placeholder="act_1234567890"
                className={`${inputClass} font-mono`}
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5">
                <span className={labelClass}>Status</span>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className={inputClass}
                >
                  <option value="ativo">Ativo</option>
                  <option value="pausado">Pausado</option>
                </select>
              </label>

              {!isEdit && (
                <label className="flex flex-col gap-1.5">
                  <span className={labelClass}>Fee mensal (R$)</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={fee}
                    onChange={(e) => setFee(e.target.value)}
                    placeholder="Opcional"
                    className={inputClass}
                  />
                </label>
              )}
            </div>

            {!isEdit && fee.trim() !== '' && (
              <p className="text-xs font-light text-muted">
                Cria uma assinatura mensal no Financeiro (vencimento dia{' '}
                {FEE_DIA_VENCIMENTO}).
              </p>
            )}

            {erro && (
              <p role="alert" className="text-xs text-red-400">
                {erro}
              </p>
            )}

            <div className="mt-1 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={mutation.isPending}
                className="min-h-11 touch-manipulation rounded-lg px-4 py-2.5 text-sm font-medium text-muted transition-colors hover:bg-white/5 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={mutation.isPending}
                className="min-h-11 touch-manipulation rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-accent/25 transition-colors duration-200 hover:bg-accent-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50"
              >
                {mutation.isPending ? 'Salvando…' : isEdit ? 'Salvar' : 'Criar conta'}
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  )
}
