import { Link } from 'react-router-dom'
import { BellRing, Check } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { Tables } from '../../lib/database.types'
import { formatRelativeTime } from '../../lib/format'

type Nudge = Tables<'nudges'>

const SEVERIDADE_DOT: Record<string, string> = {
  urgente: 'bg-red-400',
  atencao: 'bg-amber-400',
  info: 'bg-sky-400',
}

/**
 * Painel de nudges: os alertas que a varredura diária (ou os gatilhos)
 * criaram e que ainda ninguém resolveu. Fecha o buraco do "ninguém cutuca".
 */
export default function NudgesPanel() {
  const queryClient = useQueryClient()

  const { data: nudges, isLoading } = useQuery({
    queryKey: ['nudges'],
    queryFn: async (): Promise<Nudge[]> => {
      const { data, error } = await supabase
        .from('nudges')
        .select('*')
        .eq('resolvido', false)
        .order('created_at', { ascending: false })
        .limit(8)
      if (error) throw new Error(error.message)
      return data
    },
  })

  const resolver = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('nudges')
        .update({ resolvido: true, resolved_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['nudges'] })
    },
  })

  return (
    <section className="flex h-full flex-col rounded-2xl border border-white/5 bg-surface-1 p-5">
      <div className="flex items-center gap-2">
        <BellRing className="h-4 w-4 text-accent" />
        <h2 className="text-sm font-semibold text-ink">Precisa de um empurrão</h2>
        {nudges && nudges.length > 0 && (
          <span className="ml-auto rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-medium tabular-nums text-accent">
            {nudges.length}
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="mt-4 space-y-2">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-surface-2" />
          ))}
        </div>
      ) : !nudges || nudges.length === 0 ? (
        <div className="mt-6 flex flex-1 flex-col items-center justify-center text-center">
          <Check className="h-7 w-7 text-emerald-400/70" />
          <p className="mt-2 text-sm font-light text-muted">
            Tudo em dia. Nenhum item travado no funil.
          </p>
        </div>
      ) : (
        <ul className="mt-3 flex list-none flex-col gap-2 p-0">
          {nudges.map((n) => {
            const dot = SEVERIDADE_DOT[n.severidade] ?? 'bg-white/40'
            const conteudo = (
              <div className="flex items-start gap-2.5">
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dot}`} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">
                    {n.titulo}
                  </p>
                  {n.descricao && (
                    <p className="mt-0.5 line-clamp-2 text-xs font-light text-muted">
                      {n.descricao}
                    </p>
                  )}
                  <p className="mt-1 text-[11px] font-light text-muted/70">
                    {formatRelativeTime(n.created_at)}
                  </p>
                </div>
              </div>
            )
            return (
              <li
                key={n.id}
                className="group flex items-center gap-2 rounded-lg border border-white/5 bg-surface-2 px-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  {n.link ? (
                    <Link
                      to={n.link}
                      className="block focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                    >
                      {conteudo}
                    </Link>
                  ) : (
                    conteudo
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => resolver.mutate(n.id)}
                  disabled={resolver.isPending}
                  aria-label={`Resolver: ${n.titulo}`}
                  title="Marcar como resolvido"
                  className="shrink-0 rounded-lg border border-white/10 p-1.5 text-muted transition-colors duration-150 hover:border-emerald-400/40 hover:bg-emerald-400/10 hover:text-emerald-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-50"
                >
                  <Check className="h-3.5 w-3.5" />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
