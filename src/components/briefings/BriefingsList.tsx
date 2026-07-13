import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, ChevronDown, ClipboardList, Copy } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { Tables } from '../../lib/database.types'
import { formatRelativeTime, getTipoServicoMeta } from '../../lib/format'
import { formatResposta, parsePerguntas } from '../../lib/briefing'

type BriefingRow = Tables<'briefings'> & {
  projects:
    | (Pick<Tables<'projects'>, 'id' | 'nome' | 'tipo_servico'> & {
        clients: Pick<Tables<'clients'>, 'id' | 'nome' | 'empresa'> | null
      })
    | null
  briefing_templates: Pick<Tables<'briefing_templates'>, 'perguntas'> | null
}

type Filtro = 'todos' | 'aguardando' | 'respondidos'

const FILTROS: { valor: Filtro; label: string }[] = [
  { valor: 'todos', label: 'Todos' },
  { valor: 'aguardando', label: 'Aguardando' },
  { valor: 'respondidos', label: 'Respondidos' },
]

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  enviado: {
    label: 'Aguardando cliente',
    className: 'border-sky-400/20 bg-sky-400/10 text-sky-300',
  },
  pendente: {
    label: 'Não enviado',
    className: 'border-white/10 bg-white/5 text-muted',
  },
  preenchido: {
    label: 'Respondido',
    className: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300',
  },
}

export default function BriefingsList() {
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [abertoId, setAbertoId] = useState<string | null>(null)
  const [copiadoId, setCopiadoId] = useState<string | null>(null)

  const { data: briefings, isLoading, isError } = useQuery({
    queryKey: ['briefings-list'],
    queryFn: async (): Promise<BriefingRow[]> => {
      const { data, error } = await supabase
        .from('briefings')
        .select(
          '*, projects(id, nome, tipo_servico, clients(id, nome, empresa)), briefing_templates(perguntas)'
        )
      if (error) throw new Error(error.message)
      return data as BriefingRow[]
    },
  })

  const ordenados = useMemo(() => {
    const lista = [...(briefings ?? [])]
    // Aguardando primeiro; entre respondidos, mais recentes no topo.
    lista.sort((a, b) => {
      if ((a.status === 'preenchido') !== (b.status === 'preenchido')) {
        return a.status === 'preenchido' ? 1 : -1
      }
      return (b.submitted_at ?? '').localeCompare(a.submitted_at ?? '')
    })
    return lista.filter((b) => {
      if (filtro === 'aguardando') return b.status !== 'preenchido'
      if (filtro === 'respondidos') return b.status === 'preenchido'
      return true
    })
  }, [briefings, filtro])

  const copiarLink = async (briefing: BriefingRow) => {
    const url = `${window.location.origin}/briefing/${briefing.token}`
    try {
      await navigator.clipboard.writeText(url)
      setCopiadoId(briefing.id)
      setTimeout(() => setCopiadoId(null), 2000)
    } catch {
      window.prompt('Copie o link do briefing:', url)
    }
  }

  if (isLoading) {
    return (
      <div className="mt-6 space-y-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div
            key={i}
            className="h-20 animate-pulse rounded-xl bg-surface-1"
            style={{ opacity: 1 - i * 0.3 }}
          />
        ))}
      </div>
    )
  }

  if (isError) {
    return (
      <p className="mt-6 rounded-xl border border-white/5 bg-surface-1 px-6 py-8 text-center text-sm text-red-400">
        Não foi possível carregar os briefings. Recarregue a página.
      </p>
    )
  }

  return (
    <div className="mt-6">
      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        {FILTROS.map(({ valor, label }) => {
          const total = (briefings ?? []).filter((b) => {
            if (valor === 'aguardando') return b.status !== 'preenchido'
            if (valor === 'respondidos') return b.status === 'preenchido'
            return true
          }).length
          const ativo = filtro === valor
          return (
            <button
              key={valor}
              type="button"
              onClick={() => setFiltro(valor)}
              className={[
                'inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent',
                ativo
                  ? 'border-accent/40 bg-accent/15 text-ink'
                  : 'border-white/10 bg-white/5 text-muted hover:text-ink',
              ].join(' ')}
            >
              {label}
              <span className={ativo ? 'text-accent' : 'text-muted/70'}>
                {total}
              </span>
            </button>
          )
        })}
      </div>

      {/* Lista */}
      {ordenados.length === 0 ? (
        <div className="mt-6 rounded-xl border border-white/5 bg-surface-1 px-6 py-12 text-center">
          <ClipboardList className="mx-auto h-8 w-8 text-muted/50" />
          <p className="mt-3 text-sm font-light text-muted">
            Nenhum briefing por aqui ainda. Gere um link de briefing no detalhe
            de um projeto.
          </p>
        </div>
      ) : (
        <ul className="mt-6 flex list-none flex-col gap-3 p-0">
          {ordenados.map((briefing) => {
            const projeto = briefing.projects
            const cliente = projeto?.clients
            const tipoMeta = getTipoServicoMeta(projeto?.tipo_servico ?? '')
            const badge =
              STATUS_BADGE[briefing.status] ?? STATUS_BADGE.pendente
            const aberto = abertoId === briefing.id
            const perguntas = parsePerguntas(
              briefing.briefing_templates?.perguntas
            )
            const respostas =
              (briefing.respostas as Record<string, unknown> | null) ?? {}
            const respondido = briefing.status === 'preenchido'

            return (
              <li
                key={briefing.id}
                className="rounded-xl border border-white/5 bg-surface-1"
              >
                <div className="flex flex-wrap items-center gap-3 px-5 py-4">
                  <div className="min-w-0 flex-1">
                    {projeto ? (
                      <Link
                        to={`/admin/projetos/${projeto.id}`}
                        className="text-sm font-medium text-ink transition-colors duration-200 hover:text-accent"
                      >
                        {projeto.nome}
                      </Link>
                    ) : (
                      <span className="text-sm text-muted">
                        Projeto removido
                      </span>
                    )}
                    <p className="mt-0.5 truncate text-xs font-light text-muted">
                      {cliente
                        ? `${cliente.nome}${cliente.empresa ? ` · ${cliente.empresa}` : ''}`
                        : '—'}
                    </p>
                  </div>

                  <span
                    className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${tipoMeta.badgeClass}`}
                  >
                    {tipoMeta.label}
                  </span>
                  <span
                    className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${badge.className}`}
                  >
                    {badge.label}
                  </span>

                  <span className="text-xs font-light text-muted">
                    {briefing.submitted_at
                      ? `respondido ${formatRelativeTime(briefing.submitted_at)}`
                      : '—'}
                  </span>

                  {respondido ? (
                    <button
                      type="button"
                      onClick={() => setAbertoId(aberto ? null : briefing.id)}
                      aria-expanded={aberto}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-muted transition-colors duration-200 hover:border-accent/40 hover:bg-accent/10 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                    >
                      Ver respostas
                      <ChevronDown
                        className={`h-3.5 w-3.5 transition-transform duration-200 ${aberto ? 'rotate-180' : ''}`}
                      />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => copiarLink(briefing)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-muted transition-colors duration-200 hover:border-accent/40 hover:bg-accent/10 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                    >
                      {copiadoId === briefing.id ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-400" />
                          Copiado!
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          Copiar link
                        </>
                      )}
                    </button>
                  )}
                </div>

                <AnimatePresence initial={false}>
                  {aberto && respondido && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: 'easeOut' }}
                      className="overflow-hidden"
                    >
                      <dl className="space-y-4 border-t border-white/5 px-5 py-5">
                        {perguntas.map((pergunta) => {
                          const resposta = formatResposta(
                            respostas[pergunta.id]
                          )
                          return (
                            <div key={pergunta.id}>
                              <dt className="text-[11px] font-medium uppercase tracking-widest text-muted">
                                {pergunta.label}
                              </dt>
                              <dd className="mt-1 whitespace-pre-wrap text-sm text-ink">
                                {resposta ?? '—'}
                              </dd>
                            </div>
                          )
                        })}
                      </dl>
                    </motion.div>
                  )}
                </AnimatePresence>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
