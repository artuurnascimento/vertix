import { useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  FileText,
  FolderKanban,
  Search,
  CalendarDays,
  Settings,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { getProjectStatusMeta, formatRelativeTime } from '../../lib/format'
import { formatBRL, getProposalStatusMeta } from '../../lib/commercial'
import ProposalFormModal from '../proposals/ProposalFormModal'
import { CardErrorState, CardSkeleton } from './CardStates'

export interface Opportunity {
  id: string
  nome: string
  status: string
  created_at: string
  updated_at: string
  clients: { id: string; nome: string; empresa: string | null } | null
  proposals: {
    id: string
    status: string
    valor_total: number
    created_at: string
    sent_at: string | null
    accepted_at: string | null
  }[]
}

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase()
}
function latestProposal(p: Opportunity) {
  return [...p.proposals].sort((a, b) =>
    b.created_at.localeCompare(a.created_at)
  )[0]
}

export default function OpportunitiesPanel() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['dashboard', 'opportunities'],
    queryFn: async (): Promise<Opportunity[]> => {
      const { data, error } = await supabase
        .from('projects')
        .select(
          'id, nome, status, created_at, updated_at, clients(id, nome, empresa), proposals(id, status, valor_total, created_at, sent_at, accepted_at)'
        )
        .in('status', ['lead', 'briefing_enviado', 'briefing_recebido'])
        .order('updated_at', { ascending: false })
        .limit(20)
      if (error) throw new Error(error.message)
      return data
    },
  })
  const [search, setSearch] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const visible = data?.filter((p) =>
    `${p.nome} ${p.clients?.nome ?? ''} ${p.clients?.empresa ?? ''}`
      .toLocaleLowerCase('pt-BR')
      .includes(search.toLocaleLowerCase('pt-BR'))
  )
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [formProject, setFormProject] = useState<string | undefined>()
  const detailDialog = useRef<HTMLDialogElement>(null)
  const selected = visible?.find((p) => p.id === selectedId) ?? visible?.[0]
  const select = (p: Opportunity) => {
    setSelectedId(p.id)
    if (window.matchMedia('(max-width: 767px)').matches)
      detailDialog.current?.showModal()
  }
  const createProposal = (id: string) => {
    detailDialog.current?.close()
    setFormProject(id)
  }
  const details = selected && (
    <OpportunityDetail
      opportunity={selected}
      onCreate={() => createProposal(selected.id)}
      onNavigate={() => detailDialog.current?.close()}
    />
  )
  return (
    <section
      className="vx-opportunities vx-glass"
      aria-labelledby="opportunities-heading"
    >
      <div className="vx-panel-heading">
        <h2 id="opportunities-heading">
          Oportunidades <span>{data?.length ?? '—'}</span>
        </h2>
        <button
          type="button"
          className="vx-icon-button"
          aria-label="Buscar oportunidades"
          aria-expanded={searchOpen}
          onClick={() => {
            setSearchOpen(!searchOpen)
            setSearch('')
          }}
        >
          <Search size={21} />
        </button>
        {searchOpen && (
          <input
            autoFocus
            className="vx-opportunity-search"
            type="search"
            aria-label="Filtrar oportunidades"
            placeholder="Buscar cliente ou projeto…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        )}
      </div>
      {isLoading ? (
        <CardSkeleton rows={3} rowClassName="h-20" />
      ) : isError ? (
        <>
          <CardErrorState />
          <button className="vx-quiet-button" onClick={() => void refetch()}>
            Tentar novamente
          </button>
        </>
      ) : !data?.length ? (
        <div className="vx-empty">
          <FolderKanban />
          <h3>Espaço para novas oportunidades</h3>
          <p>Os projetos em captação e briefing aparecem aqui.</p>
          <Link className="vx-primary" to="/admin/projetos">
            Abrir projetos <ArrowRight size={18} />
          </Link>
        </div>
      ) : (
        <div className="vx-opportunity-grid">
          <div className="vx-opportunity-list">
            {visible?.length === 0 && (
              <p className="vx-search-empty">
                Nenhuma oportunidade encontrada.
              </p>
            )}
            {visible?.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => select(p)}
                aria-pressed={selected?.id === p.id}
                className={`vx-opportunity-row ${selected?.id === p.id ? 'is-selected' : ''}`}
              >
                <span className="vx-avatar">
                  {initials(p.clients?.empresa ?? p.nome)}
                </span>
                <span className="vx-opportunity-copy">
                  <strong>{p.clients?.empresa ?? p.nome}</strong>
                  <small>{getProjectStatusMeta(p.status).label}</small>
                </span>
                <span className="vx-row-value">
                  <strong>
                    {latestProposal(p)
                      ? formatBRL(latestProposal(p)!.valor_total)
                      : 'A definir'}
                  </strong>
                  <small>{formatRelativeTime(p.updated_at)}</small>
                </span>
                <ArrowRight size={17} />
              </button>
            ))}
          </div>
          <div className="vx-desktop-detail">{details}</div>
        </div>
      )}
      <dialog
        ref={detailDialog}
        aria-label="Detalhes da oportunidade"
        className="vx-detail-dialog"
      >
        <header>
          <button
            type="button"
            className="vx-icon-button"
            onClick={() => detailDialog.current?.close()}
            aria-label="Voltar às oportunidades"
          >
            <ArrowLeft />
          </button>
          <h2>Oportunidade</h2>
        </header>
        {details}
      </dialog>
      <ProposalFormModal
        open={!!formProject}
        lockedProjectId={formProject}
        onClose={() => setFormProject(undefined)}
      />
    </section>
  )
}

function OpportunityDetail({
  opportunity: p,
  onCreate,
  onNavigate,
}: {
  opportunity: Opportunity
  onCreate: () => void
  onNavigate: () => void
}) {
  const proposal = latestProposal(p)
  const steps = [
    {
      label: 'Projeto cadastrado',
      done: true,
      icon: Check,
      detail: new Date(p.created_at).toLocaleDateString('pt-BR', {
        day: 'numeric',
        month: 'long',
      }),
    },
    {
      label: 'Briefing recebido',
      done: p.status === 'briefing_recebido',
      icon: FileText,
      detail:
        p.status === 'briefing_recebido'
          ? 'Concluído'
          : 'Aguardando preenchimento',
    },
    {
      label: 'Proposta comercial',
      done: proposal?.status === 'aceita',
      icon: Settings,
      detail: proposal
        ? getProposalStatusMeta(proposal.status).label
        : 'Em preparação',
    },
  ]
  return (
    <div className="vx-opportunity-detail">
      <div className="vx-detail-top">
        <div className="vx-detail-title">
          <span className="vx-avatar">
            {initials(p.clients?.empresa ?? p.nome)}
          </span>
          <div>
            <h3>{p.clients?.empresa ?? p.nome}</h3>
            <p>{p.nome}</p>
          </div>
        </div>
        <div className="vx-detail-value">
          <strong>
            {proposal ? formatBRL(proposal.valor_total) : 'A definir'}
          </strong>
          <span className="vx-next-badge">
            <i />
            Próximo passo
          </span>
        </div>
      </div>
      <h4 className="vx-journey-heading">Jornada do cliente</h4>
      <ol className="vx-timeline">
        {steps.map(({ icon: Icon, ...step }) => (
          <li key={step.label} className={step.done ? 'is-done' : ''}>
            <span className="vx-step-dot">
              <Icon size={27} />
            </span>
            <div>
              <strong>{step.label}</strong>
              <small>{step.detail}</small>
            </div>
          </li>
        ))}
      </ol>
      <div className="vx-detail-footer">
        <div className="vx-next-action">
          <small>Próxima ação</small>
          <span>
            <CalendarDays size={23} />
            {proposal
              ? 'Acompanhar o andamento da proposta comercial'
              : 'Preparar proposta com as ações prioritárias'}
          </span>
        </div>
        {proposal ? (
          <Link
            to="/admin/propostas"
            onClick={onNavigate}
            className="vx-proposal-cta"
          >
            Ver propostas <ArrowRight size={19} />
          </Link>
        ) : (
          <button type="button" className="vx-proposal-cta" onClick={onCreate}>
            Criar proposta <ArrowRight size={19} />
          </button>
        )}
      </div>
      <Link
        className="vx-detail-project-link"
        to={`/admin/projetos/${p.id}`}
        onClick={onNavigate}
      >
        Ver projeto <ArrowRight size={15} />
      </Link>
    </div>
  )
}
