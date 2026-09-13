import { useId, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  FileText,
  FolderKanban,
  Search,
  Settings,
} from 'lucide-react'
import { CardErrorState, CardSkeleton } from './CardStates'

export interface WorkspaceItem {
  id: string
  title: string
  subtitle: string
  value: string
  meta: string
  steps: { label: string; detail: string; done: boolean }[]
  nextAction: string
  actionLabel: string
  to: string
}

/** Shared master/detail surface for operational dashboard tabs. */
export default function WorkspacePanel({
  title,
  items,
  loading,
  error,
  emptyText,
}: {
  title: string
  items: WorkspaceItem[]
  loading: boolean
  error: boolean
  emptyText: string
}) {
  const headingId = useId()
  const [search, setSearch] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const visible = items.filter((item) =>
    `${item.title} ${item.subtitle}`
      .toLocaleLowerCase('pt-BR')
      .includes(search.toLocaleLowerCase('pt-BR'))
  )
  const selected = visible.find((item) => item.id === selectedId) ?? visible[0]
  const select = (item: WorkspaceItem) => {
    setSelectedId(item.id)
    if (window.matchMedia('(max-width: 767px)').matches)
      dialog.current?.showModal()
  }
  const initials = (name: string) =>
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => word[0])
      .join('')
      .toUpperCase()
  const detail = selected && (
    <div className="vx-opportunity-detail">
      <div className="vx-detail-top">
        <div className="vx-detail-title">
          <span className="vx-avatar">{initials(selected.title)}</span>
          <div>
            <h3>{selected.title}</h3>
            <p>{selected.subtitle}</p>
          </div>
        </div>
        <div className="vx-detail-value">
          <strong>{selected.value}</strong>
          <span className="vx-next-badge">
            <i />
            Próximo passo
          </span>
        </div>
      </div>
      <h4 className="vx-journey-heading">
        {title === 'Projetos' ? 'Jornada do projeto' : 'Resumo da prioridade'}
      </h4>
      <ol className="vx-timeline">
        {selected.steps.map((step, index) => {
          const Icon = index === 0 ? Check : index === 1 ? FileText : Settings
          return (
            <li key={step.label} className={step.done ? 'is-done' : ''}>
              <span className="vx-step-dot">
                <Icon size={27} />
              </span>
              <div>
                <strong>{step.label}</strong>
                <small>{step.detail}</small>
              </div>
            </li>
          )
        })}
      </ol>
      <div className="vx-detail-footer">
        <div className="vx-next-action">
          <small>Próxima ação</small>
          <span>
            <CalendarDays size={23} />
            {selected.nextAction}
          </span>
        </div>
        <Link
          className="vx-proposal-cta"
          to={selected.to}
          onClick={() => dialog.current?.close()}
        >
          {selected.actionLabel}
          <ArrowRight size={19} />
        </Link>
      </div>
    </div>
  )
  return (
    <section className="vx-opportunities vx-glass" aria-labelledby={headingId}>
      <div className="vx-panel-heading">
        <h2 id={headingId}>
          {title} <span>{loading || error ? '—' : items.length}</span>
        </h2>
        <button
          type="button"
          className="vx-icon-button"
          aria-label={`Buscar ${title.toLocaleLowerCase('pt-BR')}`}
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
            aria-label={`Filtrar ${title.toLocaleLowerCase('pt-BR')}`}
            placeholder="Buscar…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        )}
      </div>
      {loading ? (
        <div className="vx-workspace-state">
          <CardSkeleton rows={3} rowClassName="h-20" />
        </div>
      ) : error ? (
        <div className="vx-workspace-state">
          <CardErrorState />
        </div>
      ) : !items.length ? (
        <div className="vx-empty vx-workspace-state">
          <FolderKanban />
          <h3>{emptyText}</h3>
          <p>
            {title === 'Projetos'
              ? 'Os projetos cadastrados aparecem aqui, com sua etapa e próxima ação.'
              : 'Nenhuma parcela atrasada, proposta sem resposta ou briefing aguardando retorno.'}
          </p>
        </div>
      ) : (
        <div className="vx-opportunity-grid">
          <div className="vx-opportunity-list">
            {!visible.length && (
              <p className="vx-search-empty">Nenhum resultado encontrado.</p>
            )}
            {visible.map((item) => (
              <button
                type="button"
                key={item.id}
                className={`vx-opportunity-row ${selected?.id === item.id ? 'is-selected' : ''}`}
                aria-pressed={selected?.id === item.id}
                onClick={() => select(item)}
              >
                <span className="vx-avatar">{initials(item.title)}</span>
                <span className="vx-opportunity-copy">
                  <strong>{item.title}</strong>
                  <small>{item.subtitle}</small>
                </span>
                <span className="vx-row-value">
                  <strong>{item.value}</strong>
                  <small>{item.meta}</small>
                </span>
                <ArrowRight size={17} />
              </button>
            ))}
          </div>
          <div className="vx-desktop-detail">{detail}</div>
        </div>
      )}
      <dialog
        ref={dialog}
        className="vx-detail-dialog"
        aria-label={`Detalhes de ${title.toLocaleLowerCase('pt-BR')}`}
      >
        <header>
          <button
            type="button"
            className="vx-icon-button"
            aria-label={`Voltar para ${title.toLocaleLowerCase('pt-BR')}`}
            onClick={() => dialog.current?.close()}
          >
            <ArrowLeft />
          </button>
          <h2>{title}</h2>
        </header>
        {detail}
      </dialog>
    </section>
  )
}
