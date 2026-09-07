export const ABAS = [
  { key: 'checkouts', label: 'Checkouts' },
  { key: 'cupons', label: 'Cupons' },
] as const

export type AbaCheckout = (typeof ABAS)[number]['key']

/** Abas da página de checkouts, no mesmo padrão das do Vertix Scan. */
export default function CheckoutsAbas({
  valor,
  onChange,
}: {
  valor: AbaCheckout
  onChange: (valor: AbaCheckout) => void
}) {
  return (
    <div
      role="tablist"
      aria-label="Seções de checkout"
      className="inline-flex gap-1 rounded-xl border border-white/5 bg-surface-1 p-1"
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
