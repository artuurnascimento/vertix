import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import {
  Banknote,
  CircleCheck,
  HandCoins,
  Plus,
  Search,
  TriangleAlert,
  Undo2,
  Wallet,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Tables } from '../lib/database.types'
import {
  formatBRL,
  formatDateBR,
  getReceivableStatusMeta,
  isOverdue,
} from '../lib/commercial'
import { formatRelativeTime } from '../lib/format'
import ReceivableFormModal from '../components/finance/ReceivableFormModal'
import MarkPaidModal from '../components/finance/MarkPaidModal'

type ReceivableRow = Tables<'receivables'> & {
  clients: Pick<Tables<'clients'>, 'id' | 'nome' | 'empresa'> | null
  projects: Pick<Tables<'projects'>, 'id' | 'nome'> | null
}

const SKELETON_ROWS = 4
const SKELETON_CARDS = 4
const ROW_STAGGER_S = 0.04
const MAX_STAGGER_ROWS = 10

const FILTERS = [
  { key: 'todos', label: 'Todos' },
  { key: 'pendentes', label: 'Pendentes' },
  { key: 'atrasados', label: 'Atrasados' },
  { key: 'pagos', label: 'Pagos' },
] as const

type FilterKey = (typeof FILTERS)[number]['key']

function matchesFilter(row: ReceivableRow, filter: FilterKey): boolean {
  switch (filter) {
    case 'todos':
      return true
    case 'pendentes':
      return (
        row.status === 'pendente' && !isOverdue(row.status, row.vencimento)
      )
    case 'atrasados':
      return isOverdue(row.status, row.vencimento)
    case 'pagos':
      return row.status === 'pago'
  }
}

interface FinanceSummary {
  aReceber: number
  atrasado: number
  recebidoNoMes: number
  recebidoTotal: number
}

/** 'YYYY-MM' do mês corrente no fuso local. */
function currentMonthKey(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function computeSummary(rows: readonly ReceivableRow[]): FinanceSummary {
  const monthKey = currentMonthKey()
  let aReceber = 0
  let atrasado = 0
  let recebidoNoMes = 0
  let recebidoTotal = 0
  for (const row of rows) {
    if (row.status === 'pendente') {
      if (isOverdue(row.status, row.vencimento)) atrasado += row.valor
      else aReceber += row.valor
    }
    if (row.status === 'pago') {
      recebidoTotal += row.valor
      if (row.pago_em && row.pago_em.slice(0, 7) === monthKey) {
        recebidoNoMes += row.valor
      }
    }
  }
  return { aReceber, atrasado, recebidoNoMes, recebidoTotal }
}

interface SummaryCard {
  label: string
  value: number
  icon: ReactNode
  valueClass: string
}

function buildSummaryCards(summary: FinanceSummary): SummaryCard[] {
  return [
    {
      label: 'A receber',
      value: summary.aReceber,
      icon: <Wallet aria-hidden className="h-4 w-4 text-accent/80" />,
      valueClass: 'text-ink',
    },
    {
      label: 'Atrasado',
      value: summary.atrasado,
      icon: <TriangleAlert aria-hidden className="h-4 w-4 text-red-400/70" />,
      valueClass: summary.atrasado > 0 ? 'text-red-300' : 'text-ink',
    },
    {
      label: 'Recebido no mês',
      value: summary.recebidoNoMes,
      icon: <CircleCheck aria-hidden className="h-4 w-4 text-emerald-400/70" />,
      valueClass: 'text-emerald-300',
    },
    {
      label: 'Recebido total',
      value: summary.recebidoTotal,
      icon: <Banknote aria-hidden className="h-4 w-4 text-muted/60" />,
      valueClass: 'text-ink',
    },
  ]
}

export default function Financeiro() {
  const [filter, setFilter] = useState<FilterKey>('todos')
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [receivableToAct, setReceivableToAct] =
    useState<ReceivableRow | null>(null)

  const { data: receivables, isLoading, isError } = useQuery({
    queryKey: ['receivables'],
    queryFn: async (): Promise<ReceivableRow[]> => {
      const { data, error } = await supabase
        .from('receivables')
        .select('*, clients(id, nome, empresa), projects(id, nome)')
        .order('vencimento', { ascending: true })
      if (error) throw new Error(error.message)
      return data
    },
  })

  const summary = useMemo(
    () => computeSummary(receivables ?? []),
    [receivables]
  )

  const counts = useMemo(() => {
    const base: Record<FilterKey, number> = {
      todos: 0,
      pendentes: 0,
      atrasados: 0,
      pagos: 0,
    }
    for (const row of receivables ?? []) {
      for (const { key } of FILTERS) {
        if (matchesFilter(row, key)) base[key] += 1
      }
    }
    return base
  }, [receivables])

  const filtered = useMemo(() => {
    if (!receivables) return []
    const term = search.trim().toLowerCase()
    return receivables.filter((row) => {
      if (!matchesFilter(row, filter)) return false
      if (term === '') return true
      return [
        row.descricao,
        row.clients?.nome ?? '',
        row.clients?.empresa ?? '',
        row.projects?.nome ?? '',
      ]
        .join(' ')
        .toLowerCase()
        .includes(term)
    })
  }, [receivables, filter, search])

  const hasReceivables = (receivables?.length ?? 0) > 0
  const summaryCards = buildSummaryCards(summary)

  return (
    <div>
      {/* Header da página */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="hero-heading font-kanit text-4xl font-bold leading-tight sm:text-5xl">
            Financeiro
          </h1>
          <p className="mt-2 text-sm font-light text-muted">
            Recebíveis, pagamentos e fluxo de caixa da Vertix.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setFormOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-[0_8px_24px_-8px_rgba(108,91,242,0.6)] transition-all duration-200 hover:bg-accent-2 hover:shadow-[0_10px_28px_-8px_rgba(85,70,224,0.7)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <Plus className="h-4 w-4" />
          Nova cobrança
        </button>
      </div>

      {/* Cards de resumo */}
      {isLoading && (
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: SKELETON_CARDS }, (_, i) => (
            <div
              key={i}
              className="rounded-2xl border border-white/5 bg-surface-1 p-5"
            >
              <div className="h-3 w-24 animate-pulse rounded bg-surface-2" />
              <div className="mt-4 h-7 w-32 animate-pulse rounded bg-surface-2" />
            </div>
          ))}
        </div>
      )}

      {!isLoading && !isError && hasReceivables && (
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((card, index) => (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: index * 0.05 }}
              className="rounded-2xl border border-white/5 bg-surface-1 p-5"
            >
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-medium uppercase tracking-widest text-muted/70">
                  {card.label}
                </p>
                {card.icon}
              </div>
              <p
                className={`mt-3 font-kanit text-2xl font-semibold leading-none ${card.valueClass}`}
              >
                {formatBRL(card.value)}
              </p>
            </motion.div>
          ))}
        </div>
      )}

      {/* Filtros + busca */}
      {hasReceivables && (
        <div className="mt-8 flex flex-wrap items-center gap-2">
          {FILTERS.map((item) => {
            const isActive = filter === item.key
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setFilter(item.key)}
                aria-pressed={isActive}
                className={
                  isActive
                    ? 'inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/15 px-3.5 py-1.5 text-xs font-semibold text-accent transition-colors duration-150'
                    : 'inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3.5 py-1.5 text-xs font-medium text-muted transition-colors duration-150 hover:bg-white/5 hover:text-ink'
                }
              >
                {item.label}
                <span
                  className={
                    isActive ? 'text-accent/70' : 'text-muted/50'
                  }
                >
                  {counts[item.key]}
                </span>
              </button>
            )
          })}
          <div className="relative ml-auto w-full sm:w-64">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted/60" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar cliente, projeto, descrição…"
              aria-label="Buscar cobranças"
              className="w-full rounded-lg border border-white/5 bg-surface-2 py-2.5 pl-10 pr-4 text-sm text-ink placeholder:text-muted/50 outline-none transition-colors duration-200 focus:border-accent/60 focus:ring-2 focus:ring-accent/25"
            />
          </div>
        </div>
      )}

      {/* Conteúdo */}
      <div className="mt-6 overflow-hidden rounded-2xl border border-white/5 bg-surface-1">
        {isLoading && (
          <div
            className="divide-y divide-white/5"
            aria-label="Carregando cobranças"
          >
            {Array.from({ length: SKELETON_ROWS }, (_, i) => (
              <div key={i} className="flex items-center gap-6 px-6 py-5">
                <div className="h-4 w-44 animate-pulse rounded bg-surface-2" />
                <div className="h-4 w-32 animate-pulse rounded bg-surface-2" />
                <div className="ml-auto h-4 w-24 animate-pulse rounded bg-surface-2" />
              </div>
            ))}
          </div>
        )}

        {isError && (
          <p className="px-6 py-10 text-center text-sm text-red-400">
            Não foi possível carregar o financeiro. Recarregue a página.
          </p>
        )}

        {!isLoading && !isError && !hasReceivables && (
          <div className="flex flex-col items-center px-6 py-16 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full border border-accent/20 bg-accent/10">
              <Wallet className="h-6 w-6 text-accent" />
            </span>
            <h2 className="mt-5 text-lg font-semibold text-ink">
              Nenhuma cobrança ainda
            </h2>
            <p className="mt-2 max-w-xs text-sm font-light leading-relaxed text-muted">
              Crie a primeira cobrança para acompanhar entradas, vencimentos e
              pagamentos dos projetos.
            </p>
            <button
              type="button"
              onClick={() => setFormOpen(true)}
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-accent-2"
            >
              <Plus className="h-4 w-4" />
              Criar primeira cobrança
            </button>
          </div>
        )}

        {!isLoading && !isError && hasReceivables && (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/5 text-[11px] uppercase tracking-widest text-muted/70">
                <th className="px-6 py-4 font-medium">Descrição</th>
                <th className="hidden px-4 py-4 font-medium md:table-cell">
                  Cliente
                </th>
                <th className="px-4 py-4 font-medium">Valor</th>
                <th className="hidden px-4 py-4 font-medium sm:table-cell">
                  Vencimento
                </th>
                <th className="px-4 py-4 font-medium">Status</th>
                <th className="hidden px-4 py-4 font-medium lg:table-cell">
                  Forma pgto
                </th>
                <th className="px-4 py-4 text-right font-medium">
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-10 text-center text-sm font-light text-muted"
                  >
                    Nenhuma cobrança encontrada para os filtros atuais.
                  </td>
                </tr>
              )}
              {filtered.map((row, index) => {
                const meta = getReceivableStatusMeta(row.status, row.vencimento)
                return (
                  <motion.tr
                    key={row.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.25,
                      delay: Math.min(index, MAX_STAGGER_ROWS) * ROW_STAGGER_S,
                    }}
                    className="group border-b border-white/5 transition-colors duration-150 last:border-b-0 hover:bg-white/[0.03]"
                  >
                    <td className="px-6 py-4">
                      <p className="font-medium text-ink">{row.descricao}</p>
                      <p className="mt-0.5 text-xs font-light text-muted">
                        {row.projects?.nome ?? '—'}
                      </p>
                    </td>
                    <td className="hidden px-4 py-4 md:table-cell">
                      <p className="text-ink/90">
                        {row.clients?.nome ?? '—'}
                      </p>
                      {row.clients?.empresa && (
                        <p className="mt-0.5 text-xs font-light text-muted">
                          {row.clients.empresa}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-4 font-medium text-ink">
                      {formatBRL(row.valor)}
                    </td>
                    <td className="hidden px-4 py-4 sm:table-cell">
                      <p className="text-ink/90">
                        {formatDateBR(row.vencimento)}
                      </p>
                      <p className="mt-0.5 text-xs font-light text-muted">
                        {formatRelativeTime(row.vencimento)}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${meta.badgeClass}`}
                      >
                        <span
                          aria-hidden
                          className={`h-1.5 w-1.5 rounded-full ${meta.dotClass}`}
                        />
                        {meta.label}
                      </span>
                    </td>
                    <td className="hidden px-4 py-4 lg:table-cell">
                      {row.forma_pagamento ? (
                        <span className="text-ink/90">
                          {row.forma_pagamento}
                        </span>
                      ) : (
                        <span className="text-muted/50">—</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-right">
                      {row.status === 'pendente' && (
                        <button
                          type="button"
                          onClick={() => setReceivableToAct(row)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/25 bg-emerald-400/10 px-3 py-1.5 text-xs font-medium text-emerald-300 transition-colors duration-150 hover:bg-emerald-400/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
                        >
                          <HandCoins className="h-3.5 w-3.5" />
                          Marcar pago
                        </button>
                      )}
                      {row.status === 'pago' && (
                        <button
                          type="button"
                          onClick={() => setReceivableToAct(row)}
                          aria-label={`Desfazer pagamento de ${row.descricao}`}
                          title="Desfazer pagamento"
                          className="rounded-lg p-2 text-muted/50 opacity-0 transition-all duration-150 hover:bg-white/5 hover:text-ink focus-visible:opacity-100 group-hover:opacity-100"
                        >
                          <Undo2 className="h-4 w-4" />
                        </button>
                      )}
                      {row.status === 'cancelado' && (
                        <span className="text-muted/40">—</span>
                      )}
                    </td>
                  </motion.tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <ReceivableFormModal open={formOpen} onClose={() => setFormOpen(false)} />

      <MarkPaidModal
        open={receivableToAct !== null}
        receivable={receivableToAct}
        onClose={() => setReceivableToAct(null)}
      />
    </div>
  )
}
