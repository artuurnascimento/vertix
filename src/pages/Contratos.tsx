import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Tables } from '../lib/database.types'
import ContractsList from '../components/contracts/ContractsList'
import ContractTemplateEditor from '../components/contracts/ContractTemplateEditor'

const TIPO_ORDER = ['ecommerce', 'sistema', 'site'] as const

const TIPO_LABEL: Record<string, string> = {
  ecommerce: 'E-commerce',
  sistema: 'Sistema',
  site: 'Site',
}

type ContratosView = 'contratos' | 'modelos'

const VIEWS: { valor: ContratosView; label: string }[] = [
  { valor: 'contratos', label: 'Contratos' },
  { valor: 'modelos', label: 'Modelos' },
]

export default function Contratos() {
  const [view, setView] = useState<ContratosView>('contratos')
  const [activeTipo, setActiveTipo] = useState<string>('ecommerce')
  // Rascunhos por template — trocar de aba preserva edições não salvas.
  const [drafts, setDrafts] = useState<Record<string, string | null>>({})

  const { data: templates, isLoading, isError } = useQuery({
    queryKey: ['contract-templates'],
    queryFn: async (): Promise<Tables<'contract_templates'>[]> => {
      const { data, error } = await supabase.from('contract_templates').select('*')
      if (error) throw new Error(error.message)
      return data
    },
  })

  const ordered = TIPO_ORDER.map((tipo) =>
    templates?.find((t) => t.tipo_servico === tipo)
  ).filter((t): t is Tables<'contract_templates'> => Boolean(t))

  const active = ordered.find((t) => t.tipo_servico === activeTipo) ?? null

  return (
    <div>
      <div>
        <h1 className="hero-heading font-kanit text-4xl font-bold leading-tight sm:text-5xl">
          Contratos
        </h1>
        <p className="mt-2 text-sm font-light text-muted">
          Contratos gerados a partir de propostas e modelos por tipo de
          serviço.
        </p>
      </div>

      {/* Alternador Contratos | Modelos */}
      <div
        role="tablist"
        aria-label="Visão de contratos"
        className="mt-6 inline-flex gap-1 rounded-xl border border-white/5 bg-surface-1 p-1"
      >
        {VIEWS.map(({ valor, label }) => (
          <button
            key={valor}
            type="button"
            role="tab"
            aria-selected={view === valor}
            onClick={() => setView(valor)}
            className={[
              'rounded-lg px-4 py-2 text-sm font-medium transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent',
              view === valor
                ? 'bg-accent/15 text-ink'
                : 'text-muted hover:bg-white/5 hover:text-ink',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>

      {view === 'contratos' && <ContractsList />}

      {view === 'modelos' && isLoading && (
        <div className="mt-8 space-y-3">
          <div className="h-9 w-72 animate-pulse rounded-lg bg-surface-2" />
          {Array.from({ length: 3 }, (_, i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-xl bg-surface-1"
              style={{ opacity: 1 - i * 0.3 }}
            />
          ))}
        </div>
      )}

      {view === 'modelos' && isError && (
        <p className="mt-8 rounded-xl border border-white/5 bg-surface-1 px-6 py-8 text-center text-sm text-red-400">
          Não foi possível carregar os templates. Recarregue a página.
        </p>
      )}

      {view === 'modelos' && !isLoading && !isError && (
        <>
          <div
            role="tablist"
            aria-label="Tipo de serviço"
            className="mt-8 inline-flex flex-wrap gap-1 rounded-xl border border-white/5 bg-surface-1 p-1"
          >
            {ordered.map((template) => {
              const isActive = template.tipo_servico === activeTipo
              const isDirty =
                drafts[template.id] != null &&
                drafts[template.id] !== template.corpo
              return (
                <button
                  key={template.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveTipo(template.tipo_servico)}
                  className={[
                    'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent',
                    isActive
                      ? 'bg-accent/15 text-ink'
                      : 'text-muted hover:bg-white/5 hover:text-ink',
                  ].join(' ')}
                >
                  {TIPO_LABEL[template.tipo_servico] ?? template.tipo_servico}
                  {isDirty && (
                    <span
                      aria-label="Alterações não salvas"
                      className="h-1.5 w-1.5 rounded-full bg-amber-400"
                    />
                  )}
                </button>
              )
            })}
          </div>

          {active && (
            <ContractTemplateEditor
              key={active.id}
              template={active}
              draft={drafts[active.id] ?? null}
              onDraftChange={(corpo) =>
                setDrafts((prev) => ({ ...prev, [active.id]: corpo }))
              }
              onDiscard={() =>
                setDrafts((prev) => ({ ...prev, [active.id]: null }))
              }
            />
          )}
        </>
      )}
    </div>
  )
}
