import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Check,
  ClipboardList,
  Copy,
  Hourglass,
  Link2,
  SearchX,
  UserRound,
} from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import type { Tables } from '../lib/database.types'
import {
  formatRelativeTime,
  getProjectStatusMeta,
  getTipoServicoMeta,
} from '../lib/format'
import { formatResposta, parsePerguntas } from '../lib/briefing'

type ProjectWithClient = Tables<'projects'> & {
  clients: Pick<Tables<'clients'>, 'id' | 'nome' | 'empresa'> | null
}

type BriefingWithTemplate = Tables<'briefings'> & {
  briefing_templates: Pick<Tables<'briefing_templates'>, 'perguntas'> | null
}

/** Código Postgres para uuid malformado — tratado como "não encontrado". */
const INVALID_UUID_CODE = '22P02'

const COPIED_FEEDBACK_MS = 2500

function briefingUrl(token: string): string {
  return `${window.location.origin}/briefing/${token}`
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

function NotFound() {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-white/5 bg-surface-1 px-6 py-16 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-white/5">
        <SearchX className="h-6 w-6 text-muted" />
      </span>
      <h1 className="mt-5 text-lg font-semibold text-ink">
        Projeto não encontrado
      </h1>
      <p className="mt-2 max-w-xs text-sm font-light leading-relaxed text-muted">
        Este projeto não existe ou foi removido do pipeline.
      </p>
      <Link
        to="/admin/clientes"
        className="mt-6 inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-accent-2"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar para clientes
      </Link>
    </div>
  )
}

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const [copied, setCopied] = useState(false)
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (copiedTimer.current) clearTimeout(copiedTimer.current)
    }
  }, [])

  const flashCopied = () => {
    setCopied(true)
    if (copiedTimer.current) clearTimeout(copiedTimer.current)
    copiedTimer.current = setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS)
  }

  const { data: project, isLoading, isError } = useQuery({
    queryKey: ['project', id],
    enabled: Boolean(id),
    queryFn: async (): Promise<ProjectWithClient | null> => {
      const { data, error } = await supabase
        .from('projects')
        .select('*, clients(id, nome, empresa)')
        .eq('id', id ?? '')
        .maybeSingle()
      if (error) {
        if (error.code === INVALID_UUID_CODE) return null
        throw new Error(error.message)
      }
      return data
    },
  })

  const { data: briefing, isLoading: briefingLoading } = useQuery({
    queryKey: ['briefing', id],
    enabled: Boolean(project),
    queryFn: async (): Promise<BriefingWithTemplate | null> => {
      const { data, error } = await supabase
        .from('briefings')
        .select('*, briefing_templates(perguntas)')
        .eq('project_id', id ?? '')
        .limit(1)
        .maybeSingle()
      if (error) throw new Error(error.message)
      return data
    },
  })

  const generateMutation = useMutation({
    mutationFn: async (current: ProjectWithClient): Promise<string> => {
      const { data: template, error: templateError } = await supabase
        .from('briefing_templates')
        .select('id')
        .eq('tipo_servico', current.tipo_servico)
        .single()
      if (templateError) throw new Error(templateError.message)

      const { data: created, error: insertError } = await supabase
        .from('briefings')
        .insert({
          project_id: current.id,
          template_id: template.id,
          status: 'enviado',
        })
        .select('token')
        .single()
      if (insertError) throw new Error(insertError.message)

      if (current.status === 'lead') {
        const { error: updateError } = await supabase
          .from('projects')
          .update({ status: 'briefing_enviado' })
          .eq('id', current.id)
        if (updateError) throw new Error(updateError.message)
      }

      const { error: logError } = await supabase.from('activity_log').insert({
        project_id: current.id,
        user_id: user?.id ?? null,
        tipo: 'status_change',
        descricao: 'Link de briefing gerado e enviado',
      })
      if (logError) throw new Error(logError.message)

      return created.token
    },
    onSuccess: async (token, current) => {
      const didCopy = await copyToClipboard(briefingUrl(token))
      if (didCopy) flashCopied()
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['project', current.id] }),
        queryClient.invalidateQueries({ queryKey: ['briefing', current.id] }),
        queryClient.invalidateQueries({ queryKey: ['projects'] }),
        queryClient.invalidateQueries({ queryKey: ['clients'] }),
        queryClient.invalidateQueries({
          queryKey: ['client', current.client_id],
        }),
      ])
    },
  })

  const handleCopyExisting = async (token: string) => {
    const didCopy = await copyToClipboard(briefingUrl(token))
    if (didCopy) flashCopied()
  }

  if (isLoading) {
    return (
      <div aria-label="Carregando projeto">
        <div className="h-5 w-32 animate-pulse rounded bg-surface-2" />
        <div className="mt-6 h-12 w-80 animate-pulse rounded bg-surface-2" />
        <div className="mt-8 h-40 animate-pulse rounded-2xl bg-surface-1" />
      </div>
    )
  }

  if (isError) {
    return (
      <p className="rounded-2xl border border-red-500/20 bg-red-500/10 px-6 py-8 text-center text-sm text-red-400">
        Não foi possível carregar o projeto. Recarregue a página.
      </p>
    )
  }

  if (!project) return <NotFound />

  const statusMeta = getProjectStatusMeta(project.status)
  const tipoMeta = getTipoServicoMeta(project.tipo_servico)
  const perguntas = parsePerguntas(briefing?.briefing_templates?.perguntas)
  const respostas =
    briefing?.respostas && typeof briefing.respostas === 'object'
      ? (briefing.respostas as Record<string, unknown>)
      : {}

  return (
    <div>
      {/* Voltar */}
      <Link
        to={
          project.clients
            ? `/admin/clientes/${project.clients.id}`
            : '/admin/clientes'
        }
        className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-muted transition-colors duration-200 hover:text-ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {project.clients?.nome ?? 'Clientes'}
      </Link>

      {/* Header */}
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="hero-heading font-kanit text-4xl font-bold leading-tight sm:text-5xl">
            {project.nome}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-2.5">
            <span
              className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${tipoMeta.badgeClass}`}
            >
              {tipoMeta.label}
            </span>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${statusMeta.badgeClass}`}
            >
              <span
                aria-hidden
                className={`h-1.5 w-1.5 rounded-full ${statusMeta.dotClass}`}
              />
              {statusMeta.label}
            </span>
            {project.clients && (
              <Link
                to={`/admin/clientes/${project.clients.id}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[11px] font-medium text-muted transition-colors duration-200 hover:border-accent/40 hover:text-ink"
              >
                <UserRound className="h-3 w-3" />
                {project.clients.nome}
                {project.clients.empresa
                  ? ` · ${project.clients.empresa}`
                  : ''}
              </Link>
            )}
          </div>
          <p className="mt-3 text-xs font-light text-muted">
            Criado {formatRelativeTime(project.created_at)} · Atualizado{' '}
            {formatRelativeTime(project.updated_at)}
          </p>
        </div>
      </div>

      {/* Briefing */}
      <section aria-labelledby="briefing-heading" className="mt-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2
            id="briefing-heading"
            className="text-xs font-medium uppercase tracking-widest text-muted"
          >
            Briefing
          </h2>
          {copied && (
            <motion.span
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-300"
            >
              <Check className="h-3.5 w-3.5" />
              Link copiado!
            </motion.span>
          )}
        </div>

        {briefingLoading && (
          <div className="mt-4 h-32 animate-pulse rounded-2xl bg-surface-1" />
        )}

        {/* Sem briefing → gerar link */}
        {!briefingLoading && !briefing && (
          <div className="mt-4 flex flex-col items-center rounded-2xl border border-white/5 bg-surface-1 px-6 py-12 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full border border-accent/20 bg-accent/10">
              <ClipboardList className="h-5 w-5 text-accent" />
            </span>
            <p className="mt-4 max-w-sm text-sm font-light leading-relaxed text-muted">
              Nenhum briefing enviado ainda. Gere o link público e compartilhe
              com o cliente para coletar as respostas.
            </p>
            {generateMutation.isError && (
              <p className="mt-3 text-xs text-red-400" role="alert">
                Não foi possível gerar o link. Tente novamente.
              </p>
            )}
            <button
              type="button"
              disabled={generateMutation.isPending}
              onClick={() => generateMutation.mutate(project)}
              className="mt-5 inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-[0_8px_24px_-8px_rgba(108,91,242,0.6)] transition-all duration-200 hover:bg-accent-2 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <Link2 className="h-4 w-4" />
              {generateMutation.isPending
                ? 'Gerando…'
                : 'Gerar link de briefing'}
            </button>
          </div>
        )}

        {/* Briefing enviado → aguardando cliente */}
        {!briefingLoading && briefing && briefing.status !== 'preenchido' && (
          <div className="mt-4 flex flex-col items-center rounded-2xl border border-white/5 bg-surface-1 px-6 py-12 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full border border-sky-400/20 bg-sky-400/10">
              <Hourglass className="h-5 w-5 text-sky-300" />
            </span>
            <h3 className="mt-4 text-sm font-semibold text-ink">
              Aguardando resposta do cliente
            </h3>
            <p className="mt-2 max-w-sm text-sm font-light leading-relaxed text-muted">
              O link já foi gerado. Reenvie ao cliente se necessário — as
              respostas aparecem aqui assim que o briefing for preenchido.
            </p>
            <button
              type="button"
              onClick={() => void handleCopyExisting(briefing.token)}
              className="mt-5 inline-flex items-center gap-2 rounded-lg border border-white/10 bg-surface-2 px-4 py-2.5 text-sm font-medium text-ink transition-colors duration-200 hover:border-accent/40 hover:bg-accent/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <Copy className="h-4 w-4 text-accent" />
              Copiar link
            </button>
          </div>
        )}

        {/* Briefing preenchido → respostas formatadas */}
        {!briefingLoading && briefing && briefing.status === 'preenchido' && (
          <div className="mt-4 rounded-2xl border border-white/5 bg-surface-1 px-6 py-6 sm:px-8 sm:py-8">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-5">
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-ink">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-400/25 bg-emerald-400/10">
                  <Check className="h-4 w-4 text-emerald-300" />
                </span>
                Respostas do cliente
              </span>
              {briefing.submitted_at && (
                <span className="text-xs font-light text-muted">
                  Recebido {formatRelativeTime(briefing.submitted_at)}
                </span>
              )}
            </div>
            <dl className="mt-6 flex flex-col gap-6">
              {perguntas.map((pergunta, index) => {
                const resposta = formatResposta(respostas[pergunta.id])
                return (
                  <motion.div
                    key={pergunta.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: index * 0.04 }}
                  >
                    <dt className="text-[11px] font-medium uppercase tracking-widest text-muted">
                      {pergunta.label}
                    </dt>
                    <dd
                      className={`mt-1.5 whitespace-pre-line text-sm leading-relaxed ${
                        resposta ? 'text-ink' : 'text-muted/50'
                      }`}
                    >
                      {resposta ?? '—'}
                    </dd>
                  </motion.div>
                )
              })}
            </dl>
          </div>
        )}
      </section>
    </div>
  )
}
