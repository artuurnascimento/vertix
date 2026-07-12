import { z } from 'zod'
import type { ProposalInstallment, ProposalItem } from '../../lib/commercial'

/**
 * Validação local do formulário de proposta (criar/editar rascunho).
 * Os inputs numéricos ficam como string no estado do form (drafts) e são
 * convertidos aqui antes do safeParse.
 */

const itemSchema = z.object({
  descricao: z.string().trim().min(1, 'Descreva o item.'),
  quantidade: z.number().gt(0, 'Quantidade deve ser maior que zero.'),
  valor_unitario: z.number().gt(0, 'Valor unitário deve ser maior que zero.'),
})

const installmentSchema = z.object({
  descricao: z.string().trim().min(1, 'Descreva a parcela.'),
  valor: z.number().gt(0, 'Valor da parcela deve ser maior que zero.'),
  vencimento: z.string().min(1, 'Informe o vencimento.'),
})

export const proposalSchema = z.object({
  project_id: z.uuid('Selecione o projeto.'),
  titulo: z.string().trim().min(1, 'Informe o título da proposta.'),
  itens: z.array(itemSchema).min(1, 'Adicione ao menos um item.'),
  desconto: z.number().min(0, 'Desconto não pode ser negativo.'),
  condicoes: z.string().trim(),
  /** 'YYYY-MM-DD' ou '' (sem validade). */
  validade: z.string(),
  parcelas: z.array(installmentSchema),
})

export type ProposalFormValues = z.infer<typeof proposalSchema>

// ---------------------------------------------------------------------------
// Drafts — linhas dos editores dinâmicos com valores como string
// ---------------------------------------------------------------------------

export interface ItemDraft {
  descricao: string
  quantidade: string
  valor_unitario: string
}

export interface ParcelaDraft {
  descricao: string
  valor: string
  vencimento: string
}

export const EMPTY_ITEM_DRAFT: ItemDraft = {
  descricao: '',
  quantidade: '1',
  valor_unitario: '',
}

export const EMPTY_PARCELA_DRAFT: ParcelaDraft = {
  descricao: '',
  valor: '',
  vencimento: '',
}

/** "12,5" | "12.5" | "" → número ('' e inválido viram 0 para falhar no gt). */
export function toNumber(input: string): number {
  const trimmed = input.trim()
  if (trimmed === '') return 0
  const parsed = Number(trimmed.replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : 0
}

export function itemFromDraft(draft: ItemDraft): ProposalItem {
  return {
    descricao: draft.descricao.trim(),
    quantidade: toNumber(draft.quantidade),
    valor_unitario: toNumber(draft.valor_unitario),
  }
}

export function installmentFromDraft(draft: ParcelaDraft): ProposalInstallment {
  return {
    descricao: draft.descricao.trim(),
    valor: toNumber(draft.valor),
    vencimento: draft.vencimento,
  }
}

export function draftFromItem(item: ProposalItem): ItemDraft {
  return {
    descricao: item.descricao,
    quantidade: String(item.quantidade),
    valor_unitario: String(item.valor_unitario),
  }
}

export function draftFromInstallment(parcela: ProposalInstallment): ParcelaDraft {
  return {
    descricao: parcela.descricao,
    valor: String(parcela.valor),
    vencimento: parcela.vencimento,
  }
}
