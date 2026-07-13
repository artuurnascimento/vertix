import type { ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  CheckCheck,
  ClipboardList,
  LinkIcon,
  ShieldCheck,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import LogoMark from '../../components/ui/LogoMark'
import { getTipoServicoMeta } from '../../lib/format'
import {
  formatBRL,
  formatDateBR,
  getProposalStatusMeta,
} from '../../lib/commercial'
import {
  parsePortalByToken,
  parsePortalFiles,
} from '../../components/portal/portalData'
import type {
  PortalData,
  PortalProposta,
} from '../../components/portal/portalData'
import PortalStepper from '../../components/portal/PortalStepper'
import PortalTimeline from '../../components/portal/PortalTimeline'
import PortalFiles from '../../components/portal/PortalFiles'
import PortalApproval from '../../components/portal/PortalApproval'
import PortalTicketForm from '../../components/portal/PortalTicketForm'

/** Código Postgres para uuid malformado — tratado como link inválido. */
const INVALID_UUID_CODE = '22P02'

const CARD_STAGGER_S = 0.09
const EASE_OUT = [0.25, 0.1, 0.25, 1] as const

/** E-mail de contato exibido no rodapé (placeholder até ter domínio final). */
const CONTACT_EMAIL = 'contato@vertix.com.br'

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-bg px-4 py-10 font-kanit sm:px-6 sm:py-16">
      <div className="mx-auto w-full max-w-2xl">
        <header className="flex items-center gap-2.5">
          <LogoMark className="h-7 w-7" />
          <span className="text-sm font-semibold tracking-[0.35em] text-ink">
            VERTIX
          </span>
        </header>
        {children}
      </div>
    </div>
  )
}

function InvalidLinkScreen() {
  return (
    <Shell>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: EASE_OUT }}
        className="mt-14 flex flex-col items-center rounded-2xl border border-white/5 bg-surface-1 px-6 py-16 text-center sm:mt-20"
      >
        <span className="flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-white/5">
          <LinkIcon className="h-6 w-6 text-muted" />
        </span>
        <h1 className="hero-heading mt-6 text-2xl font-bold sm:text-3xl">
          Link inválido ou expirado
        </h1>
        <p className="mt-3 max-w-sm text-sm font-light leading-relaxed text-muted">
          Este link do portal não é válido. Peça um novo link para a equipe
          Vertix.
        </p>
      </motion.div>
    </Shell>
  )
}

function LoadingScreen() {
  return (
    <Shell>
      <div className="mt-12 sm:mt-16" aria-label="Carregando portal">
        <div className="h-3 w-44 animate-pulse rounded bg-surface-2" />
        <div className="mt-3 h-9 w-72 max-w-full animate-pulse rounded bg-surface-2" />
        <div className="mt-3 h-4 w-56 max-w-full animate-pulse rounded bg-surface-2" />
        <div className="mt-8 h-48 animate-pulse rounded-2xl bg-surface-1" />
        <div className="mt-4 h-32 animate-pulse rounded-2xl bg-surface-1" />
        <div className="mt-4 h-64 animate-pulse rounded-2xl bg-surface-1" />
      </div>
    </Shell>
  )
}

interface PortalCardProps {
  index: number
  title?: string
  className?: string
  children: ReactNode
}

function PortalCard({ index, title, className, children }: PortalCardProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.4,
        delay: 0.15 + index * CARD_STAGGER_S,
        ease: EASE_OUT,
      }}
      className={`rounded-2xl border border-white/5 bg-surface-1 p-5 sm:p-6 ${className ?? ''}`}
    >
      {title && (
        <h2 className="mb-5 text-xs font-semibold uppercase tracking-[0.2em] text-muted">
          {title}
        </h2>
      )}
      {children}
    </motion.section>
  )
}

function BriefingCta({ token }: { token: string }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3.5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-accent/25 bg-accent/10">
          <ClipboardList aria-hidden className="h-[18px] w-[18px] text-accent" />
        </span>
        <div>
          <p className="text-sm font-medium text-ink">
            Próximo passo: preencher o briefing
          </p>
          <p className="mt-1 text-sm font-light leading-relaxed text-muted">
            Suas respostas orientam cada decisão do projeto — leva poucos
            minutos.
          </p>
        </div>
      </div>
      <Link
        to={`/briefing/${token}`}
        className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-accent px-5 py-3 text-sm font-semibold text-white shadow-[0_8px_24px_-8px_rgba(108,91,242,0.6)] transition-all duration-200 hover:bg-accent-2 hover:shadow-[0_10px_28px_-8px_rgba(85,70,224,0.7)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        Preencher briefing
        <ArrowRight aria-hidden className="h-4 w-4" />
      </Link>
    </div>
  )
}

function BriefingDone() {
  return (
    <div className="flex items-center gap-3.5">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-emerald-400/25 bg-emerald-400/10">
        <CheckCheck aria-hidden className="h-[18px] w-[18px] text-emerald-300" />
      </span>
      <div>
        <p className="text-sm font-medium text-ink">Briefing recebido ✓</p>
        <p className="mt-0.5 text-sm font-light text-muted">
          Obrigado! Suas respostas já estão com a equipe.
        </p>
      </div>
    </div>
  )
}

function ProposalRow({ proposta }: { proposta: PortalProposta }) {
  const meta = getProposalStatusMeta(proposta.status)
  const isRecusada = proposta.status === 'recusada'

  return (
    <li
      className={`rounded-xl border border-white/5 bg-surface-2 p-4 ${isRecusada ? 'opacity-60' : ''}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink">{proposta.titulo}</p>
          <p className="mt-1 text-lg font-semibold text-ink">
            {formatBRL(proposta.valor_total)}
          </p>
        </div>
        <span
          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${meta.badgeClass}`}
        >
          {meta.label}
        </span>
      </div>

      {proposta.status === 'enviada' && (
        <Link
          to={`/proposta/${proposta.token}`}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-5 py-3 text-sm font-semibold text-white shadow-[0_8px_24px_-8px_rgba(108,91,242,0.6)] transition-all duration-200 hover:bg-accent-2 hover:shadow-[0_10px_28px_-8px_rgba(85,70,224,0.7)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:w-auto"
        >
          Ver e responder proposta
          <ArrowRight aria-hidden className="h-4 w-4" />
        </Link>
      )}

      {proposta.status === 'aceita' && (
        <p className="mt-2 text-xs font-light text-emerald-300">
          {proposta.sent_at
            ? `Aceita em ${formatDateBR(proposta.sent_at)}`
            : 'Proposta aceita'}
        </p>
      )}
    </li>
  )
}

function DeliveryApprovedSeal() {
  return (
    <div className="flex items-center gap-3.5">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-emerald-400/25 bg-emerald-400/10">
        <ShieldCheck aria-hidden className="h-[18px] w-[18px] text-emerald-300" />
      </span>
      <div>
        <p className="text-sm font-medium text-ink">Entrega aprovada</p>
        <p className="mt-0.5 text-sm font-light text-muted">
          Obrigado por revisar o projeto com a gente.
        </p>
      </div>
    </div>
  )
}

function PortalContent({ data, token }: { data: PortalData; token: string }) {
  const { projeto, cliente, briefing, propostas, atividades } = data
  const tipoMeta = getTipoServicoMeta(projeto.tipo_servico)

  const showBriefingCta =
    briefing != null && briefing.status !== 'preenchido' && Boolean(briefing.token)
  const showBriefingDone = briefing != null && briefing.status === 'preenchido'
  const showBriefingCard = showBriefingCta || showBriefingDone

  const showApprovalCard = projeto.status === 'revisao'
  const showApprovedSeal = projeto.status === 'entregue'

  const { data: files } = useQuery({
    queryKey: ['portal-files', token],
    enabled: Boolean(token),
    retry: false,
    queryFn: async () => {
      const { data: payload, error } = await supabase.rpc('get_portal_files', {
        p_token: token,
      })
      if (error) throw new Error(error.message)
      return parsePortalFiles(payload)
    },
  })
  const showFilesCard = Boolean(files && files.length > 0)

  let cardIndex = 0

  return (
    <Shell>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE_OUT }}
        className="mt-10 sm:mt-14"
      >
        <p className="text-xs font-medium uppercase tracking-[0.25em] text-muted">
          Acompanhamento do projeto
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
          <h1 className="hero-heading text-3xl font-bold leading-tight sm:text-4xl">
            {projeto.nome}
          </h1>
          <span
            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${tipoMeta.badgeClass}`}
          >
            {tipoMeta.label}
          </span>
        </div>
        <p className="mt-4 text-sm font-light leading-relaxed text-muted">
          Olá, <span className="font-normal text-ink">{cliente.nome}</span> —
          acompanhe aqui cada etapa do seu projeto.
        </p>
      </motion.div>

      <div className="mt-8 flex flex-col gap-4">
        <PortalCard index={cardIndex++} title="Etapa do projeto">
          <PortalStepper status={projeto.status} />
        </PortalCard>

        {(showApprovalCard || showApprovedSeal) && (
          <PortalCard
            index={cardIndex++}
            className={
              showApprovalCard ? 'border-accent/20 bg-accent/[0.04]' : undefined
            }
          >
            {showApprovalCard ? (
              <PortalApproval token={token} />
            ) : (
              <DeliveryApprovedSeal />
            )}
          </PortalCard>
        )}

        {showBriefingCard && (
          <PortalCard
            index={cardIndex++}
            className={
              showBriefingCta ? 'border-accent/20 bg-accent/[0.04]' : undefined
            }
          >
            {showBriefingCta && briefing?.token ? (
              <BriefingCta token={briefing.token} />
            ) : (
              <BriefingDone />
            )}
          </PortalCard>
        )}

        {propostas.length > 0 && (
          <PortalCard index={cardIndex++} title="Propostas">
            <ul className="flex flex-col gap-3">
              {propostas.map((proposta) => (
                <ProposalRow key={proposta.token} proposta={proposta} />
              ))}
            </ul>
          </PortalCard>
        )}

        {showFilesCard && (
          <PortalCard index={cardIndex++} title="Arquivos">
            <PortalFiles files={files ?? []} />
          </PortalCard>
        )}

        <PortalCard index={cardIndex++} title="Últimas atualizações">
          <PortalTimeline atividades={atividades} />
        </PortalCard>

        <PortalCard index={cardIndex++}>
          <PortalTicketForm token={token} />
        </PortalCard>
      </div>

      <motion.footer
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.5 }}
        className="mt-12 flex flex-col items-center gap-1 pb-6 text-center"
      >
        <p className="text-sm font-light text-muted">Dúvidas? Fale com a Vertix.</p>
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className="text-xs font-medium text-accent transition-colors duration-200 hover:text-accent-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {CONTACT_EMAIL}
        </a>
      </motion.footer>
    </Shell>
  )
}

export default function Portal() {
  const { token } = useParams<{ token: string }>()

  const { data, isLoading, isError } = useQuery({
    queryKey: ['portal', token],
    enabled: Boolean(token),
    retry: false,
    queryFn: async () => {
      const { data: payload, error } = await supabase.rpc(
        'get_portal_by_token',
        { t: token ?? '' }
      )
      if (error) {
        if (error.code === INVALID_UUID_CODE) return null
        throw new Error(error.message)
      }
      return parsePortalByToken(payload)
    },
  })

  if (isLoading) return <LoadingScreen />
  if (isError || !data) return <InvalidLinkScreen />

  return <PortalContent data={data} token={token ?? ''} />
}
