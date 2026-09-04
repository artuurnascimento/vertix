import { useState } from 'react'
import { AlertTriangle, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { isNaoConfigurado } from '../components/lojas/appsProxy'
import ScanLeadsTable from '../components/scan/ScanLeadsTable'
import {
  SCAN_PAGE_SIZE,
  fetchScanLeads,
  fetchScanStats,
} from '../components/scan/scanProxy'

/**
 * Página Vertix Scan — a ferramenta pública de análise de lojas que atua
 * como braço de captação de leads da agência. Stats e leads chegam do
 * backend do Scan via edge function apps-proxy (app 'scan'), no padrão
 * visual dos módulos Lojas e Leads Raio-X.
 */

const STALE_TIME_MS = 60_000

function num(value: number): string {
  return value.toLocaleString('pt-BR')
}

export default function VertixScan() {
  const queryClient = useQueryClient()
  const [pagina, setPagina] = useState(0)

  const stats = useQuery({
    queryKey: ['apps-proxy', 'scan', 'stats'],
    staleTime: STALE_TIME_MS,
    retry: false,
    refetchOnWindowFocus: false,
    queryFn: fetchScanStats,
  })

  const leads = useQuery({
    queryKey: ['apps-proxy', 'scan', 'leads', pagina],
    staleTime: STALE_TIME_MS,
    retry: false,
    refetchOnWindowFocus: false,
    queryFn: () => fetchScanLeads(pagina * SCAN_PAGE_SIZE),
  })

  const refetch = () => {
    queryClient.invalidateQueries({ queryKey: ['apps-proxy', 'scan'] })
  }

  // 503 do proxy = SCAN_API_URL/SCAN_SERVICE_TOKEN ausentes nos secrets.
  const naoConfigurado =
    isNaoConfigurado(stats.error) || isNaoConfigurado(leads.error)

  const cards = [
    { label: 'Análises (total)', valor: stats.data?.analises_total },
    { label: 'Análises (7d)', valor: stats.data?.analises_7d },
    { label: 'Leads (total)', valor: stats.data?.leads_total },
    { label: 'Leads (7d)', valor: stats.data?.leads_7d },
  ]

  const total = leads.data?.total ?? 0
  const totalPaginas = Math.max(1, Math.ceil(total / SCAN_PAGE_SIZE))
  // Garante data desc mesmo se o backend mudar a ordenação.
  const leadsOrdenados = [...(leads.data?.leads ?? [])].sort((a, b) =>
    b.criado_em.localeCompare(a.criado_em)
  )
  const inicio = total === 0 ? 0 : pagina * SCAN_PAGE_SIZE + 1
  const fim = Math.min(total, pagina * SCAN_PAGE_SIZE + leadsOrdenados.length)

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="hero-heading font-kanit text-4xl font-bold leading-tight sm:text-5xl">
            Vertix Scan
          </h1>
          <p className="mt-2 text-sm font-light text-muted">
            Ferramenta pública de análise de lojas — o braço de captação de
            leads da Vertix.
          </p>
        </div>

        <button
          type="button"
          onClick={refetch}
          className="inline-flex min-h-11 touch-manipulation items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 font-kanit text-sm font-medium text-muted transition-colors duration-150 hover:bg-white/5 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <RefreshCw className="h-4 w-4" />
          Atualizar
        </button>
      </div>

      {naoConfigurado && (
        <div
          role="alert"
          className="mt-8 flex items-start gap-3 rounded-xl border border-amber-400/25 bg-amber-400/10 px-4 py-3"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
          <p className="text-sm font-light text-amber-100/90">
            Backend do Vertix Scan ainda não configurado — defina SCAN_API_URL
            e SCAN_SERVICE_TOKEN nos secrets da edge function apps-proxy.
          </p>
        </div>
      )}

      {!naoConfigurado && (
        <>
          {/* Cards de stats */}
          {stats.isLoading && (
            <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
              {Array.from({ length: 4 }, (_, i) => (
                <div key={i} className="h-20 animate-pulse rounded-xl bg-surface-1" />
              ))}
            </div>
          )}

          {stats.isError && (
            <div className="mt-8 rounded-xl border border-red-400/25 bg-red-400/10 px-6 py-8 text-center">
              <p className="text-sm font-light text-red-100/90">
                Backend do Vertix Scan não respondeu — métricas indisponíveis.
              </p>
            </div>
          )}

          {stats.data && (
            <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
              {cards.map((card) => (
                <div
                  key={card.label}
                  className="rounded-xl border border-white/5 bg-surface-1 px-4 py-3"
                >
                  <p className="text-[10px] font-medium uppercase tracking-widest text-muted">
                    {card.label}
                  </p>
                  <p className="mt-1 truncate tabular-nums text-lg font-semibold text-ink">
                    {num(card.valor ?? 0)}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Tabela de leads */}
          <div className="mt-8">
            {leads.isLoading && (
              <div className="space-y-3">
                {Array.from({ length: 3 }, (_, i) => (
                  <div
                    key={i}
                    className="h-20 animate-pulse rounded-xl bg-surface-1"
                    style={{ opacity: 1 - i * 0.3 }}
                  />
                ))}
              </div>
            )}

            {leads.isError && (
              <div className="rounded-xl border border-red-400/25 bg-red-400/10 px-6 py-8 text-center">
                <p className="text-sm font-light text-red-100/90">
                  Não deu para carregar os leads do Vertix Scan. Tente
                  atualizar.
                </p>
              </div>
            )}

            {leads.data && (
              <>
                <ScanLeadsTable leads={leadsOrdenados} />

                {total > SCAN_PAGE_SIZE && (
                  <div className="mt-4 flex items-center justify-between">
                    <p className="text-xs font-light text-muted">
                      {inicio}–{fim} de {num(total)} leads
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setPagina((p) => Math.max(0, p - 1))}
                        disabled={pagina === 0 || leads.isFetching}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-muted transition-colors duration-150 hover:bg-white/5 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                        Anteriores
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setPagina((p) => Math.min(totalPaginas - 1, p + 1))
                        }
                        disabled={pagina >= totalPaginas - 1 || leads.isFetching}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-muted transition-colors duration-150 hover:bg-white/5 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Próximos
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
