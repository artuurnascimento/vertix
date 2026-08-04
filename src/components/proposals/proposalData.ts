import { z } from 'zod'
import type { Json, Tables } from '../../lib/database.types'
import type { ProposalInstallment, ProposalItem } from '../../lib/commercial'

/**
 * Tipos e parsing dos dados de proposta (jsonb de itens/parcelas e payloads
 * das RPCs públicas). Validação na fronteira: nunca confiar no shape do jsonb.
 * Mesmo padrão de src/lib/briefing.ts.
 */

export type Proposal = Tables<'proposals'>

export type ProposalWithProject = Proposal & {
  projects:
    | (Pick<Tables<'projects'>, 'id' | 'nome' | 'tipo_servico'> & {
        clients: Pick<Tables<'clients'>, 'id' | 'nome' | 'empresa'> | null
      })
    | null
}

const itemJsonSchema = z.object({
  descricao: z.string(),
  quantidade: z.number(),
  valor_unitario: z.number(),
})

const installmentJsonSchema = z.object({
  descricao: z.string(),
  valor: z.number(),
  vencimento: z.string(),
})

/** Converte o jsonb de itens em lista tipada (shape inválido = lista vazia). */
export function parseProposalItems(
  json: Json | null | undefined
): ProposalItem[] {
  const parsed = z.array(itemJsonSchema).safeParse(json)
  return parsed.success ? parsed.data : []
}

/** Converte o jsonb de parcelas em lista tipada (null/inválido = vazia). */
export function parseProposalInstallments(
  json: Json | null | undefined
): ProposalInstallment[] {
  const parsed = z.array(installmentJsonSchema).safeParse(json)
  return parsed.success ? parsed.data : []
}

/** Soma das parcelas — usada no aviso de divergência com o total. */
export function sumInstallments(
  parcelas: readonly ProposalInstallment[]
): number {
  return parcelas.reduce((sum, parcela) => sum + parcela.valor, 0)
}

// ---------------------------------------------------------------------------
// Link público
// ---------------------------------------------------------------------------

export function proposalUrl(token: string): string {
  // /p é o alias curto de /proposta — link mais limpo para enviar ao cliente.
  return `${window.location.origin}/p/${token}`
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// Payloads das RPCs públicas (get_proposal_by_token / respond_proposal)
// ---------------------------------------------------------------------------

const proposalByTokenSchema = z.object({
  proposta: z.object({
    id: z.string(),
    titulo: z.string(),
    itens: z.array(itemJsonSchema).catch([]),
    desconto: z.number(),
    valor_total: z.number(),
    condicoes: z.string().nullable(),
    parcelas: z.array(installmentJsonSchema).nullable().catch(null),
    validade: z.string().nullable(),
    status: z.string(),
    accepted_at: z.string().nullable(),
    aceite_nome: z.string().nullable(),
    sent_at: z.string().nullable(),
    /** Deck jsonb (apresentação slide-deck) — parseado por deck/deckData.ts. */
    apresentacao: z.unknown().nullable().catch(null),
    /** Primeiro receivable da proposta — checkout da entrada após o aceite. */
    entrada: z
      .object({
        id: z.string(),
        valor: z.number(),
        vencimento: z.string(),
        status: z.string(),
        payment_link: z.string().nullable(),
        /** Token da página /pagar — checkout imediato sem "Gerar link". */
        payment_token: z.string().nullable().catch(null),
      })
      .nullable()
      .catch(null),
  }),
  projeto_nome: z.string(),
  cliente: z.object({
    nome: z.string(),
    empresa: z.string().nullable(),
  }),
})

export type ProposalByToken = z.infer<typeof proposalByTokenSchema>

/** Payload de get_proposal_by_token — null = token inexistente ou rascunho. */
export function parseProposalByToken(json: Json | null): ProposalByToken | null {
  if (json == null) return null
  const parsed = proposalByTokenSchema.safeParse(json)
  return parsed.success ? parsed.data : null
}

const respondResultSchema = z.object({
  success: z.boolean(),
  error: z.string().optional(),
})

export type RespondProposalResult = z.infer<typeof respondResultSchema>

/** Payload de respond_proposal — shape inesperado vira falha genérica. */
export function parseRespondResult(json: Json | null): RespondProposalResult {
  const parsed = respondResultSchema.safeParse(json)
  return parsed.success ? parsed.data : { success: false }
}
