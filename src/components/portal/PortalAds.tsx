import { Megaphone, MousePointerClick, TrendingUp } from 'lucide-react'
import { formatBRL } from '../../lib/commercial'
import { calcRoas, formatRoas } from './adsData'
import type { PortalAdsData } from './adsData'

/**
 * Seção "Seus anúncios" do portal — prestação de contas leiga do tráfego
 * pago: gasto do mês em destaque, retorno (ROAS) quando calculável e a
 * série de gasto dos últimos 30 dias como mini gráfico de barras.
 */

const CHART_HEIGHT = 56

function MiniSpendChart({ serie }: { serie: PortalAdsData['serie_30d'] }) {
  if (serie.length === 0) return null
  const max = Math.max(...serie.map((dia) => dia.gasto), 0.01)
  const barWidth = 100 / serie.length

  const totalGasto = serie.reduce((soma, dia) => soma + dia.gasto, 0)
  const ariaLabel = `Investimento diário em anúncios nos últimos ${serie.length} dias, total de ${formatBRL(totalGasto)}`

  return (
    <svg
      viewBox={`0 0 100 ${CHART_HEIGHT}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={ariaLabel}
      className="mt-4 h-14 w-full"
    >
      {serie.map((dia, i) => {
        const altura = Math.max((dia.gasto / max) * (CHART_HEIGHT - 4), 1)
        return (
          <rect
            key={dia.data}
            x={i * barWidth + barWidth * 0.15}
            y={CHART_HEIGHT - altura}
            width={barWidth * 0.7}
            height={altura}
            rx={1}
            className="fill-accent/60"
            style={{ filter: 'drop-shadow(0 0 3px rgba(108,91,242,0.5))' }}
          >
            <title>{`${dia.data}: ${formatBRL(dia.gasto)}`}</title>
          </rect>
        )
      })}
    </svg>
  )
}

export default function PortalAds({ ads }: { ads: PortalAdsData }) {
  const { mes_atual: mes, serie_30d: serie } = ads
  const roas = calcRoas(mes.gasto, mes.receita)

  return (
    <div>
      <div className="flex items-start gap-3.5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-accent/25 bg-accent/10">
          <Megaphone aria-hidden className="h-[18px] w-[18px] text-accent" />
        </span>
        <div className="min-w-0">
          <p className="tabular-nums text-2xl font-semibold text-ink">
            {formatBRL(mes.gasto)}
          </p>
          <p className="mt-0.5 text-sm font-light text-muted">
            investido em anúncios neste mês
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2">
        {roas !== null && (
          <p className="flex items-center gap-2 text-sm font-light text-muted">
            <TrendingUp aria-hidden className="h-4 w-4 shrink-0 text-emerald-300" />
            <span>
              <span className="tabular-nums font-medium text-emerald-300">
                R$ {formatRoas(roas)}
              </span>{' '}
              de retorno para cada R$ 1 investido
            </span>
          </p>
        )}
        {mes.conversoes > 0 && (
          <p className="flex items-center gap-2 text-sm font-light text-muted">
            <MousePointerClick
              aria-hidden
              className="h-4 w-4 shrink-0 text-sky-300"
            />
            <span>
              <span className="tabular-nums font-medium text-ink">
                {mes.conversoes}
              </span>{' '}
              {mes.conversoes === 1 ? 'venda/contato gerado' : 'vendas/contatos gerados'}{' '}
              neste mês
            </span>
          </p>
        )}
      </div>

      <MiniSpendChart serie={serie} />
    </div>
  )
}
