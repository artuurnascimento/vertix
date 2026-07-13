import { useId, useMemo } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { ArrowDownCircle, ArrowUpCircle, Scale } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { formatBRL } from '../../lib/commercial'

interface ReceivablePaid {
  valor: number
  pago_em: string | null
}

interface ExpenseRow {
  valor: number
  data: string
}

interface MonthBucket {
  key: string
  label: string
  entradas: number
  saidas: number
  isCurrent: boolean
}

const MONTHS_SHOWN = 6
const CHART_HEIGHT = 96
const BAR_GAP = 6

const shortMonthFormatter = new Intl.DateTimeFormat('pt-BR', { month: 'short' })

function monthKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${date.getFullYear()}-${month}`
}

/** 'YYYY-MM' do mês corrente no fuso local. */
function currentMonthKey(now = new Date()): string {
  return monthKey(now)
}

function buildMonthBuckets(
  receivables: readonly ReceivablePaid[],
  expenses: readonly ExpenseRow[],
  now: Date
): MonthBucket[] {
  const currentKey = monthKey(now)
  return Array.from({ length: MONTHS_SHOWN }, (_, i) => {
    const date = new Date(
      now.getFullYear(),
      now.getMonth() - (MONTHS_SHOWN - 1 - i),
      1
    )
    const key = monthKey(date)
    const entradas = receivables
      .filter((r) => r.pago_em && r.pago_em.slice(0, 7) === key)
      .reduce((sum, r) => sum + r.valor, 0)
    const saidas = expenses
      .filter((e) => e.data.slice(0, 7) === key)
      .reduce((sum, e) => sum + e.valor, 0)
    return {
      key,
      label: shortMonthFormatter.format(date).replace('.', ''),
      entradas,
      saidas,
      isCurrent: key === currentKey,
    }
  })
}

/** Fluxo de caixa do mês corrente (Entradas/Saídas/Resultado) + mini gráfico de barras dos últimos 6 meses. */
export default function CashFlowSummary() {
  const prefersReducedMotion = useReducedMotion()
  const barGradientId = useId()

  const { data: receivables, isLoading: loadingReceivables } = useQuery({
    queryKey: ['expenses', 'cashflow-receivables'],
    queryFn: async (): Promise<ReceivablePaid[]> => {
      const { data, error } = await supabase
        .from('receivables')
        .select('valor, pago_em')
        .eq('status', 'pago')
      if (error) throw new Error(error.message)
      return data
    },
  })

  const { data: expenses, isLoading: loadingExpenses } = useQuery({
    queryKey: ['expenses', 'cashflow-expenses'],
    queryFn: async (): Promise<ExpenseRow[]> => {
      const { data, error } = await supabase.from('expenses').select('valor, data')
      if (error) throw new Error(error.message)
      return data
    },
  })

  const isLoading = loadingReceivables || loadingExpenses

  const monthKeyNow = currentMonthKey()

  const entradasMes = useMemo(
    () =>
      (receivables ?? [])
        .filter((r) => r.pago_em && r.pago_em.slice(0, 7) === monthKeyNow)
        .reduce((sum, r) => sum + r.valor, 0),
    [receivables, monthKeyNow]
  )

  const saidasMes = useMemo(
    () =>
      (expenses ?? [])
        .filter((e) => e.data.slice(0, 7) === monthKeyNow)
        .reduce((sum, e) => sum + e.valor, 0),
    [expenses, monthKeyNow]
  )

  const resultado = entradasMes - saidasMes

  const buckets = useMemo(
    () => buildMonthBuckets(receivables ?? [], expenses ?? [], new Date()),
    [receivables, expenses]
  )

  const maxValue = Math.max(...buckets.flatMap((b) => [b.entradas, b.saidas]), 1)

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-2xl border border-white/5 bg-surface-1"
          />
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:col-span-2 lg:grid-cols-3">
        <div className="rounded-2xl border border-white/5 bg-surface-1 p-5">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-medium uppercase tracking-widest text-muted/70">
              Entradas
            </p>
            <ArrowUpCircle aria-hidden className="h-4 w-4 text-emerald-400/70" />
          </div>
          <p className="mt-3 font-kanit text-2xl font-semibold leading-none text-emerald-300">
            {formatBRL(entradasMes)}
          </p>
        </div>

        <div className="rounded-2xl border border-white/5 bg-surface-1 p-5">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-medium uppercase tracking-widest text-muted/70">
              Saídas
            </p>
            <ArrowDownCircle aria-hidden className="h-4 w-4 text-red-400/70" />
          </div>
          <p className="mt-3 font-kanit text-2xl font-semibold leading-none text-red-300">
            {formatBRL(saidasMes)}
          </p>
        </div>

        <div className="rounded-2xl border border-white/5 bg-surface-1 p-5">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-medium uppercase tracking-widest text-muted/70">
              Resultado
            </p>
            <Scale aria-hidden className="h-4 w-4 text-muted/60" />
          </div>
          <p
            className={`mt-3 font-kanit text-2xl font-semibold leading-none ${
              resultado >= 0 ? 'text-emerald-300' : 'text-red-300'
            }`}
          >
            {formatBRL(resultado)}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-white/5 bg-surface-1 p-5">
        <p className="text-[11px] font-medium uppercase tracking-widest text-muted/70">
          Entradas × saídas — 6 meses
        </p>
        <svg
          viewBox={`0 0 240 ${CHART_HEIGHT + 20}`}
          className="mt-3 h-24 w-full overflow-visible"
          role="img"
          aria-label="Gráfico de entradas e saídas dos últimos 6 meses"
        >
          <defs>
            <linearGradient id={barGradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#34d399" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#34d399" stopOpacity="0.5" />
            </linearGradient>
          </defs>
          {buckets.map((bucket, index) => {
            const groupWidth = 240 / MONTHS_SHOWN
            const barWidth = (groupWidth - BAR_GAP * 2) / 2
            const groupX = index * groupWidth + BAR_GAP / 2
            const entradasHeight = (bucket.entradas / maxValue) * CHART_HEIGHT
            const saidasHeight = (bucket.saidas / maxValue) * CHART_HEIGHT
            return (
              <g key={bucket.key}>
                <motion.rect
                  x={groupX}
                  y={CHART_HEIGHT - entradasHeight}
                  width={barWidth}
                  height={Math.max(entradasHeight, 1)}
                  rx={2}
                  fill={`url(#${barGradientId})`}
                  initial={prefersReducedMotion ? false : { scaleY: 0 }}
                  animate={{ scaleY: 1 }}
                  style={{ transformOrigin: `${groupX}px ${CHART_HEIGHT}px` }}
                  transition={{ duration: 0.4, delay: index * 0.05 }}
                >
                  <title>{`${bucket.label} — entradas: ${formatBRL(bucket.entradas)}`}</title>
                </motion.rect>
                <motion.rect
                  x={groupX + barWidth + BAR_GAP / 2}
                  y={CHART_HEIGHT - saidasHeight}
                  width={barWidth}
                  height={Math.max(saidasHeight, 1)}
                  rx={2}
                  fill="#f87171"
                  fillOpacity={0.75}
                  initial={prefersReducedMotion ? false : { scaleY: 0 }}
                  animate={{ scaleY: 1 }}
                  style={{
                    transformOrigin: `${groupX + barWidth + BAR_GAP / 2}px ${CHART_HEIGHT}px`,
                  }}
                  transition={{ duration: 0.4, delay: index * 0.05 + 0.05 }}
                >
                  <title>{`${bucket.label} — saídas: ${formatBRL(bucket.saidas)}`}</title>
                </motion.rect>
                <text
                  x={groupX + barWidth}
                  y={CHART_HEIGHT + 14}
                  textAnchor="middle"
                  className={`fill-current text-[8px] uppercase tracking-wider ${
                    bucket.isCurrent ? 'fill-accent font-medium' : 'fill-muted/60'
                  }`}
                  style={{ fontSize: '8px' }}
                >
                  {bucket.label}
                </text>
              </g>
            )
          })}
        </svg>
        <div className="mt-2 flex items-center gap-4 text-[10px] text-muted/70">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Entradas
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
            Saídas
          </span>
        </div>
      </div>
    </div>
  )
}
