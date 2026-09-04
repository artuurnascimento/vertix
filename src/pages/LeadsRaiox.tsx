import { useState } from 'react'
import { AlertTriangle, RefreshCw, Search } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import LeadsTab from '../components/leadsRaiox/LeadsTab'
import AbandonosTab from '../components/leadsRaiox/AbandonosTab'
import { STATUS_LEAD_META } from '../components/leadsRaiox/LeadStatusPicker'
import { fetchLeads } from '../components/leadsRaiox/raioxData'
import { raioxConfigMissing } from '../components/leadsRaiox/raioxSupabase'
import { LEAD_STATUSES, type LeadStatus } from '../components/leadsRaiox/raioxTypes'

/**
 * Página Leads Raio-X — leads e abandonos da ferramenta pública de análise
 * de lojas (Raio-X da Loja). Lê direto do Supabase do projeto raiox
 * (client próprio em components/leadsRaiox/raioxSupabase.ts), no padrão
 * visual do módulo Lojas.
 */

const TABS = [
  { key: 'leads', label: 'Leads' },
  { key: 'abandonos', label: 'Abandonos' },
] as const

type TabKey = (typeof TABS)[number]['key']

/** Leads criados no mês corrente (contador do topo). */
function isDoMes(isoDate: string, now = new Date()): boolean {
  const d = new Date(isoDate)
  return (
    d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
  )
}

export default function LeadsRaiox() {
  const queryClient = useQueryClient()

  const [tab, setTab] = useState<TabKey>('leads')
  const [statusFilter, setStatusFilter] = useState<LeadStatus | 'todos'>(
    'todos'
  )
  const [search, setSearch] = useState('')

  const {
    data: leads,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['raiox-leads'],
    queryFn: fetchLeads,
    enabled: !raioxConfigMissing,
  })

  const leadsNovos = (leads ?? []).filter((l) => l.status === 'novo').length
  const totalMes = (leads ?? []).filter((l) => isDoMes(l.created_at)).length

  const refetch = () => {
    queryClient.invalidateQueries({ queryKey: ['raiox-leads'] })
    queryClient.invalidateQueries({ queryKey: ['raiox-abandonos'] })
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="hero-heading font-kanit text-4xl font-bold leading-tight sm:text-5xl">
            Leads Raio-X
          </h1>
          <p className="mt-2 text-sm font-light text-muted">
            Quem rodou o Raio-X da Loja — leads para contato e análises
            abandonadas para prospecção.
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="font-kanit text-2xl font-bold leading-none text-ink">
              {leadsNovos}
            </p>
            <p className="mt-1 text-[11px] font-light text-muted">
              leads novos
            </p>
          </div>
          <div className="text-right">
            <p className="font-kanit text-2xl font-bold leading-none text-ink">
              {totalMes}
            </p>
            <p className="mt-1 text-[11px] font-light text-muted">
              no mês
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
      </div>

      {raioxConfigMissing && (
        <div
          role="alert"
          className="mt-8 flex items-start gap-3 rounded-xl border border-amber-400/25 bg-amber-400/10 px-4 py-3"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
          <p className="text-sm font-light text-amber-100/90">
            Envs do Raio-X não configuradas. Defina VITE_RAIOX_SUPABASE_URL e
            VITE_RAIOX_SUPABASE_ANON_KEY (projeto Supabase do raiox, separado
            do admin) e faça o redeploy.
          </p>
        </div>
      )}

      {!raioxConfigMissing && (
        <>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <div
              role="tablist"
              aria-label="Seções do Raio-X"
              className="inline-flex gap-1 rounded-xl border border-white/5 bg-surface-1 p-1"
            >
              {TABS.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={tab === key}
                  onClick={() => setTab(key)}
                  className={[
                    'rounded-lg px-4 py-2 text-sm font-medium transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent',
                    tab === key
                      ? 'bg-accent/15 text-ink'
                      : 'text-muted hover:bg-white/5 hover:text-ink',
                  ].join(' ')}
                >
                  {label}
                </button>
              ))}
            </div>

            <label className="relative flex-1 basis-56">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted/60" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={
                  tab === 'leads'
                    ? 'Buscar por nome ou domínio'
                    : 'Buscar por domínio'
                }
                className="w-full rounded-xl border border-white/10 bg-surface-1 py-2.5 pl-9 pr-4 text-sm font-light text-ink placeholder:text-muted/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
              />
            </label>

            {tab === 'leads' && (
              <div className="flex flex-wrap items-center gap-1">
                <button
                  type="button"
                  onClick={() => setStatusFilter('todos')}
                  className={[
                    'rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent',
                    statusFilter === 'todos'
                      ? 'border-white/20 bg-white/10 text-ink'
                      : 'border-white/10 text-muted hover:bg-white/5 hover:text-ink',
                  ].join(' ')}
                >
                  Todos
                </button>
                {LEAD_STATUSES.map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setStatusFilter(status)}
                    className={[
                      'rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent',
                      statusFilter === status
                        ? STATUS_LEAD_META[status].active
                        : 'border-white/10 text-muted hover:bg-white/5 hover:text-ink',
                    ].join(' ')}
                  >
                    {STATUS_LEAD_META[status].label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="mt-8">
            {tab === 'leads' && isLoading && (
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

            {tab === 'leads' && isError && (
              <div className="rounded-xl border border-red-400/25 bg-red-400/10 px-6 py-8 text-center">
                <p className="text-sm font-light text-red-100/90">
                  Não deu para conectar no Supabase do Raio-X. Confira
                  VITE_RAIOX_SUPABASE_URL e VITE_RAIOX_SUPABASE_ANON_KEY.
                </p>
              </div>
            )}

            {tab === 'leads' && !isLoading && !isError && (
              <LeadsTab
                leads={leads ?? []}
                statusFilter={statusFilter}
                search={search}
              />
            )}

            {tab === 'abandonos' && (
              <AbandonosTab enabled={!raioxConfigMissing} search={search} />
            )}
          </div>
        </>
      )}
    </div>
  )
}
