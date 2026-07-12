import { z } from 'zod'

/** Formas de pagamento aceitas nos modais do financeiro. */
export const FORMAS_PAGAMENTO = [
  'Pix',
  'Boleto',
  'Cartão',
  'Transferência',
  'Outro',
] as const

export type FormaPagamento = (typeof FORMAS_PAGAMENTO)[number]

const DATE_ISO_REGEX = /^\d{4}-\d{2}-\d{2}$/

/**
 * "4500", "4500.5", "4500,50" → 4500.5 (arredondado a 2 casas).
 * null = valor inválido. Aceita vírgula ou ponto como separador decimal.
 */
export function parseValor(raw: string): number | null {
  const normalized = raw.trim().replace(',', '.')
  if (normalized === '') return null
  const value = Number(normalized)
  if (!Number.isFinite(value)) return null
  return Math.round(value * 100) / 100
}

/** 'YYYY-MM-DD' de hoje no fuso local (default de input type="date"). */
export function todayLocalISO(now = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

export const receivableSchema = z.object({
  client_id: z.uuid('Selecione o cliente.'),
  project_id: z.uuid('Selecione o projeto.'),
  descricao: z.string().trim().min(1, 'Informe a descrição da cobrança.'),
  valor: z
    .string()
    .refine((raw) => parseValor(raw) !== null, 'Informe um valor válido.')
    .refine(
      (raw) => (parseValor(raw) ?? 0) > 0,
      'O valor deve ser maior que zero.'
    ),
  vencimento: z
    .string()
    .regex(DATE_ISO_REGEX, 'Informe a data de vencimento.'),
  forma_pagamento: z.union([z.enum(FORMAS_PAGAMENTO), z.literal('')]),
})

export type ReceivableFormValues = z.infer<typeof receivableSchema>

/** Converte o form validado no payload de insert (status sempre 'pendente'). */
export function receivableFormToPayload(values: ReceivableFormValues) {
  return {
    client_id: values.client_id,
    project_id: values.project_id,
    descricao: values.descricao,
    valor: parseValor(values.valor) ?? 0,
    vencimento: values.vencimento,
    forma_pagamento:
      values.forma_pagamento === '' ? null : values.forma_pagamento,
    status: 'pendente' as const,
  }
}

export const markPaidSchema = z.object({
  pago_em: z.string().regex(DATE_ISO_REGEX, 'Informe a data do pagamento.'),
  forma_pagamento: z.union([z.enum(FORMAS_PAGAMENTO), z.literal('')]),
})

export type MarkPaidValues = z.infer<typeof markPaidSchema>
