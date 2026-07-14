import { Fragment, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, ChevronDown, Copy, Link2, Plus, Radar } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { Tables } from '../../lib/database.types'
import { formatBRL } from '../../lib/commercial'
import ConfirmDeleteButton from '../finance/ConfirmDeleteButton'
import {
  breakdownForCampaign,
  buildUtmUrl,
  groupByCampaign,
  makeSnippet,
  UTM_META_DEFAULTS,
} from './utm'
import type { SessionRow, UtmParams } from './utm'

/**
 * Rastreamento UTM first-party: snippet de instalação, construtor de links
 * com placeholders dinâmicos da Meta e atribuição própria (sessões captadas
 * × conversões) comparada com o que a Meta reporta no mês.
 */

const UTM_FIELDS: Array<{ chave: keyof UtmParams; label: string }> = [
  { chave: 'utm_source', label: 'utm_source' },
  { chave: 'utm_medium', label: 'utm_medium (conjunto)' },
  { chave: 'utm_campaign', label: 'utm_campaign (campanha)' },
  { chave: 'utm_content', label: 'utm_content (anúncio)' },
  { chave: 'utm_term', label: 'utm_term' },
]

function monthStartISO(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
}

function CopyButton({ texto, label }: { texto: string; label: string }) {
  const [copiado, setCopiado] = useState(false)
  return (
    <button
      type="button"
      aria-label={label}
      onClick={() => {
        void navigator.clipboard.writeText(texto).then(() => {
          setCopiado(true)
          setTimeout(() => setCopiado(false), 2000)
        })
      }}
      className="inline-flex min-h-9 touch-manipulation items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-muted transition-colors duration-150 hover:bg-white/5 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
    >
      {copiado ? (
        <Check className="h-3.5 w-3.5 text-emerald-300" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
      {copiado ? 'Copiado!' : 'Copiar'}
    </button>
  )
}

const inputClass =
  'w-full rounded-lg border border-white/10 bg-surface-2 px-3 py-2 text-sm text-ink placeholder:text-muted/60 focus:border-accent/60 focus:outline-none'

export default function UtmSection() {
  const queryClient = useQueryClient()

  const [nome, setNome] = useState('')
  const [destino, setDestino] = useState('')
  const [params, setParams] = useState<UtmParams>(UTM_META_DEFAULTS)
  const [erro, setErro] = useState<string | null>(null)
  const [abertaCampanha, setAbertaCampanha] = useState<string | null>(null)

  const urlFinal = buildUtmUrl(destino, params)
  const snippet = makeSnippet(
    import.meta.env.VITE_SUPABASE_URL as string,
    import.meta.env.VITE_SUPABASE_ANON_KEY as string
  )

  const { data: links } = useQuery({
    queryKey: ['utm-links'],
    queryFn: async (): Promise<Tables<'utm_links'>[]> => {
      const { data, error } = await supabase
        .from('utm_links')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw new Error(error.message)
      return data
    },
  })

  // Sessões do mês com conversões aninhadas — agregadas client-side.
  const { data: sessoes } = useQuery({
    queryKey: ['utm-attribution'],
    queryFn: async (): Promise<SessionRow[]> => {
      const { data, error } = await supabase
        .from('utm_sessions')
        .select('utm_campaign, utm_medium, utm_content, utm_conversions(tipo, valor)')
        .gte('created_at', `${monthStartISO()}T00:00:00`)
      if (error) throw new Error(error.message)
      return data as SessionRow[]
    },
  })

  // Nome + números da Meta por campanha (mês) para o comparativo.
  const { data: campanhasMeta } = useQuery({
    queryKey: ['ad-campaigns', 'comparativo'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ad_campaigns')
        .select(
          'meta_campaign_id, nome, ad_campaign_metrics_daily(gasto, receita, data)'
        )
        .gte('ad_campaign_metrics_daily.data', monthStartISO())
      if (error) throw new Error(error.message)
      return data
    },
  })

  const metaPorCampanha = useMemo(() => {
    const mapa = new Map<
      string,
      { nome: string; gasto: number; receita: number }
    >()
    for (const camp of campanhasMeta ?? []) {
      const gasto = camp.ad_campaign_metrics_daily.reduce(
        (soma, m) => soma + m.gasto,
        0
      )
      const receita = camp.ad_campaign_metrics_daily.reduce(
        (soma, m) => soma + (m.receita ?? 0),
        0
      )
      mapa.set(camp.meta_campaign_id, { nome: camp.nome, gasto, receita })
    }
    return mapa
  }, [campanhasMeta])

  const atribuicao = useMemo(() => groupByCampaign(sessoes ?? []), [sessoes])

  const salvarMutation = useMutation({
    mutationFn: async () => {
      if (nome.trim() === '' || destino.trim() === '') {
        throw new Error('Nome e URL de destino são obrigatórios.')
      }
      const { error } = await supabase.from('utm_links').insert({
        nome: nome.trim(),
        url_destino: destino.trim(),
        utm_source: params.utm_source.trim() || 'facebook',
        utm_medium: params.utm_medium.trim() || null,
        utm_campaign: params.utm_campaign.trim() || null,
        utm_content: params.utm_content.trim() || null,
        utm_term: params.utm_term.trim() || null,
      })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      setErro(null)
      setNome('')
      setDestino('')
      setParams(UTM_META_DEFAULTS)
      void queryClient.invalidateQueries({ queryKey: ['utm-links'] })
    },
    onError: (err: Error) => setErro(err.message),
  })

  const excluirMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('utm_links').delete().eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ['utm-links'] }),
  })

  return (
    <section aria-labelledby="utm-heading" className="mt-12">
      <div className="flex items-center gap-2.5">
        <Radar className="h-5 w-5 text-accent" />
        <h2
          id="utm-heading"
          className="font-kanit text-xl font-semibold text-ink"
        >
          Rastreamento UTM
        </h2>
      </div>
      <p className="mt-1 text-sm font-light text-muted">
        Atribuição própria: seus UTMs captam visitas e vendas no destino —
        independente do que a Meta reporta.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Instalação */}
        <div className="rounded-xl border border-white/5 bg-surface-1 p-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-kanit text-sm font-semibold uppercase tracking-widest text-muted">
              1 · Instalar no site
            </h3>
            <CopyButton texto={snippet} label="Copiar snippet de instalação" />
          </div>
          <p className="mt-2 text-xs font-light text-muted">
            Cole antes do <code className="font-mono">&lt;/body&gt;</code> do
            site ou no custom pixel da Shopify. Conversão manual:{' '}
            <code className="font-mono text-ink/80">
              vtx.convert({'{'}tipo:'purchase', valor:297.9, ref:'PED-1'{'}'})
            </code>
          </p>
          <pre className="mt-3 max-h-44 overflow-auto rounded-lg bg-black/40 p-3 text-[11px] leading-relaxed text-ink/70">
            {snippet}
          </pre>
        </div>

        {/* Construtor */}
        <div className="rounded-xl border border-white/5 bg-surface-1 p-5">
          <h3 className="font-kanit text-sm font-semibold uppercase tracking-widest text-muted">
            2 · Gerar link rastreado
          </h3>
          <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
            <input
              aria-label="Nome do link"
              placeholder="Nome (ex.: Coleção Verão)"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className={inputClass}
            />
            <input
              aria-label="URL de destino"
              placeholder="https://loja-do-cliente.com"
              value={destino}
              onChange={(e) => setDestino(e.target.value)}
              className={inputClass}
            />
            {UTM_FIELDS.map((campo) => (
              <input
                key={campo.chave}
                aria-label={campo.label}
                placeholder={campo.label}
                value={params[campo.chave]}
                onChange={(e) =>
                  setParams((atual) => ({
                    ...atual,
                    [campo.chave]: e.target.value,
                  }))
                }
                className={`${inputClass} font-mono text-xs`}
              />
            ))}
          </div>

          {urlFinal !== '' && (
            <div className="mt-3 flex items-center gap-2">
              <p className="min-w-0 flex-1 truncate rounded-lg bg-black/30 px-3 py-2 font-mono text-[11px] text-ink/75">
                {urlFinal}
              </p>
              <CopyButton texto={urlFinal} label="Copiar URL rastreada" />
            </div>
          )}

          {erro && (
            <p role="alert" className="mt-2 text-xs text-red-300">
              {erro}
            </p>
          )}

          <button
            type="button"
            onClick={() => salvarMutation.mutate()}
            disabled={salvarMutation.isPending}
            className="mt-3 inline-flex min-h-10 touch-manipulation items-center gap-2 rounded-xl bg-accent px-4 py-2 font-kanit text-sm font-semibold text-white shadow-lg shadow-accent/25 transition-colors duration-200 hover:bg-accent-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus size={15} strokeWidth={2.5} />
            Salvar link
          </button>
        </div>
      </div>

      {/* Links salvos */}
      {(links ?? []).length > 0 && (
        <ul className="mt-6 flex list-none flex-col gap-2 p-0">
          {(links ?? []).map((link) => {
            const url = buildUtmUrl(link.url_destino, {
              utm_source: link.utm_source,
              utm_medium: link.utm_medium ?? '',
              utm_campaign: link.utm_campaign ?? '',
              utm_content: link.utm_content ?? '',
              utm_term: link.utm_term ?? '',
            })
            return (
              <li
                key={link.id}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-white/5 bg-surface-1 px-4 py-3"
              >
                <Link2 className="h-4 w-4 shrink-0 text-accent/80" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink">{link.nome}</p>
                  <p className="truncate font-mono text-[11px] font-light text-muted">
                    {url}
                  </p>
                </div>
                <CopyButton texto={url} label={`Copiar link ${link.nome}`} />
                <ConfirmDeleteButton
                  onConfirm={() => excluirMutation.mutate(link.id)}
                  label={`Excluir link ${link.nome}`}
                />
              </li>
            )
          })}
        </ul>
      )}

      {/* Atribuição */}
      <div className="mt-8">
        <h3 className="font-kanit text-sm font-semibold uppercase tracking-widest text-muted">
          3 · O que seus UTMs captaram (mês)
        </h3>
        {atribuicao.length === 0 ? (
          <p className="mt-3 rounded-xl border border-white/5 bg-surface-1 px-5 py-8 text-center text-sm font-light text-muted">
            Nenhuma sessão captada ainda. Instale o snippet no site de destino
            e as visitas dos anúncios aparecem aqui.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="text-[10px] font-medium uppercase tracking-widest text-muted">
                  <th className="pb-2 pr-3 font-medium">Campanha</th>
                  <th className="pb-2 pr-3 font-medium">Sessões</th>
                  <th className="pb-2 pr-3 font-medium">Conversões</th>
                  <th className="pb-2 pr-3 font-medium">Receita (UTM)</th>
                  <th className="pb-2 pr-3 font-medium">Receita (Meta)</th>
                  <th className="pb-2 font-medium">Gasto (Meta)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {atribuicao.map((linha) => {
                  const meta = metaPorCampanha.get(linha.campanha)
                  const aberta = abertaCampanha === linha.campanha
                  return (
                    <Fragment key={linha.campanha}>
                      <tr className="tabular-nums text-ink/85">
                        <td className="max-w-[220px] py-2 pr-3">
                          <button
                            type="button"
                            aria-expanded={aberta}
                            aria-label={`Breakdown de ${meta?.nome ?? linha.campanha}`}
                            onClick={() =>
                              setAbertaCampanha(aberta ? null : linha.campanha)
                            }
                            className="inline-flex max-w-full items-center gap-1.5 truncate text-left text-ink transition-colors duration-150 hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                          >
                            <ChevronDown
                              className={`h-3.5 w-3.5 shrink-0 transition-transform duration-200 ${aberta ? 'rotate-180' : ''}`}
                            />
                            <span className="truncate">
                              {meta?.nome ?? linha.campanha}
                            </span>
                          </button>
                        </td>
                        <td className="py-2 pr-3">{linha.sessoes}</td>
                        <td className="py-2 pr-3">{linha.conversoes}</td>
                        <td className="py-2 pr-3 font-semibold text-emerald-300">
                          {formatBRL(linha.receita)}
                        </td>
                        <td className="py-2 pr-3">
                          {meta ? formatBRL(meta.receita) : '—'}
                        </td>
                        <td className="py-2">
                          {meta ? formatBRL(meta.gasto) : '—'}
                        </td>
                      </tr>
                      {aberta && (
                        <tr>
                          <td colSpan={6} className="pb-4 pt-1">
                            <div className="grid gap-4 rounded-xl border border-white/5 bg-surface-2/60 p-4 sm:grid-cols-2">
                              {(
                                [
                                  ['utm_medium', 'Por conjunto (utm_medium)'],
                                  ['utm_content', 'Por anúncio (utm_content)'],
                                ] as const
                              ).map(([dimensao, titulo]) => {
                                const grupos = breakdownForCampaign(
                                  sessoes ?? [],
                                  linha.campanha,
                                  dimensao
                                )
                                return (
                                  <div key={dimensao}>
                                    <p className="text-[10px] font-medium uppercase tracking-widest text-muted">
                                      {titulo}
                                    </p>
                                    <ul className="mt-2 flex list-none flex-col gap-1 p-0">
                                      {grupos.map((grupo) => (
                                        <li
                                          key={grupo.campanha}
                                          className="flex items-baseline justify-between gap-3 text-xs tabular-nums text-ink/80"
                                        >
                                          <span className="min-w-0 truncate font-mono">
                                            {grupo.campanha}
                                          </span>
                                          <span className="shrink-0 text-muted">
                                            {grupo.sessoes} sess ·{' '}
                                            {grupo.conversoes} conv ·{' '}
                                            <span className="font-semibold text-emerald-300">
                                              {formatBRL(grupo.receita)}
                                            </span>
                                          </span>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )
                              })}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}
