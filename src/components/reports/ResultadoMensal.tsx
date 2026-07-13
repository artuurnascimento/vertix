import { useId, useMemo } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { LineChart } from 'lucide-react'
import { formatBRL } from '../../lib/commercial'
import DashboardCard from '../dashboard/DashboardCard'
import { CardEmptyState, CardErrorState, CardSkeleton } from '../dashboard/CardStates'
import { useReportExpenses, useReportReceivables } from './useReportsData'

const MONTHS_BACK = 6
const VIEW_WIDTH = 400
const VIEW_HEIGHT = 140
const PADDING_Y = 12

interface MonthResult {
  key: string
  label: string
  entradas: number
  despesas: number
  saldo: number
}

const monthLabelFormatter = new Intl.DateTimeFormat('pt-BR', { month: 'short' })

/** Gera o aria-label do gráfico com o insight real (saldo acumulado + melhor mês). */
function buildResultadoAriaLabel(meses: readonly MonthResult[]): string {
  if (meses.length === 0) return 'Entradas e despesas dos últimos 6 meses, sem dados'
  const saldoTotal = meses.reduce((sum, m) => sum + m.saldo, 0)
  const melhor = meses.reduce((max, m) => (m.saldo > max.saldo ? m : max), meses[0])
  return `Entradas e despesas dos últimos ${meses.length} meses, saldo acumulado ${formatBRL(saldoTotal)}, melhor resultado em ${melhor.label}`
}

/** Últimos N meses (mais antigo primeiro), incluindo o mês corrente. */
function buildLastMonths(count: number, now = new Date()): { key: string; label: string }[] {
  const months: { key: string; label: string }[] = []
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    months.push({ key, label: monthLabelFormatter.format(d).replace('.', '') })
  }
  return months
}

function buildPath(values: number[], min: number, max: number): string {
  const range = max - min || 1
  const step = values.length > 1 ? VIEW_WIDTH / (values.length - 1) : 0
  return values
    .map((value, index) => {
      const x = index * step
      const normalized = (value - min) / range
      const y = VIEW_HEIGHT - PADDING_Y - normalized * (VIEW_HEIGHT - PADDING_Y * 2)
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`
    })
    .join(' ')
}

/** Entradas (recebíveis pagas) − despesas por mês, últimos 6 meses. */
export default function ResultadoMensal() {
  const { data: receivables, isLoading: loadingReceivables, isError: errorReceivables } =
    useReportReceivables()
  const { data: expenses, isLoading: loadingExpenses, isError: errorExpenses } =
    useReportExpenses()
  const prefersReducedMotion = useReducedMotion()
  const glowIdEntradas = useId()
  const glowIdDespesas = useId()

  const isLoading = loadingReceivables || loadingExpenses
  const isError = errorReceivables || errorExpenses

  const meses = useMemo((): MonthResult[] => {
    const months = buildLastMonths(MONTHS_BACK)
    const entradasPorMes = new Map<string, number>()
    for (const r of receivables ?? []) {
      if (r.status !== 'pago' || !r.pago_em) continue
      const key = r.pago_em.slice(0, 7)
      entradasPorMes.set(key, (entradasPorMes.get(key) ?? 0) + r.valor)
    }
    const despesasPorMes = new Map<string, number>()
    for (const e of expenses ?? []) {
      const key = e.data.slice(0, 7)
      despesasPorMes.set(key, (despesasPorMes.get(key) ?? 0) + e.valor)
    }

    return months.map(({ key, label }) => {
      const entradas = entradasPorMes.get(key) ?? 0
      const despesas = despesasPorMes.get(key) ?? 0
      return { key, label, entradas, despesas, saldo: entradas - despesas }
    })
  }, [receivables, expenses])

  const hasData = meses.some((m) => m.entradas > 0 || m.despesas > 0)

  const { pathEntradas, pathDespesas } = useMemo(() => {
    const allValues = meses.flatMap((m) => [m.entradas, m.despesas])
    const max = Math.max(...allValues, 0)
    const min = 0
    return {
      pathEntradas: buildPath(
        meses.map((m) => m.entradas),
        min,
        max
      ),
      pathDespesas: buildPath(
        meses.map((m) => m.despesas),
        min,
        max
      ),
    }
  }, [meses])

  const saldoTotal = meses.reduce((sum, m) => sum + m.saldo, 0)
  const resultadoAriaLabel = useMemo(() => buildResultadoAriaLabel(meses), [meses])

  return (
    <DashboardCard
      title="Resultado — últimos 6 meses"
      subtitle="Entradas pagas menos despesas, por mês"
    >
      {isLoading && <CardSkeleton rows={3} rowClassName="h-10" />}

      {isError && <CardErrorState />}

      {!isLoading && !isError && !hasData && (
        <CardEmptyState
          icon={LineChart}
          title="Sem movimentação"
          description="Assim que houver entradas ou despesas registradas, o gráfico aparece aqui."
        />
      )}

      {!isLoading && !isError && hasData && (
        <div>
          {/* Alternativa textual acessível — mesmos dados do SVG, oculta visualmente. */}
          <table className="sr-only">
            <caption>{resultadoAriaLabel}</caption>
            <thead>
              <tr>
                <th scope="col">Mês</th>
                <th scope="col">Entradas</th>
                <th scope="col">Despesas</th>
                <th scope="col">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {meses.map((m) => (
                <tr key={m.key}>
                  <th scope="row">{m.label}</th>
                  <td>{formatBRL(m.entradas)}</td>
                  <td>{formatBRL(m.despesas)}</td>
                  <td>{formatBRL(m.saldo)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <svg
            viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
            preserveAspectRatio="none"
            className="h-32 w-full sm:h-36"
            role="img"
            aria-label={resultadoAriaLabel}
          >
            <defs>
              <filter id={glowIdEntradas} x="-20%" y="-100%" width="140%" height="300%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="2" />
              </filter>
              <filter id={glowIdDespesas} x="-20%" y="-100%" width="140%" height="300%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="2" />
              </filter>
            </defs>
            {/* Gridlines sutis de referência (25/50/75%) — nunca competem com as linhas de dado. */}
            {[0.25, 0.5, 0.75].map((ratio) => (
              <line
                key={ratio}
                x1={0}
                x2={VIEW_WIDTH}
                y1={PADDING_Y + (VIEW_HEIGHT - PADDING_Y * 2) * ratio}
                y2={PADDING_Y + (VIEW_HEIGHT - PADDING_Y * 2) * ratio}
                stroke="white"
                strokeOpacity={0.04}
              />
            ))}
            {/* Despesas — vermelho */}
            <motion.path
              d={pathDespesas}
              fill="none"
              stroke="#F87171"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              filter={`url(#${glowIdDespesas})`}
              opacity={0.5}
              initial={prefersReducedMotion ? false : { pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
            <motion.path
              d={pathDespesas}
              fill="none"
              stroke="#F87171"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={prefersReducedMotion ? false : { pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
            {/* Entradas — verde */}
            <motion.path
              d={pathEntradas}
              fill="none"
              stroke="#34D399"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              filter={`url(#${glowIdEntradas})`}
              opacity={0.6}
              initial={prefersReducedMotion ? false : { pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.8, ease: 'easeOut', delay: 0.1 }}
            />
            <motion.path
              d={pathEntradas}
              fill="none"
              stroke="#34D399"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={prefersReducedMotion ? false : { pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.8, ease: 'easeOut', delay: 0.1 }}
            />
          </svg>

          <div className="mt-2 flex justify-between text-[10px] uppercase tracking-widest tabular-nums text-muted">
            {meses.map((m) => (
              <span key={m.key}>{m.label}</span>
            ))}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-5 border-t border-white/5 pt-4 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_6px_#34D399]" />
              <span className="text-muted">Entradas</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-red-400 shadow-[0_0_6px_#F87171]" />
              <span className="text-muted">Despesas</span>
            </span>
            <span className="ml-auto flex items-center gap-1.5">
              <span className="text-muted">Saldo 6 meses</span>
              <span
                className={`font-kanit text-sm font-semibold tabular-nums ${saldoTotal >= 0 ? 'text-emerald-300' : 'text-red-300'}`}
              >
                {formatBRL(saldoTotal)}
              </span>
            </span>
          </div>
        </div>
      )}
    </DashboardCard>
  )
}
