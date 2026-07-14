import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  AlertTriangle,
  ChevronDown,
  Megaphone,
  Pencil,
  Plus,
  RefreshCw,
} from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Tables } from '../lib/database.types'
import { formatBRL } from '../lib/commercial'
import { formatRelativeTime } from '../lib/format'
import AdAccountModal from '../components/trafego/AdAccountModal'
import AdAccountDetail from '../components/trafego/AdAccountDetail'
import UtmSection from '../components/trafego/UtmSection'
import ConfirmDeleteButton from '../components/finance/ConfirmDeleteButton'
import { formatDerived, roas } from '../components/trafego/adMetrics'

/**
 * Página Tráfego — contas de anúncio Meta dos clientes: gasto/ROAS do mês,
 * sincronização (edge function sync-ad-metrics) e CRUD. Detalhe expande
 * inline (padrão BriefingsList).
 */

type AdAccountRow = Tables<'ad_accounts'> & {
  clients: Pick<Tables<'clients'>, 'id' | 'nome' | 'empresa'> | null
}

const TOKEN_ERROR_MSG = 'META_ADS_TOKEN não configurado'

function monthStartISO(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
}

export default function Trafego() {
  const queryClient = useQueryClient()
  const prefersReducedMotion = useReducedMotion()

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Tables<'ad_accounts'> | null>(null)
  const [abertoId, setAbertoId] = useState<string | null>(null)
  const [tokenMissing, setTokenMissing] = useState(false)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)

  const { data: contas, isLoading } = useQuery({
    queryKey: ['ad-accounts'],
    queryFn: async (): Promise<AdAccountRow[]> => {
      const { data, error } = await supabase
        .from('ad_accounts')
        .select('*, clients(id, nome, empresa)')
        .order('created_at', { ascending: false })
      if (error) throw new Error(error.message)
      return data as AdAccountRow[]
    },
  })

  // Métricas do mês corrente de todas as contas — agregadas client-side
  // por conta para gasto/ROAS na lista (uma query só).
  const { data: metricasMes } = useQuery({
    queryKey: ['ad-metrics', 'month'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ad_metrics_daily')
        .select('ad_account_id, gasto, receita')
        .gte('data', monthStartISO())
      if (error) throw new Error(error.message)
      return data
    },
  })

  const resumoPorConta = useMemo(() => {
    const mapa = new Map<string, { gasto: number; receita: number }>()
    for (const m of metricasMes ?? []) {
      const atual = mapa.get(m.ad_account_id) ?? { gasto: 0, receita: 0 }
      mapa.set(m.ad_account_id, {
        gasto: atual.gasto + m.gasto,
        receita: atual.receita + (m.receita ?? 0),
      })
    }
    return mapa
  }, [metricasMes])

  const syncMutation = useMutation({
    mutationFn: async (adAccountId?: string) => {
      const { data, error } = await supabase.functions.invoke(
        'sync-ad-metrics',
        { body: adAccountId ? { ad_account_id: adAccountId } : {} }
      )
      if (error) {
        let detail = ''
        try {
          const ctx = await (
            error as { context?: { json?: () => Promise<{ error?: string }> } }
          ).context?.json?.()
          detail = ctx?.error ?? ''
        } catch {
          detail = ''
        }
        throw new Error(detail || error.message)
      }
      return data as { sincronizadas?: number; falhas?: number }
    },
    onSuccess: (resultado) => {
      setTokenMissing(false)
      setSyncMsg(
        `Sincronização concluída: ${resultado?.sincronizadas ?? 0} conta(s), ${resultado?.falhas ?? 0} falha(s).`
      )
      queryClient.invalidateQueries({ queryKey: ['ad-accounts'] })
      queryClient.invalidateQueries({ queryKey: ['ad-metrics'] })
      setTimeout(() => setSyncMsg(null), 5000)
    },
    onError: (err: Error) => {
      if (err.message.includes(TOKEN_ERROR_MSG)) {
        setTokenMissing(true)
        return
      }
      setSyncMsg('Falha na sincronização. Tente novamente.')
      setTimeout(() => setSyncMsg(null), 5000)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('ad_accounts').delete().eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['ad-accounts'] }),
  })

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="hero-heading font-kanit text-4xl font-bold leading-tight sm:text-5xl">
            Tráfego
          </h1>
          <p className="mt-2 text-sm font-light text-muted">
            Contas de anúncio Meta dos clientes — gasto, retorno e prestação
            de contas.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => syncMutation.mutate(undefined)}
            disabled={syncMutation.isPending}
            className="inline-flex min-h-11 touch-manipulation items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 font-kanit text-sm font-medium text-muted transition-colors duration-150 hover:bg-white/5 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw
              className={`h-4 w-4 ${syncMutation.isPending ? 'animate-spin' : ''}`}
            />
            {syncMutation.isPending ? 'Sincronizando…' : 'Sincronizar todas'}
          </button>
          <button
            type="button"
            onClick={() => {
              setEditing(null)
              setModalOpen(true)
            }}
            className="inline-flex min-h-11 touch-manipulation items-center gap-2 rounded-xl bg-accent px-5 py-2.5 font-kanit text-sm font-semibold text-white shadow-lg shadow-accent/25 transition-colors duration-200 hover:bg-accent-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <Plus size={16} strokeWidth={2.5} />
            Conta
          </button>
        </div>
      </div>

      {tokenMissing && (
        <div
          role="alert"
          className="mt-6 flex items-start gap-3 rounded-xl border border-amber-400/25 bg-amber-400/10 px-4 py-3"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
          <p className="text-sm font-light text-amber-100/90">
            Configure <code className="font-mono text-amber-200">META_ADS_TOKEN</code>{' '}
            nas variáveis do Supabase para ativar a sincronização com a Meta.
          </p>
        </div>
      )}

      {syncMsg && (
        <p role="status" className="mt-6 text-sm font-light text-muted">
          {syncMsg}
        </p>
      )}

      {isLoading && (
        <div className="mt-8 space-y-3">
          {Array.from({ length: 3 }, (_, i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-xl bg-surface-1"
              style={{ opacity: 1 - i * 0.3 }}
            />
          ))}
        </div>
      )}

      {!isLoading && (contas ?? []).length === 0 && (
        <div className="mt-8 rounded-xl border border-white/5 bg-surface-1 px-6 py-14 text-center">
          <Megaphone className="mx-auto h-8 w-8 text-muted/50" />
          <p className="mt-3 text-sm font-light text-muted">
            Nenhuma conta de anúncio ainda. Vincule a primeira conta de um
            cliente.
          </p>
        </div>
      )}

      {!isLoading && (contas ?? []).length > 0 && (
        <ul className="mt-8 flex list-none flex-col gap-3 p-0">
          {(contas ?? []).map((conta) => {
            const resumo = resumoPorConta.get(conta.id)
            const contaRoas = resumo ? roas(resumo.gasto, resumo.receita) : null
            const aberto = abertoId === conta.id
            const ativo = conta.status === 'ativo'

            return (
              <motion.li
                key={conta.id}
                initial={prefersReducedMotion ? undefined : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl border border-white/5 bg-surface-1"
              >
                <div className="flex flex-wrap items-center gap-3 px-5 py-4">
                  <div className="min-w-0 flex-1">
                    {conta.clients ? (
                      <Link
                        to={`/admin/clientes/${conta.clients.id}`}
                        className="text-sm font-medium text-ink transition-colors duration-150 hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                      >
                        {conta.clients.nome}
                      </Link>
                    ) : (
                      <span className="text-sm text-muted">Cliente removido</span>
                    )}
                    <p className="mt-0.5 truncate text-xs font-light text-muted">
                      {conta.nome} ·{' '}
                      <span className="font-mono">{conta.meta_account_id}</span>
                    </p>
                  </div>

                  <div className="hidden text-right sm:block">
                    <p className="tabular-nums text-sm font-semibold text-ink">
                      {formatBRL(resumo?.gasto ?? 0)}
                    </p>
                    <p className="text-[11px] font-light text-muted">
                      ROAS {formatDerived(contaRoas)}
                    </p>
                  </div>

                  <span
                    className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${
                      ativo
                        ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300'
                        : 'border-white/10 bg-white/5 text-muted'
                    }`}
                  >
                    {ativo ? 'Ativo' : 'Pausado'}
                  </span>

                  {conta.last_sync_error && (
                    <span
                      title={conta.last_sync_error}
                      className="inline-flex items-center gap-1 rounded-full border border-red-400/25 bg-red-400/10 px-2.5 py-0.5 text-[11px] font-medium text-red-300"
                    >
                      <AlertTriangle className="h-3 w-3" />
                      Erro
                    </span>
                  )}

                  <span className="tabular-nums text-xs font-light text-muted">
                    {conta.last_sync_at
                      ? `sync ${formatRelativeTime(conta.last_sync_at)}`
                      : 'nunca sincronizada'}
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => syncMutation.mutate(conta.id)}
                      disabled={syncMutation.isPending}
                      title="Sincronizar esta conta"
                      aria-label={`Sincronizar ${conta.nome}`}
                      className="rounded-lg p-2 text-muted transition-colors duration-150 hover:bg-white/5 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(conta)
                        setModalOpen(true)
                      }}
                      title="Editar"
                      aria-label={`Editar ${conta.nome}`}
                      className="rounded-lg p-2 text-muted transition-colors duration-150 hover:bg-white/5 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <ConfirmDeleteButton
                      onConfirm={() => deleteMutation.mutate(conta.id)}
                      label={`Excluir ${conta.nome}`}
                    />
                    <button
                      type="button"
                      onClick={() => setAbertoId(aberto ? null : conta.id)}
                      aria-expanded={aberto}
                      aria-label={`Detalhes de ${conta.nome}`}
                      className="rounded-lg p-2 text-muted transition-colors duration-150 hover:bg-white/5 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                    >
                      <ChevronDown
                        className={`h-4 w-4 transition-transform duration-200 ${aberto ? 'rotate-180' : ''}`}
                      />
                    </button>
                  </div>
                </div>

                <AnimatePresence initial={false}>
                  {aberto && (
                    <motion.div
                      initial={
                        prefersReducedMotion
                          ? { height: 'auto', opacity: 1 }
                          : { height: 0, opacity: 0 }
                      }
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={
                        prefersReducedMotion
                          ? { height: 'auto', opacity: 1 }
                          : { height: 0, opacity: 0 }
                      }
                      transition={{ duration: 0.25, ease: 'easeOut' }}
                      className="overflow-hidden"
                    >
                      <div className="border-t border-white/5 px-5 py-5">
                        <AdAccountDetail accountId={conta.id} />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.li>
            )
          })}
        </ul>
      )}

      <UtmSection />

      <AdAccountModal
        open={modalOpen}
        account={editing}
        onClose={() => setModalOpen(false)}
      />
    </div>
  )
}
