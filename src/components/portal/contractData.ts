import { z } from 'zod'
import type { Json } from '../../lib/database.types'

/**
 * Tipagem e parsing do payload da RPC pública get_contract_by_token.
 * Mesmo padrão de portalData.ts / src/lib/briefing.ts — validação na
 * fronteira, nunca confiar no shape do jsonb retornado pelo banco.
 */

const contractClienteSchema = z.object({
  nome: z.string(),
  empresa: z.string().nullish(),
})

const contractDataSchema = z.object({
  corpo_final: z.string(),
  status: z.enum(['enviado', 'assinado']),
  signer_name: z.string().nullish(),
  signed_at: z.string().nullish(),
  projeto_nome: z.string(),
  cliente: contractClienteSchema,
})

export type ContractData = z.infer<typeof contractDataSchema>

/** Payload de get_contract_by_token — null = token inexistente ou shape inválido. */
export function parseContractByToken(json: Json | null): ContractData | null {
  if (json == null) return null
  const parsed = contractDataSchema.safeParse(json)
  return parsed.success ? parsed.data : null
}

// ---------------------------------------------------------------------------
// Resultado de sign_contract
// ---------------------------------------------------------------------------

const signContractResultSchema = z.object({
  ok: z.boolean(),
})

export interface SignContractResult {
  success: boolean
}

/** Payload de sign_contract — shape inesperado é tratado como falha. */
export function parseSignContractResult(json: Json | null): SignContractResult {
  const parsed = signContractResultSchema.safeParse(json)
  return { success: parsed.success && parsed.data.ok }
}

// ---------------------------------------------------------------------------
// Formatação de data/hora local — signed_at é timestamptz (não data pura),
// por isso não reaproveitamos formatDateBR (que usa timeZone: 'UTC' para
// vencimentos). Aqui queremos o horário local do assinante.
// ---------------------------------------------------------------------------

const dateTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

/** ISO timestamptz → "13/07/2026 14:32" (horário local do navegador). */
export function formatDateTimeBR(isoDate: string): string {
  return dateTimeFormatter.format(new Date(isoDate))
}
