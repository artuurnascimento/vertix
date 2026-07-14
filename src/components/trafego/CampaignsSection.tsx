import { useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  AlertTriangle,
  ChevronRight,
  ImageOff,
  Layers,
  RefreshCw,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { Tables } from '../../lib/database.types'
import { formatBRL } from '../../lib/commercial'
import { formatDerived, roas } from './adMetrics'

/**
 * Drill-down de campanhas dentro do detalhe da conta (spec tracking
 * avançado): nível 1 = campanhas persistidas (sync diário); níveis 2/3 =
 * conjuntos e anúncios AO VIVO via fetch-campaign-breakdown (nada no banco).
 * Navegação por breadcrumb, nunca acordeões aninhados.
 */

type CampaignRow = Tables<'ad_campaigns'> & {
  ad_campaign_metrics_daily: Array<{
    gasto: number
    receita: number | null
    data: string
  }>
}

interface BreakdownItem {
  id: string
  nome: string
  gasto: number
  impressoes: number
  cliques: number
  conversoes: number
  receita: number
  thumbnail_url?: string
}

type Nivel =
  | { view: 'campanhas' }
  | { view: 'conjuntos'; campanha: CampaignRow }
  | { view: 'anuncios'; campanha: CampaignRow }

const TOKEN_ERROR_MSG = 'META_ADS_TOKEN não configurado'
const BREAKDOWN_STALE_MS = 5 * 60 * 1000

function monthStartISO(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
}

function num(v: number): string {
  return v.toLocaleString('pt-BR')
}

function useBreakdown(campaignId: string | null, level: 'adset' | 'ad' | null) {
  return useQuery({
    queryKey: ['ad-breakdown', campaignId, level],
    enabled: Boolean(campaignId && level),
    staleTime: BREAKDOWN_STALE_MS,
    retry: false,
    queryFn: async (): Promise<BreakdownItem[]> => {
      const { data, error } = await supabase.functions.invoke(
        'fetch-campaign-breakdown',
        { body: { campaign_id: campaignId, level } }
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
      return (data as { itens?: BreakdownItem[] })?.itens ?? []
    },
  })
}

function BreakdownTable({
  itens,
  comThumbnail,
}: {
  itens: BreakdownItem[]
  comThumbnail: boolean
}) {
  if (itens.length === 0) {
    return (
      <p className="py-6 text-center text-sm font-light text-muted">
        Sem dados neste mês.
      </p>
    )
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead>
          <tr className="text-[10px] font-medium uppercase tracking-widest text-muted">
            <th className="pb-2 pr-3 font-medium">Nome</th>
            <th className="pb-2 pr-3 font-medium">Gasto</th>
            <th className="pb-2 pr-3 font-medium">Impressões</th>
            <th className="pb-2 pr-3 font-medium">Cliques</th>
            <th className="pb-2 pr-3 font-medium">Conversões</th>
            <th className="pb-2 font-medium">ROAS</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {itens.map((item) => (
            <tr key={item.id} className="tabular-nums text-ink/85">
              <td className="max-w-[240px] py-2 pr-3">
                <span className="flex items-center gap-2.5">
                  {comThumbnail &&
                    (item.thumbnail_url ? (
                      <img
                        src={item.thumbnail_url}
                        alt=""
                        className="h-10 w-10 shrink-0 rounded-lg border border-white/10 object-cover"
                      />
                    ) : (
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5">
                        <ImageOff className="h-4 w-4 text-muted/60" />
                      </span>
                    ))}
                  <span className="truncate font-sans text-sm text-ink">
                    {item.nome}
                  </span>
                </span>
              </td>
              <td className="py-2 pr-3">{formatBRL(item.gasto)}</td>
              <td className="py-2 pr-3">{num(item.impressoes)}</td>
              <td className="py-2 pr-3">{num(item.cliques)}</td>
              <td className="py-2 pr-3">{num(item.conversoes)}</td>
              <td className="py-2">{formatDerived(roas(item.gasto, item.receita))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function BreakdownView({
  campanha,
  level,
}: {
  campanha: CampaignRow
  level: 'adset' | 'ad'
}) {
  const { data, isLoading, isError, error, refetch } = useBreakdown(
    campanha.id,
    level
  )

  if (isLoading) {
    return <div className="h-32 animate-pulse rounded-xl bg-surface-2" />
  }

  if (isError) {
    const tokenAusente = (error as Error).message.includes(TOKEN_ERROR_MSG)
    return (
      <div
        role="alert"
        className="flex flex-col items-start gap-3 rounded-xl border border-amber-400/25 bg-amber-400/10 px-4 py-3"
      >
        <p className="flex items-center gap-2 text-sm font-light text-amber-100/90">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-300" />
          {tokenAusente
            ? 'Configure META_ADS_TOKEN para ver conjuntos e anúncios ao vivo.'
            : 'Não foi possível buscar os dados na Meta.'}
        </p>
        {!tokenAusente && (
          <button
            type="button"
            onClick={() => refetch()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-muted transition-colors duration-150 hover:bg-white/5 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          >
            <RefreshCw className="h-3 w-3" />
            Tentar de novo
          </button>
        )}
      </div>
    )
  }

  return <BreakdownTable itens={data ?? []} comThumbnail={level === 'ad'} />
}

export default function CampaignsSection({ accountId }: { accountId: string }) {
  const prefersReducedMotion = useReducedMotion()
  const [nivel, setNivel] = useState<Nivel>({ view: 'campanhas' })

  const { data: campanhas, isLoading } = useQuery({
    queryKey: ['ad-campaigns', accountId],
    queryFn: async (): Promise<CampaignRow[]> => {
      const { data, error } = await supabase
        .from('ad_campaigns')
        .select('*, ad_campaign_metrics_daily(gasto, receita, data)')
        .eq('ad_account_id', accountId)
        .gte('ad_campaign_metrics_daily.data', monthStartISO())
      if (error) throw new Error(error.message)
      return data as CampaignRow[]
    },
  })

  const crumb = (
    <nav aria-label="Navegação de campanhas" className="flex flex-wrap items-center gap-1.5 text-xs">
      <button
        type="button"
        onClick={() => setNivel({ view: 'campanhas' })}
        className={`rounded px-1.5 py-1 font-medium transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${
          nivel.view === 'campanhas'
            ? 'text-ink'
            : 'text-accent hover:text-accent-2'
        }`}
      >
        Campanhas
      </button>
      {nivel.view !== 'campanhas' && (
        <>
          <ChevronRight className="h-3 w-3 text-muted/50" />
          <button
            type="button"
            onClick={() => setNivel({ view: 'conjuntos', campanha: nivel.campanha })}
            className={`max-w-[200px] truncate rounded px-1.5 py-1 font-medium transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${
              nivel.view === 'conjuntos'
                ? 'text-ink'
                : 'text-accent hover:text-accent-2'
            }`}
          >
            {nivel.campanha.nome}
          </button>
        </>
      )}
      {nivel.view === 'anuncios' && (
        <>
          <ChevronRight className="h-3 w-3 text-muted/50" />
          <span className="px-1.5 py-1 font-medium text-ink">Anúncios</span>
        </>
      )}
    </nav>
  )

  return (
    <div className="mt-2 border-t border-white/5 pt-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-widest text-muted">
          <Layers className="h-3.5 w-3.5" />
          Tracking de campanhas
        </p>
        {crumb}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={nivel.view + ('campanha' in nivel ? nivel.campanha.id : '')}
          initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, x: -12 }}
          transition={{ duration: 0.18 }}
        >
          {nivel.view === 'campanhas' && (
            <>
              {isLoading && (
                <div className="h-24 animate-pulse rounded-xl bg-surface-2" />
              )}
              {!isLoading && (campanhas ?? []).length === 0 && (
                <p className="py-4 text-sm font-light text-muted">
                  Nenhuma campanha sincronizada ainda — rode "Sincronizar" com
                  o token da Meta configurado.
                </p>
              )}
              {!isLoading && (campanhas ?? []).length > 0 && (
                <ul className="flex list-none flex-col gap-2 p-0">
                  {(campanhas ?? []).map((campanha) => {
                    const mes = campanha.ad_campaign_metrics_daily.reduce(
                      (acc, m) => ({
                        gasto: acc.gasto + m.gasto,
                        receita: acc.receita + (m.receita ?? 0),
                      }),
                      { gasto: 0, receita: 0 }
                    )
                    const ativa = campanha.status === 'ACTIVE'
                    return (
                      <li key={campanha.id}>
                        <button
                          type="button"
                          onClick={() =>
                            setNivel({ view: 'conjuntos', campanha })
                          }
                          className="flex w-full min-h-11 touch-manipulation flex-wrap items-center gap-3 rounded-xl border border-white/5 bg-surface-2 px-4 py-3 text-left transition-colors duration-150 hover:border-accent/30 hover:bg-accent/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-ink">
                              {campanha.nome}
                            </span>
                            <span className="mt-0.5 block text-[11px] font-light text-muted">
                              {campanha.objetivo ?? 'objetivo não informado'}
                            </span>
                          </span>
                          {campanha.status && (
                            <span
                              className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                                ativa
                                  ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300'
                                  : 'border-white/10 bg-white/5 text-muted'
                              }`}
                            >
                              {ativa ? 'Ativa' : campanha.status.toLowerCase()}
                            </span>
                          )}
                          <span className="text-right">
                            <span className="block tabular-nums text-sm font-semibold text-ink">
                              {formatBRL(mes.gasto)}
                            </span>
                            <span className="block text-[11px] font-light text-muted">
                              ROAS {formatDerived(roas(mes.gasto, mes.receita))}
                            </span>
                          </span>
                          <ChevronRight className="h-4 w-4 shrink-0 text-muted/50" />
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </>
          )}

          {nivel.view === 'conjuntos' && (
            <div className="flex flex-col gap-4">
              <BreakdownView campanha={nivel.campanha} level="adset" />
              <button
                type="button"
                onClick={() =>
                  setNivel({ view: 'anuncios', campanha: nivel.campanha })
                }
                className="self-start rounded-lg border border-white/10 px-4 py-2 text-xs font-medium text-muted transition-colors duration-150 hover:border-accent/40 hover:bg-accent/10 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
              >
                Ver anúncios da campanha →
              </button>
            </div>
          )}

          {nivel.view === 'anuncios' && (
            <BreakdownView campanha={nivel.campanha} level="ad" />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
