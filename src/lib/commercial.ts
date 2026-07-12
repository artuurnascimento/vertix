/**
 * Utilitários e metadados do domínio comercial (propostas / financeiro).
 * Mesmo padrão de src/lib/format.ts — compartilhado por Propostas, Financeiro,
 * Dashboard e Portal do Cliente.
 */

import type { StatusMeta } from './format'

const brlFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

/** 1234.5 → "R$ 1.234,50" */
export function formatBRL(value: number): string {
  return brlFormatter.format(value)
}

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'UTC',
})

/** "2026-08-15" | ISO → "15/08/2026" (UTC para datas puras de vencimento). */
export function formatDateBR(isoDate: string): string {
  return dateFormatter.format(new Date(isoDate))
}

// ---------------------------------------------------------------------------
// Itens e parcelas de proposta (shape do jsonb em proposals)
// ---------------------------------------------------------------------------

export interface ProposalItem {
  descricao: string
  quantidade: number
  valor_unitario: number
}

export interface ProposalInstallment {
  descricao: string
  valor: number
  /** 'YYYY-MM-DD' */
  vencimento: string
}

/** Soma dos itens menos desconto — nunca negativo. */
export function calcProposalTotal(
  itens: readonly ProposalItem[],
  desconto: number
): number {
  const subtotal = itens.reduce(
    (sum, item) => sum + item.quantidade * item.valor_unitario,
    0
  )
  return Math.max(subtotal - desconto, 0)
}

// ---------------------------------------------------------------------------
// Status de proposta
// ---------------------------------------------------------------------------

export const PROPOSAL_STATUS_ORDER = [
  'rascunho',
  'enviada',
  'aceita',
  'recusada',
] as const

export type ProposalStatus = (typeof PROPOSAL_STATUS_ORDER)[number]

export const PROPOSAL_STATUS: Record<ProposalStatus, StatusMeta> = {
  rascunho: {
    label: 'Rascunho',
    badgeClass: 'border-white/10 bg-white/5 text-muted',
    dotClass: 'bg-muted',
  },
  enviada: {
    label: 'Enviada',
    badgeClass: 'border-sky-400/20 bg-sky-400/10 text-sky-300',
    dotClass: 'bg-sky-400',
  },
  aceita: {
    label: 'Aceita',
    badgeClass: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300',
    dotClass: 'bg-emerald-400',
  },
  recusada: {
    label: 'Recusada',
    badgeClass: 'border-red-400/25 bg-red-400/10 text-red-300',
    dotClass: 'bg-red-400',
  },
}

const UNKNOWN_META: StatusMeta = {
  label: 'Desconhecido',
  badgeClass: 'border-white/10 bg-white/5 text-muted',
  dotClass: 'bg-muted',
}

export function getProposalStatusMeta(status: string): StatusMeta {
  return PROPOSAL_STATUS[status as ProposalStatus] ?? UNKNOWN_META
}

// ---------------------------------------------------------------------------
// Status de recebível ('atrasado' é derivado, não existe no banco)
// ---------------------------------------------------------------------------

export type ReceivableStatus = 'pendente' | 'pago' | 'cancelado'
export type ReceivableDisplayStatus = ReceivableStatus | 'atrasado'

export const RECEIVABLE_STATUS: Record<ReceivableDisplayStatus, StatusMeta> = {
  pendente: {
    label: 'Pendente',
    badgeClass: 'border-amber-400/20 bg-amber-400/10 text-amber-300',
    dotClass: 'bg-amber-400',
  },
  atrasado: {
    label: 'Atrasado',
    badgeClass: 'border-red-400/25 bg-red-400/10 text-red-300',
    dotClass: 'bg-red-400',
  },
  pago: {
    label: 'Pago',
    badgeClass: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300',
    dotClass: 'bg-emerald-400',
  },
  cancelado: {
    label: 'Cancelado',
    badgeClass: 'border-white/10 bg-white/5 text-muted',
    dotClass: 'bg-muted',
  },
}

/** Pendente com vencimento anterior a hoje (data pura, sem hora). */
export function isOverdue(
  status: string,
  vencimento: string,
  today = new Date()
): boolean {
  if (status !== 'pendente') return false
  const todayStr = today.toISOString().slice(0, 10)
  return vencimento < todayStr
}

export function getReceivableStatusMeta(
  status: string,
  vencimento: string,
  today = new Date()
): StatusMeta {
  if (isOverdue(status, vencimento, today)) return RECEIVABLE_STATUS.atrasado
  return (
    RECEIVABLE_STATUS[status as ReceivableDisplayStatus] ?? UNKNOWN_META
  )
}
