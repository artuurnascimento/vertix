import { motion, useReducedMotion } from 'framer-motion'
import { ExternalLink, SearchX } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { formatRelativeTime } from '../../lib/format'
import { fetchAbandonos, teaserUrl } from './raioxData'
import ScoreBadge from './ScoreBadge'

/**
 * Aba Abandonos — analyses dos últimos 30 dias sem lead correspondente.
 * Lista de prospecção: a pessoa rodou o Raio-X e não deixou contato.
 */

interface AbandonosTabProps {
  enabled: boolean
  search: string
}

export default function AbandonosTab({ enabled, search }: AbandonosTabProps) {
  const prefersReducedMotion = useReducedMotion()

  const {
    data: abandonos,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['raiox-abandonos'],
    queryFn: fetchAbandonos,
    enabled,
  })

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div
            key={i}
            className="h-14 animate-pulse rounded-xl bg-surface-1"
            style={{ opacity: 1 - i * 0.3 }}
          />
        ))}
      </div>
    )
  }

  if (isError) {
    return (
      <div className="rounded-xl border border-red-400/25 bg-red-400/10 px-6 py-8 text-center">
        <p className="text-sm font-light text-red-100/90">
          Não deu para carregar os abandonos. Confira a conexão e tente de novo.
        </p>
      </div>
    )
  }

  const termo = search.trim().toLowerCase()
  const visiveis = (abandonos ?? []).filter(
    (a) => termo === '' || a.domain.toLowerCase().includes(termo)
  )

  if ((abandonos ?? []).length === 0) {
    return (
      <div className="rounded-xl border border-white/5 bg-surface-1 px-6 py-14 text-center">
        <SearchX className="mx-auto h-8 w-8 text-muted/50" />
        <p className="mt-3 text-sm font-light text-muted">
          Nenhum abandono nos últimos 30 dias. Toda análise virou lead.
        </p>
      </div>
    )
  }

  if (visiveis.length === 0) {
    return (
      <div className="rounded-xl border border-white/5 bg-surface-1 px-6 py-10 text-center">
        <p className="text-sm font-light text-muted">
          Nenhum abandono com essa busca.
        </p>
      </div>
    )
  }

  return (
    <ul className="flex list-none flex-col gap-3 p-0">
      {visiveis.map((analysis) => (
        <motion.li
          key={analysis.id}
          initial={prefersReducedMotion ? undefined : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-xl border border-white/5 bg-surface-1 px-5 py-4"
        >
          <div className="min-w-0 flex-1 basis-48">
            <p className="truncate font-mono text-sm font-medium text-ink">
              {analysis.domain}
            </p>
            <p className="mt-0.5 truncate text-xs font-light text-muted">
              Rodou a análise e não deixou contato.
            </p>
          </div>

          <ScoreBadge score={analysis.score} />

          <span className="tabular-nums text-xs font-light text-muted">
            {formatRelativeTime(analysis.created_at)}
          </span>

          <a
            href={teaserUrl(analysis.id)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-muted transition-colors duration-150 hover:bg-white/5 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Abrir teaser
          </a>
        </motion.li>
      ))}
    </ul>
  )
}
