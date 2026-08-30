import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { X } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { PRODUTO_META, PRODUTOS, callAppsProxy } from './appsProxy'
import type { AppProduto } from './appsProxy'

/**
 * Modal "Provisionar loja": registra o custom app da loja no backend do
 * produto (POST /api/vertix/provision via apps-proxy) e, no sucesso,
 * garante a loja em `lojas` (reusa se o domínio já existir) + upsert em
 * `loja_apps`. O client_secret do custom app NUNCA é persistido no
 * Supabase — só passa adiante para o backend, dentro da edge function.
 */

const SHOP_DOMAIN_RE = /^[a-z0-9][a-z0-9-]*(\.[a-z0-9-]+)+$/

const inputClass =
  'w-full rounded-lg border border-white/5 bg-surface-2 px-4 py-3 text-base text-ink placeholder:text-muted/40 outline-none transition-all duration-200 focus:border-accent/60 focus:ring-2 focus:ring-accent/25 hover:border-white/10 sm:py-2.5 sm:text-sm'
const labelClass = 'text-[11px] font-medium uppercase tracking-widest text-muted'

interface ProvisionModalProps {
  open: boolean
  onClose: () => void
}

export default function ProvisionModal({ open, onClose }: ProvisionModalProps) {
  const queryClient = useQueryClient()
  const prefersReducedMotion = useReducedMotion()

  const [clienteId, setClienteId] = useState('')
  const [shopDomain, setShopDomain] = useState('')
  const [produto, setProduto] = useState<AppProduto>('recover')
  const [appClientId, setAppClientId] = useState('')
  const [appClientSecret, setAppClientSecret] = useState('')
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setClienteId('')
    setShopDomain('')
    setProduto('recover')
    setAppClientId('')
    setAppClientSecret('')
    setErro(null)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const { data: clientes } = useQuery({
    queryKey: ['lojas', 'clients-options'],
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
      const dominio = shopDomain.trim().toLowerCase()

      // 1. Registra o custom app no backend do produto (o secret morre aqui).
      await callAppsProxy({
        app: produto,
        method: 'POST',
        path: '/api/vertix/provision',
        body: {
          shopDomain: dominio,
          clientId: appClientId.trim(),
          clientSecret: appClientSecret.trim(),
        },
      })

      // 2. Garante a loja no cadastro local (reusa pelo domínio único).
      const { data: existente, error: buscaError } = await supabase
        .from('lojas')
        .select('id')
        .eq('shop_domain', dominio)
        .maybeSingle()
      if (buscaError) throw new Error(buscaError.message)

      let lojaId = existente?.id ?? null
      if (!lojaId) {
        const { data: nova, error: insertError } = await supabase
          .from('lojas')
          .insert({
            shop_domain: dominio,
            client_id: clienteId === '' ? null : clienteId,
          })
          .select('id')
          .single()
        if (insertError) throw new Error(insertError.message)
        lojaId = nova.id
      }

      // 3. Upsert do app na loja — reprovisionar volta o status ao início.
      const { error: appError } = await supabase
        .from('loja_apps')
        .upsert(
          {
            loja_id: lojaId,
            produto,
            status: 'provisionado',
            provisionado_em: new Date().toISOString(),
          },
          { onConflict: 'loja_id,produto' }
        )
      if (appError) throw new Error(appError.message)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lojas'] })
      queryClient.invalidateQueries({ queryKey: ['apps-proxy', produto] })
      onClose()
    },
    onError: (err: Error) => {
      setErro(err.message || 'Não foi possível provisionar. Tente de novo.')
    },
  })

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const dominio = shopDomain.trim().toLowerCase()
    if (!SHOP_DOMAIN_RE.test(dominio)) {
      return setErro(
        'Domínio inválido — formato esperado: minha-loja.myshopify.com.'
      )
    }
    if (appClientId.trim() === '') {
      return setErro('Informe o Client ID do custom app da loja.')
    }
    if (appClientSecret.trim() === '') {
      return setErro('Informe o Client Secret do custom app da loja.')
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
          initial={
            prefersReducedMotion ? undefined : { opacity: 0, scale: 0.96, y: 8 }
          }
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          role="dialog"
          aria-modal="true"
          aria-label="Provisionar loja"
          className="w-full max-w-md rounded-2xl border border-white/10 bg-surface-1 p-6"
        >
          <div className="flex items-center justify-between">
            <h2 className="font-kanit text-lg font-semibold text-ink">
              Provisionar loja
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

          <form
            onSubmit={handleSubmit}
            noValidate
            className="mt-5 flex flex-col gap-4"
          >
            <label className="flex flex-col gap-1.5">
              <span className={labelClass}>Cliente</span>
              <select
                value={clienteId}
                onChange={(e) => setClienteId(e.target.value)}
                className={inputClass}
              >
                <option value="">Sem vínculo</option>
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
                Domínio da loja <span aria-hidden className="text-accent">*</span>
              </span>
              <input
                type="text"
                value={shopDomain}
                onChange={(e) => setShopDomain(e.target.value)}
                placeholder="minha-loja.myshopify.com"
                className={`${inputClass} font-mono`}
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className={labelClass}>
                Produto <span aria-hidden className="text-accent">*</span>
              </span>
              <select
                value={produto}
                onChange={(e) => setProduto(e.target.value as AppProduto)}
                className={inputClass}
              >
                {PRODUTOS.map((p) => (
                  <option key={p} value={p}>
                    {PRODUTO_META[p].nome}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className={labelClass}>
                Client ID do custom app{' '}
                <span aria-hidden className="text-accent">*</span>
              </span>
              <input
                type="text"
                value={appClientId}
                onChange={(e) => setAppClientId(e.target.value)}
                autoComplete="off"
                className={`${inputClass} font-mono`}
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className={labelClass}>
                Client Secret do custom app{' '}
                <span aria-hidden className="text-accent">*</span>
              </span>
              <input
                type="password"
                value={appClientSecret}
                onChange={(e) => setAppClientSecret(e.target.value)}
                autoComplete="off"
                className={`${inputClass} font-mono`}
              />
              <span className="text-[11px] font-light text-muted">
                O secret é enviado direto ao backend do app — nunca fica salvo
                no painel.
              </span>
            </label>

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
                {mutation.isPending ? 'Provisionando…' : 'Provisionar'}
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  )
}
