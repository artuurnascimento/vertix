import { BadgeCheck } from 'lucide-react'

/**
 * Fileira de selos configurados — no máximo três por linha, como no desenho.
 * Sem selos sobrando (o resumo serve primeiro), a fileira some.
 */
export default function SelosGrid({ selos }: { selos: string[] }) {
  if (selos.length === 0) return null

  return (
    <ul
      aria-label="Selos"
      className="grid grid-cols-2 gap-2.5 sm:grid-cols-3"
    >
      {selos.map((selo, indice) => (
        <li
          key={`${selo}-${indice}`}
          className="flex items-center gap-2.5 rounded-xl border border-white/[0.07] bg-surface-1/70 px-3.5 py-3 text-xs font-light leading-snug text-muted"
        >
          <BadgeCheck aria-hidden className="h-4 w-4 shrink-0 text-accent" />
          {selo}
        </li>
      ))}
    </ul>
  )
}
