/**
 * Abas da página Vertix Scan: quem chegou (Leads) e quem comprou (Vendas).
 * Componente controlado, no mesmo padrão das abas do Financeiro. O filtro de
 * período fica FORA daqui, acima das abas, porque vale para as duas.
 */

export const ABAS = [
  { key: 'leads', label: 'Leads' },
  { key: 'vendas', label: 'Vendas' },
] as const

export type AbaKey = (typeof ABAS)[number]['key']

interface ScanAbasProps {
  valor: AbaKey
  onChange: (valor: AbaKey) => void
  className?: string
}

export default function ScanAbas({
  valor,
  onChange,
  className = '',
}: ScanAbasProps) {
  return (
    <div
      role="tablist"
      aria-label="Seções do Vertix Scan"
      className={`inline-flex gap-1 rounded-xl border border-white/5 bg-surface-1 p-1 ${className}`}
    >
      {ABAS.map(({ key, label }) => (
        <button
          key={key}
          type="button"
          role="tab"
          aria-selected={valor === key}
          onClick={() => onChange(key)}
          className={[
            'rounded-lg px-4 py-2 text-sm font-medium transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent',
            valor === key
              ? 'bg-accent/15 text-ink'
              : 'text-muted hover:bg-white/5 hover:text-ink',
          ].join(' ')}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
