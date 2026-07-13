import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, ChevronDown, Copy, FileSignature } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { Tables } from '../../lib/database.types'
import { formatDateBR } from '../../lib/commercial'
import { formatRelativeTime } from '../../lib/format'

type ContractRow = Tables<'contracts'> & {
  projects:
    | (Pick<Tables<'projects'>, 'id' | 'nome'> & {
        clients: Pick<Tables<'clients'>, 'id' | 'nome' | 'empresa'> | null
      })
    | null
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  enviado: {
    label: 'Aguardando assinatura',
    className: 'border-sky-400/20 bg-sky-400/10 text-sky-300',
  },
  assinado: {
    label: 'Assinado',
    className: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300',
  },
}

const UNKNOWN_BADGE = {
  label: 'Desconhecido',
  className: 'border-white/10 bg-white/5 text-muted',
}

/** Lista de contratos gerados a partir de propostas aceitas — assinatura e link público. */
export default function ContractsList() {
  const [abertoId, setAbertoId] = useState<string | null>(null)
  const [copiadoId, setCopiadoId] = useState<string | null>(null)

  const { data: contracts, isLoading, isError } = useQuery({
    queryKey: ['contracts', 'list'],
    queryFn: async (): Promise<ContractRow[]> => {
      const { data, error } = await supabase
        .from('contracts')
        .select('*, projects(id, nome, clients(id, nome, empresa))')
        .order('created_at', { ascending: false })
      if (error) throw new Error(error.message)
      return data as ContractRow[]
    },
  })

  const ordenados = useMemo(() => {
    // Aguardando assinatura primeiro, depois mais recentes.
    return [...(contracts ?? [])].sort((a, b) => {
      if ((a.status === 'assinado') !== (b.status === 'assinado')) {
        return a.status === 'assinado' ? 1 : -1
      }
      return b.created_at.localeCompare(a.created_at)
    })
  }, [contracts])

  const copiarLink = async (contract: ContractRow) => {
    const url = `${window.location.origin}/contrato/${contract.token}`
    try {
      await navigator.clipboard.writeText(url)
      setCopiadoId(contract.id)
      setTimeout(() => setCopiadoId(null), 2000)
    } catch {
      window.prompt('Copie o link do contrato:', url)
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
        Não foi possível carregar os contratos. Recarregue a página.
      </p>
    )
  }

  if (ordenados.length === 0) {
    return (
      <div className="mt-6 rounded-xl border border-white/5 bg-surface-1 px-6 py-12 text-center">
        <FileSignature className="mx-auto h-8 w-8 text-muted/50" />
        <p className="mt-3 text-sm font-light text-muted">
          Nenhum contrato gerado ainda. Contratos aparecem aqui quando uma
          proposta é aceita.
        </p>
      </div>
    )
  }

  return (
    <ul className="mt-6 flex list-none flex-col gap-3 p-0">
      {ordenados.map((contract) => {
        const projeto = contract.projects
        const cliente = projeto?.clients
        const badge = STATUS_BADGE[contract.status] ?? UNKNOWN_BADGE
        const aberto = abertoId === contract.id
        const assinado = contract.status === 'assinado'

        return (
          <li
            key={contract.id}
            className="rounded-xl border border-white/5 bg-surface-1"
          >
            <div className="flex flex-wrap items-center gap-3 px-5 py-4">
              <div className="min-w-0 flex-1">
                {projeto ? (
                  <Link
                    to={`/admin/projetos/${projeto.id}`}
                    className="text-sm font-medium text-ink transition-colors duration-200 hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                  >
                    {projeto.nome}
                  </Link>
                ) : (
                  <span className="text-sm text-muted">Projeto removido</span>
                )}
                <p className="mt-0.5 truncate text-xs font-light text-muted">
                  {cliente
                    ? `${cliente.nome}${cliente.empresa ? ` · ${cliente.empresa}` : ''}`
                    : '—'}
                </p>
              </div>

              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${badge.className}`}
              >
                {badge.label}
              </span>

              <span className="text-xs font-light tabular-nums text-muted">
                {assinado && contract.signed_at
                  ? `assinado em ${formatDateBR(contract.signed_at.slice(0, 10))}`
                  : `criado ${formatRelativeTime(contract.created_at)}`}
              </span>

              <button
                type="button"
                onClick={() => copiarLink(contract)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-muted transition-colors duration-200 hover:border-accent/40 hover:bg-accent/10 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
              >
                {copiadoId === contract.id ? (
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

              <button
                type="button"
                onClick={() => setAbertoId(aberto ? null : contract.id)}
                aria-expanded={aberto}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-muted transition-colors duration-200 hover:border-accent/40 hover:bg-accent/10 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
              >
                Ver corpo
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform duration-200 ${aberto ? 'rotate-180' : ''}`}
                />
              </button>
            </div>

            <AnimatePresence initial={false}>
              {aberto && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                  className="overflow-hidden"
                >
                  <div className="border-t border-white/5 px-5 py-5">
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink/90">
                      {contract.corpo_final}
                    </p>
                    {assinado && (
                      <dl className="mt-4 grid grid-cols-1 gap-3 border-t border-white/5 pt-4 text-xs sm:grid-cols-2">
                        <div>
                          <dt className="font-medium uppercase tracking-widest text-muted">
                            Assinado por
                          </dt>
                          <dd className="mt-0.5 text-ink/90">
                            {contract.signer_name ?? '—'}
                          </dd>
                        </div>
                        <div>
                          <dt className="font-medium uppercase tracking-widest text-muted">
                            Documento
                          </dt>
                          <dd className="mt-0.5 text-ink/90">
                            {contract.signer_document ?? '—'}
                          </dd>
                        </div>
                      </dl>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </li>
        )
      })}
    </ul>
  )
}
