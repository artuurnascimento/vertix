import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { AlertTriangle, ChevronDown, Plus, RefreshCw, Store } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Tables } from '../lib/database.types'
import { formatRelativeTime } from '../lib/format'
import AppBadge from '../components/lojas/AppBadge'
import LojaAppDetail from '../components/lojas/LojaAppDetail'
import ProvisionModal from '../components/lojas/ProvisionModal'
import ConfirmDeleteButton from '../components/finance/ConfirmDeleteButton'
import { useAppStatus } from '../components/lojas/useAppStatus'
import { semaforoDoApp } from '../components/lojas/lojasStatus'
import type { AppProduto } from '../components/lojas/appsProxy'

/**
 * Página Lojas — lojas Shopify de clientes com os apps próprios da agência
 * (Vertix Recover/Reviews) instalados como custom apps. Lista com semáforo
 * de saúde por produto (estado vivo via edge function apps-proxy: health +
 * shops, cache ~60s), detalhe expandido inline com métricas de 30 dias e
 * configurações remotas, e provisionamento de loja nova (padrão Trafego).
 */

type LojaRow = Tables<'lojas'> & {
  clients: Pick<Tables<'clients'>, 'id' | 'nome' | 'empresa'> | null
  loja_apps: Tables<'loja_apps'>[]
}

const STATUS_LOJA: Record<string, { label: string; className: string }> = {
  ativa: {
    label: 'Ativa',
    className: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300',
  },
  pausada: {
    label: 'Pausada',
    className: 'border-amber-400/25 bg-amber-400/10 text-amber-300',
  },
  encerrada: {
    label: 'Encerrada',
    className: 'border-white/10 bg-white/5 text-muted',
  },
}

export default function Lojas() {
  const queryClient = useQueryClient()
  const prefersReducedMotion = useReducedMotion()

  const [modalOpen, setModalOpen] = useState(false)
  const [abertaId, setAbertaId] = useState<string | null>(null)

  const { data: lojas, isLoading } = useQuery({
    queryKey: ['lojas'],
    queryFn: async (): Promise<LojaRow[]> => {
      const { data, error } = await supabase
        .from('lojas')
        .select('*, clients(id, nome, empresa), loja_apps(*)')
        .order('created_at', { ascending: false })
      if (error) throw new Error(error.message)
      return data as LojaRow[]
    },
  })

  // Estado vivo dos dois backends (health + shops) — o semáforo deriva daqui.
  const statusPorApp = {
    recover: useAppStatus('recover'),
    reviews: useAppStatus('reviews'),
  }

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('lojas').delete().eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['lojas'] }),
  })

  const refetchBackends = () => {
    queryClient.invalidateQueries({ queryKey: ['apps-proxy'] })
  }

  const backendsOffline = (['recover', 'reviews'] as AppProduto[]).filter(
    (p) => statusPorApp[p].estado === 'offline'
  )

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="hero-heading font-kanit text-4xl font-bold leading-tight sm:text-5xl">
            Lojas
          </h1>
          <p className="mt-2 text-sm font-light text-muted">
            Lojas Shopify dos clientes com os apps Vertix — saúde, métricas e
            configurações remotas.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={refetchBackends}
            className="inline-flex min-h-11 touch-manipulation items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 font-kanit text-sm font-medium text-muted transition-colors duration-150 hover:bg-white/5 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <RefreshCw className="h-4 w-4" />
            Atualizar status
          </button>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex min-h-11 touch-manipulation items-center gap-2 rounded-xl bg-accent px-5 py-2.5 font-kanit text-sm font-semibold text-white shadow-lg shadow-accent/25 transition-colors duration-200 hover:bg-accent-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <Plus size={16} strokeWidth={2.5} />
            Provisionar loja
          </button>
        </div>
      </div>

      {backendsOffline.length > 0 && (
        <div
          role="alert"
          className="mt-6 flex items-start gap-3 rounded-xl border border-red-400/25 bg-red-400/10 px-4 py-3"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-300" />
          <p className="text-sm font-light text-red-100/90">
            Backend {backendsOffline.map((p) => (p === 'recover' ? 'Recover' : 'Reviews')).join(' e ')}{' '}
            sem resposta — semáforos em vermelho até a próxima consulta.
          </p>
        </div>
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

      {!isLoading && (lojas ?? []).length === 0 && (
        <div className="mt-8 rounded-xl border border-white/5 bg-surface-1 px-6 py-14 text-center">
          <Store className="mx-auto h-8 w-8 text-muted/50" />
          <p className="mt-3 text-sm font-light text-muted">
            Nenhuma loja ainda. Provisione a primeira loja de um cliente.
          </p>
        </div>
      )}

      {!isLoading && (lojas ?? []).length > 0 && (
        <ul className="mt-8 flex list-none flex-col gap-3 p-0">
          {(lojas ?? []).map((loja) => {
            const aberta = abertaId === loja.id
            const statusMeta = STATUS_LOJA[loja.status] ?? STATUS_LOJA.ativa
            const apps = [...loja.loja_apps].sort((a, b) =>
              a.produto.localeCompare(b.produto)
            )

            return (
              <motion.li
                key={loja.id}
                initial={prefersReducedMotion ? undefined : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl border border-white/5 bg-surface-1"
              >
                <div className="flex flex-wrap items-center gap-3 px-5 py-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-sm font-medium text-ink">
                      {loja.shop_domain}
                    </p>
                    <p className="mt-0.5 truncate text-xs font-light text-muted">
                      {loja.clients ? (
                        <Link
                          to={`/admin/clientes/${loja.clients.id}`}
                          className="transition-colors duration-150 hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                        >
                          {loja.clients.nome}
                        </Link>
                      ) : (
                        'Sem cliente vinculado'
                      )}
                      {loja.plano ? ` · ${loja.plano}` : ''}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {apps.length === 0 && (
                      <span className="text-xs font-light text-muted">
                        Nenhum app provisionado
                      </span>
                    )}
                    {apps.map((app) => {
                      const produto = app.produto as AppProduto
                      const vivo = statusPorApp[produto]
                      return (
                        <AppBadge
                          key={app.id}
                          produto={produto}
                          semaforo={semaforoDoApp(
                            vivo.estado,
                            vivo.shops[loja.shop_domain]
                          )}
                        />
                      )
                    })}
                  </div>

                  <span
                    className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${statusMeta.className}`}
                  >
                    {statusMeta.label}
                  </span>

                  <span className="tabular-nums text-xs font-light text-muted">
                    {formatRelativeTime(loja.created_at)}
                  </span>

                  <div className="flex items-center gap-2">
                    <ConfirmDeleteButton
                      onConfirm={() => deleteMutation.mutate(loja.id)}
                      label={`Excluir ${loja.shop_domain}`}
                    />
                    <button
                      type="button"
                      onClick={() => setAbertaId(aberta ? null : loja.id)}
                      aria-expanded={aberta}
                      aria-label={`Detalhes de ${loja.shop_domain}`}
                      className="rounded-lg p-2 text-muted transition-colors duration-150 hover:bg-white/5 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                    >
                      <ChevronDown
                        className={`h-4 w-4 transition-transform duration-200 ${aberta ? 'rotate-180' : ''}`}
                      />
                    </button>
                  </div>
                </div>

                <AnimatePresence initial={false}>
                  {aberta && (
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
                      <div className="flex flex-col gap-6 border-t border-white/5 px-5 py-5">
                        {apps.length === 0 && (
                          <p className="py-2 text-center text-sm font-light text-muted">
                            Provisione um app para ver métricas e configurações.
                          </p>
                        )}
                        {apps.map((app) => {
                          const produto = app.produto as AppProduto
                          return (
                            <LojaAppDetail
                              key={app.id}
                              shopDomain={loja.shop_domain}
                              produto={produto}
                              backendEstado={statusPorApp[produto].estado}
                            />
                          )
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.li>
            )
          })}
        </ul>
      )}

      <ProvisionModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  )
}
