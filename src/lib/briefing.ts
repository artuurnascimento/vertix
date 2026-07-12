import { z } from 'zod'
import type { Json } from './database.types'

/**
 * Tipagem e parsing dos JSONs de briefing (perguntas do template e payloads
 * das RPCs públicas). Validação na fronteira: nunca confiar no shape do jsonb.
 */

export const BRIEFING_FIELD_TIPOS = [
  'texto',
  'textarea',
  'select',
  'numero',
] as const

export type BriefingFieldTipo = (typeof BRIEFING_FIELD_TIPOS)[number]

const perguntaSchema = z.object({
  id: z.string(),
  label: z.string(),
  tipo: z.enum(BRIEFING_FIELD_TIPOS),
  obrigatoria: z.boolean().optional().default(false),
  opcoes: z.array(z.string()).optional(),
})

export type BriefingPergunta = z.infer<typeof perguntaSchema>

const perguntasSchema = z.array(perguntaSchema)

/** Converte o jsonb de perguntas do template em lista tipada (ordem preservada). */
export function parsePerguntas(json: Json | null | undefined): BriefingPergunta[] {
  const parsed = perguntasSchema.safeParse(json)
  return parsed.success ? parsed.data : []
}

const briefingByTokenSchema = z.object({
  briefing: z.object({
    id: z.string(),
    status: z.string(),
    respostas: z.record(z.string(), z.unknown()).nullable(),
  }),
  perguntas: perguntasSchema,
  tipo_servico: z.string(),
  projeto_nome: z.string(),
})

export type BriefingByToken = z.infer<typeof briefingByTokenSchema>

/** Payload de get_briefing_by_token — null = token inexistente. */
export function parseBriefingByToken(json: Json | null): BriefingByToken | null {
  if (json == null) return null
  const parsed = briefingByTokenSchema.safeParse(json)
  return parsed.success ? parsed.data : null
}

const submitResultSchema = z.object({
  success: z.boolean(),
  error: z.string().optional(),
})

export type SubmitBriefingResult = z.infer<typeof submitResultSchema>

/** Payload de submit_briefing — shape inesperado vira falha genérica. */
export function parseSubmitResult(json: Json | null): SubmitBriefingResult {
  const parsed = submitResultSchema.safeParse(json)
  return parsed.success ? parsed.data : { success: false }
}

/** Normaliza uma resposta do jsonb para exibição (null = sem resposta). */
export function formatResposta(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed === '' ? null : trimmed
  }
  if (typeof value === 'number') return String(value)
  return null
}
