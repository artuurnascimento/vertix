import {
  PERIODOS_CORRIDOS,
  mesesRecentes,
  type Periodo,
} from '../../lib/periodo'

/**
 * Faixa de filtro por período: janelas corridas (7/30/90 dias, 12 meses) e os
 * últimos meses fechados. Componente controlado — quem usa guarda o valor.
 *
 * Importado por src/pages/VertixScan.tsx e por
 * src/components/bio-admin/BioPainelResumo.tsx, para os dois painéis lerem do
 * mesmo jeito. Não toca em dados: só devolve o período escolhido.
 */

interface FiltroPeriodoProps {
  valor: Periodo
  onChange: (valor: Periodo) => void
  /** Quantos meses fechados aparecem depois das janelas corridas. */
  meses?: number
  className?: string
}

export default function FiltroPeriodo({
  valor,
  onChange,
  meses = 6,
  className = '',
}: FiltroPeriodoProps) {
  const fechados = mesesRecentes(meses)

  const chipClass = (ativo: boolean) =>
    [
      'inline-flex min-h-9 touch-manipulation items-center rounded-lg border px-3 py-1.5 text-xs font-medium capitalize transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent',
      ativo
        ? 'border-accent/60 bg-accent/15 text-ink'
        : 'border-white/10 text-muted hover:bg-white/5 hover:text-ink',
    ].join(' ')

  return (
    <div
      role="group"
      aria-label="Filtrar por período"
      className={`flex flex-wrap items-center gap-2 ${className}`}
    >
      <span className="mr-1 text-xs font-medium uppercase tracking-widest text-muted">
        Período
      </span>

      {PERIODOS_CORRIDOS.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => onChange(p.id)}
          aria-pressed={valor === p.id}
          className={chipClass(valor === p.id)}
        >
          {p.rotulo}
        </button>
      ))}

      <span aria-hidden className="mx-1 h-5 w-px bg-white/10" />

      {fechados.map((m) => (
        <button
          key={m.valor}
          type="button"
          onClick={() => onChange(m.valor)}
          aria-pressed={valor === m.valor}
          className={chipClass(valor === m.valor)}
        >
          {m.rotulo}
        </button>
      ))}
    </div>
  )
}
