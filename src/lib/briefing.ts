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

// ---------------------------------------------------------------------------
// Editor de templates (admin) — validação e persistência do rascunho
// ---------------------------------------------------------------------------

/** Mínimo de opções preenchidas exigido em perguntas de seleção. */
export const OPCOES_MIN = 2

export interface PerguntasDraftValidation {
  success: boolean
  /** Erro geral do template (sem perguntas, ids duplicados, shape inválido). */
  rootError: string | null
  /** Erros por pergunta, keyed por pergunta.id. */
  fieldErrors: Record<string, string>
}

/**
 * Valida um rascunho de perguntas do editor de templates. Reusa o
 * perguntaSchema (mesma fonte do form público) para o shape e adiciona as
 * regras de edição: label preenchida, select com >= OPCOES_MIN opções
 * preenchidas, pelo menos 1 pergunta e ids únicos.
 */
export function validatePerguntasDraft(
  perguntas: BriefingPergunta[]
): PerguntasDraftValidation {
  const parsed = perguntasSchema.safeParse(perguntas)
  if (!parsed.success) {
    return {
      success: false,
      rootError: 'Estrutura de perguntas inválida.',
      fieldErrors: {},
    }
  }
  if (parsed.data.length === 0) {
    return {
      success: false,
      rootError: 'O template precisa ter pelo menos uma pergunta.',
      fieldErrors: {},
    }
  }

  const fieldErrors: Record<string, string> = {}
  const seen = new Set<string>()
  let rootError: string | null = null

  for (const pergunta of parsed.data) {
    if (seen.has(pergunta.id)) {
      rootError = 'Há perguntas com identificadores duplicados.'
    }
    seen.add(pergunta.id)

    if (pergunta.label.trim() === '') {
      fieldErrors[pergunta.id] = 'Escreva o texto da pergunta.'
      continue
    }
    if (pergunta.tipo === 'select') {
      const preenchidas = (pergunta.opcoes ?? []).filter(
        (opcao) => opcao.trim() !== ''
      )
      if (preenchidas.length < OPCOES_MIN) {
        fieldErrors[pergunta.id] =
          `Perguntas de seleção precisam de pelo menos ${OPCOES_MIN} opções preenchidas.`
      }
    }
  }

  const success = rootError === null && Object.keys(fieldErrors).length === 0
  return { success, rootError, fieldErrors }
}

/**
 * Normaliza o rascunho para persistir: trim nas labels, remove opções vazias
 * e descarta `opcoes` quando o tipo não é select. Nunca toca no id — as
 * respostas antigas são keyed por ele.
 */
export function normalizePerguntasForSave(
  perguntas: BriefingPergunta[]
): BriefingPergunta[] {
  return perguntas.map((pergunta) => {
    const base: BriefingPergunta = {
      id: pergunta.id,
      label: pergunta.label.trim(),
      tipo: pergunta.tipo,
      obrigatoria: pergunta.obrigatoria,
    }
    if (pergunta.tipo !== 'select') return base
    return {
      ...base,
      opcoes: (pergunta.opcoes ?? [])
        .map((opcao) => opcao.trim())
        .filter((opcao) => opcao !== ''),
    }
  })
}

/** Converte perguntas tipadas para o Json aceito pelo update no Supabase. */
export function perguntasToJson(perguntas: BriefingPergunta[]): Json {
  return perguntas as unknown as Json
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
