import { useId, useMemo } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { PieChart } from 'lucide-react'
import { getTipoServicoMeta } from '../../lib/format'
import AnimatedNumber from './AnimatedNumber'
import DashboardCard from './DashboardCard'
import { CardEmptyState, CardErrorState, CardSkeleton } from './CardStates'
import { useDashboardProjects } from './useDashboardData'

interface DonutSlice {
  tipo: string
  label: string
  count: number
  percent: number
  colorClass: string
  strokeHex: string
}

/** Ordem fixa + cor dedicada por tipo de serviço — mesma linguagem neon dos KPIs. */
const TIPO_COLORS: Record<string, { colorClass: string; strokeHex: string }> = {
  ecommerce: { colorClass: 'text-accent', strokeHex: '#6C5BF2' },
  sistema: { colorClass: 'text-emerald-400', strokeHex: '#34D399' },
  site: { colorClass: 'text-sky-400', strokeHex: '#38BDF8' },
}
const FALLBACK_COLOR = { colorClass: 'text-amber-400', strokeHex: '#FBBF24' }

const TIPO_ORDER = ['ecommerce', 'sistema', 'site'] as const

const RADIUS = 60
const STROKE_WIDTH = 18
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
const VIEW_SIZE = (RADIUS + STROKE_WIDTH) * 2

/** Gera o aria-label do donut com o insight real (tipo dominante). */
function buildDonutAriaLabel(slices: readonly DonutSlice[], total: number): string {
  if (total === 0) return 'Distribuição de projetos por tipo de serviço, sem projetos ainda'
  const top = slices.reduce((max, s) => (s.count > max.count ? s : max), slices[0])
  return `Distribuição de ${total} projetos por tipo de serviço, maioria ${top.label.toLowerCase()} com ${top.percent.toFixed(0)}%`
}

/** Distribuição de projetos por tipo de serviço — donut SVG com legenda. */
export default function DonutTipos() {
  const { data: projects, isLoading, isError } = useDashboardProjects()
  const prefersReducedMotion = useReducedMotion()
  const glowId = useId()

  const { slices, total } = useMemo(() => {
    const rows = projects ?? []
    const total = rows.length
    const counts = new Map<string, number>()
    for (const row of rows) {
      counts.set(row.tipo_servico, (counts.get(row.tipo_servico) ?? 0) + 1)
    }

    const knownTipos = TIPO_ORDER.filter((tipo) => counts.has(tipo))
    const otherTipos = [...counts.keys()].filter(
      (tipo) => !TIPO_ORDER.includes(tipo as (typeof TIPO_ORDER)[number])
    )
    const orderedTipos = [...knownTipos, ...otherTipos]

    const slices: DonutSlice[] = orderedTipos.map((tipo) => {
      const count = counts.get(tipo) ?? 0
      const colors = TIPO_COLORS[tipo] ?? FALLBACK_COLOR
      return {
        tipo,
        label: getTipoServicoMeta(tipo).label,
        count,
        percent: total > 0 ? (count / total) * 100 : 0,
        colorClass: colors.colorClass,
        strokeHex: colors.strokeHex,
      }
    })

    return { slices, total }
  }, [projects])

  let cumulativePercent = 0
  const donutAriaLabel = buildDonutAriaLabel(slices, total)

  return (
    <DashboardCard
      title="Por tipo de projeto"
      subtitle="Distribuição do portfólio ativo"
      variant="shallow"
    >
      {isLoading && <CardSkeleton rows={3} rowClassName="h-8" />}

      {isError && <CardErrorState />}

      {!isLoading && !isError && total === 0 && (
        <CardEmptyState
          icon={PieChart}
          title="Sem projetos ainda"
          description="Assim que houver projetos cadastrados, a distribuição por tipo aparece aqui."
        />
      )}

      {!isLoading && !isError && total > 0 && (
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:justify-around">
          {/* Alternativa textual acessível — mesmos dados do SVG, oculta visualmente. */}
          <table className="sr-only">
            <caption>{donutAriaLabel}</caption>
            <thead>
              <tr>
                <th scope="col">Tipo de projeto</th>
                <th scope="col">Quantidade</th>
                <th scope="col">Percentual</th>
              </tr>
            </thead>
            <tbody>
              {slices.map((slice) => (
                <tr key={slice.tipo}>
                  <th scope="row">{slice.label}</th>
                  <td>{slice.count}</td>
                  <td>{slice.percent.toFixed(0)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="relative shrink-0" style={{ width: VIEW_SIZE, height: VIEW_SIZE }}>
            <svg
              viewBox={`0 0 ${VIEW_SIZE} ${VIEW_SIZE}`}
              className="-rotate-90"
              role="img"
              aria-label={donutAriaLabel}
            >
              <defs>
                <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" />
                </filter>
              </defs>
              <circle
                cx={VIEW_SIZE / 2}
                cy={VIEW_SIZE / 2}
                r={RADIUS}
                fill="none"
                stroke="white"
                strokeOpacity={0.05}
                strokeWidth={STROKE_WIDTH}
              />
              {slices.map((slice, index) => {
                const dash = (slice.percent / 100) * CIRCUMFERENCE
                const offset = -((cumulativePercent / 100) * CIRCUMFERENCE)
                cumulativePercent += slice.percent
                return (
                  <g key={slice.tipo}>
                    {/* Camada borrada atrás → glow neon sutil no segmento */}
                    <motion.circle
                      cx={VIEW_SIZE / 2}
                      cy={VIEW_SIZE / 2}
                      r={RADIUS}
                      fill="none"
                      stroke={slice.strokeHex}
                      strokeWidth={STROKE_WIDTH}
                      strokeDasharray={`${dash} ${CIRCUMFERENCE - dash}`}
                      strokeDashoffset={offset}
                      strokeLinecap="round"
                      filter={`url(#${glowId})`}
                      opacity={0.5}
                      initial={prefersReducedMotion ? false : { opacity: 0 }}
                      animate={{ opacity: 0.5 }}
                      transition={{ duration: 0.5, delay: 0.1 + index * 0.08 }}
                    />
                    <motion.circle
                      cx={VIEW_SIZE / 2}
                      cy={VIEW_SIZE / 2}
                      r={RADIUS}
                      fill="none"
                      stroke={slice.strokeHex}
                      strokeWidth={STROKE_WIDTH}
                      strokeDasharray={`${dash} ${CIRCUMFERENCE - dash}`}
                      strokeDashoffset={offset}
                      strokeLinecap="round"
                      initial={prefersReducedMotion ? false : { opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.5, delay: 0.1 + index * 0.08 }}
                    >
                      <title>{`${slice.label}: ${slice.count} (${slice.percent.toFixed(0)}%)`}</title>
                    </motion.circle>
                  </g>
                )
              })}
            </svg>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <AnimatedNumber
                value={total}
                format={(v) => String(Math.round(v))}
                className="font-kanit text-3xl font-bold leading-none tabular-nums text-ink"
              />
              <span className="mt-1 text-[10px] uppercase tracking-widest text-muted">
                projetos
              </span>
            </div>
          </div>

          <ul className="flex w-full flex-col gap-2.5 sm:w-auto">
            {slices.map((slice) => (
              <li key={slice.tipo} className="flex items-center gap-2.5 text-sm">
                <span
                  aria-hidden
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{
                    backgroundColor: slice.strokeHex,
                    boxShadow: `0 0 6px ${slice.strokeHex}`,
                  }}
                />
                <span className="text-ink/90">{slice.label}</span>
                <span className="ml-auto font-kanit font-semibold tabular-nums text-ink">
                  {slice.percent.toFixed(0)}%
                </span>
                <span className="w-8 text-right text-xs font-light tabular-nums text-muted">
                  ({slice.count})
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </DashboardCard>
  )
}
