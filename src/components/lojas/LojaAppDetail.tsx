import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle } from 'lucide-react'
import {
  PRODUTO_META,
  callAppsProxy,
  formatMoeda,
  statsRange30d,
} from './appsProxy'
import type { AppProduto, VertixSettings, VertixStats } from './appsProxy'
import type { AppBackendEstado } from './lojasStatus'

/**
 * Detalhe expandido de um app numa loja (padrão AdAccountDetail): cartões
 * de métricas dos últimos 30 dias (carrinhos, enviados, recuperados,
 * receita recuperada na moeda do backend) + formulário das configurações
 * seguras (PATCH via apps-proxy, com invalidação das queries vivas).
 */

const STALE_TIME_MS = 60_000

const inputClass =
  'w-full rounded-lg border border-white/5 bg-surface-2 px-4 py-3 text-base text-ink placeholder:text-muted/40 outline-none transition-all duration-200 focus:border-accent/60 focus:ring-2 focus:ring-accent/25 hover:border-white/10 sm:py-2.5 sm:text-sm'
const labelClass = 'text-[11px] font-medium uppercase tracking-widest text-muted'

function num(value: number): string {
  return value.toLocaleString('pt-BR')
}

interface LojaAppDetailProps {
  shopDomain: string
  produto: AppProduto
  backendEstado: AppBackendEstado
}

function StatsCards({
  shopDomain,
  produto,
}: {
  shopDomain: string
  produto: AppProduto
}) {
  const { data: stats, isLoading, error } = useQuery({
    queryKey: ['apps-proxy', produto, 'stats', shopDomain],
    staleTime: STALE_TIME_MS,
    retry: false,
    queryFn: async (): Promise<VertixStats> => {
      const { from, to } = statsRange30d()
      return callAppsProxy<VertixStats>({
        app: produto,
        method: 'GET',
        path: `/api/vertix/shops/${shopDomain}/stats?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      })
    },
  })

  if (isLoading) {
    return <div className="h-24 animate-pulse rounded-xl bg-surface-2" />
  }

  if (error || !stats) {
    return (
      <p className="py-4 text-sm font-light text-muted">
        Não foi possível carregar as métricas desta loja.
      </p>
    )
  }

  const cards = [
    { label: 'Carrinhos (30d)', valor: num(stats.carts.total) },
    { label: 'Pendentes', valor: num(stats.carts.pending) },
    { label: 'Recuperados', valor: num(stats.carts.recovered) },
    { label: 'E-mails enviados', valor: num(stats.emailsSent) },
    { label: 'SMS enviados', valor: num(stats.smsSent) },
    {
      label: 'Receita recuperada',
      valor: formatMoeda(
        stats.revenueRecovered.amount,
        stats.revenueRecovered.currency
      ),
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-xl border border-white/5 bg-surface-2 px-4 py-3"
        >
          <p className="text-[10px] font-medium uppercase tracking-widest text-muted">
            {card.label}
          </p>
          <p className="mt-1 truncate tabular-nums text-lg font-semibold text-ink">
            {card.valor}
          </p>
        </div>
      ))}
    </div>
  )
}

function SettingsForm({
  shopDomain,
  produto,
}: {
  shopDomain: string
  produto: AppProduto
}) {
  const queryClient = useQueryClient()

  const { data: settings, isLoading, error } = useQuery({
    queryKey: ['apps-proxy', produto, 'settings', shopDomain],
    staleTime: STALE_TIME_MS,
    retry: false,
    queryFn: async (): Promise<VertixSettings> =>
      callAppsProxy<VertixSettings>({
        app: produto,
        method: 'GET',
        path: `/api/vertix/shops/${shopDomain}/settings`,
      }),
  })

  const [enabled, setEnabled] = useState(true)
  const [discountPercent, setDiscountPercent] = useState('10')
  const [language, setLanguage] = useState<'en' | 'fr'>('en')
  const [delay1, setDelay1] = useState('60')
  const [delay2, setDelay2] = useState('1440')
  const [smsEnabled, setSmsEnabled] = useState(false)
  const [smsDelay, setSmsDelay] = useState('120')
  const [fromEmail, setFromEmail] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  // Repovoa o formulário quando as configurações vivas chegam/atualizam.
  useEffect(() => {
    if (!settings) return
    setEnabled(settings.enabled)
    setDiscountPercent(String(settings.discountPercent ?? 0))
    setLanguage(settings.language ?? 'en')
    setDelay1(String(settings.delay1Minutes ?? 0))
    setDelay2(String(settings.delay2Minutes ?? 0))
    setSmsEnabled(settings.smsEnabled)
    setSmsDelay(String(settings.smsDelayMinutes ?? 0))
    setFromEmail(settings.fromEmail ?? '')
    setLogoUrl(settings.logoUrl ?? '')
  }, [settings])

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        enabled,
        discountPercent: Number(discountPercent),
        language,
        delay1Minutes: Number(delay1),
        delay2Minutes: Number(delay2),
        smsEnabled,
        smsDelayMinutes: Number(smsDelay),
        fromEmail: fromEmail.trim() === '' ? null : fromEmail.trim(),
        logoUrl: logoUrl.trim() === '' ? null : logoUrl.trim(),
      }
      return callAppsProxy<VertixSettings>({
        app: produto,
        method: 'PATCH',
        path: `/api/vertix/shops/${shopDomain}/settings`,
        body: payload,
      })
    },
    onSuccess: () => {
      setErro(null)
      setMsg('Configurações salvas na loja.')
      queryClient.invalidateQueries({
        queryKey: ['apps-proxy', produto, 'settings', shopDomain],
      })
      queryClient.invalidateQueries({ queryKey: ['apps-proxy', produto, 'status'] })
      setTimeout(() => setMsg(null), 5000)
    },
    onError: (err: Error) => {
      setMsg(null)
      setErro(err.message || 'Não foi possível salvar as configurações.')
    },
  })

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const desconto = Number(discountPercent)
    if (!Number.isFinite(desconto) || desconto < 0 || desconto > 100) {
      return setErro('Desconto deve ser um percentual entre 0 e 100.')
    }
    setErro(null)
    mutation.mutate()
  }

  if (isLoading) {
    return <div className="h-40 animate-pulse rounded-xl bg-surface-2" />
  }

  if (error || !settings) {
    return (
      <p className="py-4 text-sm font-light text-muted">
        Não foi possível carregar as configurações desta loja.
      </p>
    )
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <label className="flex flex-col gap-1.5">
          <span className={labelClass}>Status</span>
          <select
            value={enabled ? 'on' : 'off'}
            onChange={(e) => setEnabled(e.target.value === 'on')}
            className={inputClass}
          >
            <option value="on">Ativo</option>
            <option value="off">Desativado</option>
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className={labelClass}>Desconto (%)</span>
          <input
            type="number"
            min={0}
            max={100}
            value={discountPercent}
            onChange={(e) => setDiscountPercent(e.target.value)}
            className={inputClass}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className={labelClass}>Idioma</span>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as 'en' | 'fr')}
            className={inputClass}
          >
            <option value="en">Inglês</option>
            <option value="fr">Francês</option>
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className={labelClass}>E-mail remetente</span>
          <input
            type="email"
            value={fromEmail}
            onChange={(e) => setFromEmail(e.target.value)}
            placeholder="loja@dominio.com"
            className={inputClass}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className={labelClass}>1º e-mail (min)</span>
          <input
            type="number"
            min={0}
            value={delay1}
            onChange={(e) => setDelay1(e.target.value)}
            className={inputClass}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className={labelClass}>2º e-mail (min)</span>
          <input
            type="number"
            min={0}
            value={delay2}
            onChange={(e) => setDelay2(e.target.value)}
            className={inputClass}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className={labelClass}>SMS</span>
          <select
            value={smsEnabled ? 'on' : 'off'}
            onChange={(e) => setSmsEnabled(e.target.value === 'on')}
            className={inputClass}
          >
            <option value="off">Desativado</option>
            <option value="on">Ativo</option>
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className={labelClass}>SMS após (min)</span>
          <input
            type="number"
            min={0}
            value={smsDelay}
            onChange={(e) => setSmsDelay(e.target.value)}
            disabled={!smsEnabled}
            className={`${inputClass} disabled:cursor-not-allowed disabled:opacity-50`}
          />
        </label>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className={labelClass}>URL do logo</span>
        <input
          type="url"
          value={logoUrl}
          onChange={(e) => setLogoUrl(e.target.value)}
          placeholder="https://…"
          className={inputClass}
        />
      </label>

      {erro && (
        <p role="alert" className="text-xs text-red-400">
          {erro}
        </p>
      )}
      {msg && (
        <p role="status" className="text-xs text-emerald-300">
          {msg}
        </p>
      )}

      <div className="flex items-center justify-end">
        <button
          type="submit"
          disabled={mutation.isPending}
          className="min-h-11 touch-manipulation rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-accent/25 transition-colors duration-200 hover:bg-accent-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50"
        >
          {mutation.isPending ? 'Salvando…' : 'Salvar configurações'}
        </button>
      </div>
    </form>
  )
}

export default function LojaAppDetail({
  shopDomain,
  produto,
  backendEstado,
}: LojaAppDetailProps) {
  if (backendEstado !== 'ok') {
    const mensagem =
      backendEstado === 'nao_configurado'
        ? `Backend do ${PRODUTO_META[produto].nome} ainda não configurado nos secrets do Supabase.`
        : backendEstado === 'offline'
          ? `Backend do ${PRODUTO_META[produto].nome} não respondeu — métricas e configurações indisponíveis.`
          : 'Consultando backend…'
    return (
      <div className="flex items-start gap-3 rounded-xl border border-amber-400/25 bg-amber-400/10 px-4 py-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
        <p className="text-sm font-light text-amber-100/90">{mensagem}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h3 className="text-[11px] font-medium uppercase tracking-widest text-muted">
          Últimos 30 dias — {PRODUTO_META[produto].nome}
        </h3>
        <div className="mt-3">
          <StatsCards shopDomain={shopDomain} produto={produto} />
        </div>
      </div>

      <div>
        <h3 className="text-[11px] font-medium uppercase tracking-widest text-muted">
          Configurações
        </h3>
        <div className="mt-3">
          <SettingsForm shopDomain={shopDomain} produto={produto} />
        </div>
      </div>
    </div>
  )
}
