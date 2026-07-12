import { z } from 'zod'
import type { Json } from '../../lib/database.types'

/**
 * Tipagem e parsing do payload da RPC pública get_portal_by_token.
 * Mesmo padrão de src/lib/briefing.ts — validação na fronteira, nunca
 * confiar no shape do jsonb retornado pelo banco.
 */

const portalProjetoSchema = z.object({
  nome: z.string(),
  tipo_servico: z.string(),
  status: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
})

const portalClienteSchema = z.object({
  nome: z.string(),
  empresa: z.string().nullish(),
})

const portalBriefingSchema = z.object({
  status: z.string(),
  /** Presente apenas enquanto o briefing ainda não foi preenchido. */
  token: z.string().nullish(),
})

const portalPropostaSchema = z.object({
  titulo: z.string(),
  valor_total: z.number(),
  status: z.string(),
  token: z.string(),
  sent_at: z.string().nullish(),
})

const portalAtividadeSchema = z.object({
  descricao: z.string(),
  tipo: z.string(),
  created_at: z.string(),
})

const portalDataSchema = z.object({
  projeto: portalProjetoSchema,
  cliente: portalClienteSchema,
  briefing: portalBriefingSchema.nullish(),
  propostas: z
    .array(portalPropostaSchema)
    .nullish()
    .transform((value) => value ?? []),
  atividades: z
    .array(portalAtividadeSchema)
    .nullish()
    .transform((value) => value ?? []),
})

export type PortalData = z.infer<typeof portalDataSchema>
export type PortalProposta = PortalData['propostas'][number]
export type PortalAtividade = PortalData['atividades'][number]

/** Payload de get_portal_by_token — null = token inexistente ou shape inválido. */
export function parsePortalByToken(json: Json | null): PortalData | null {
  if (json == null) return null
  const parsed = portalDataSchema.safeParse(json)
  return parsed.success ? parsed.data : null
}
