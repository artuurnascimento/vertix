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
      // Três colunas desde o celular: em duas, um selo ímpar sobrava sozinho
      // na linha de baixo e a fileira parecia quebrada. Cabem lado a lado
      // porque no estreito o ícone sobe para cima do texto, em vez de
      // disputar a largura com ele.
      className="grid grid-cols-3 gap-2 sm:gap-2.5"
    >
      {selos.map((selo, indice) => (
        <li
          key={`${selo}-${indice}`}
          className="flex flex-col items-center gap-1.5 rounded-xl border border-white/[0.07] bg-surface-1/70 px-2 py-3 text-center text-[11px] font-light leading-snug text-muted sm:flex-row sm:items-center sm:gap-2.5 sm:px-3.5 sm:text-left sm:text-xs"
        >
          <BadgeCheck aria-hidden className="h-4 w-4 shrink-0 text-accent" />
          {selo}
        </li>
      ))}
    </ul>
  )
}
