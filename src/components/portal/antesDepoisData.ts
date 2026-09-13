import { z } from 'zod'

/**
 * Payload de get_portal_antes_depois (migração fase6): a análise original do
 * Scan contra a medição mais recente, por regra. null = ainda não há um
 * "depois" (ou shape inválido — o portal só esconde o card).
 */

const medidaSchema = z.object({
  nota: z.number().nullable(),
  lcp_s: z.number().nullable(),
  medido_em: z.string(),
})

const antesDepoisSchema = z.object({
  dominio: z.string().nullable(),
  antes: medidaSchema,
  depois: medidaSchema,
  resolvidos: z.array(z.string()),
  novos: z.array(z.string()),
  abertos: z.number().int().nonnegative(),
})

export type AntesDepois = z.infer<typeof antesDepoisSchema>

export function parseAntesDepois(payload: unknown): AntesDepois | null {
  if (payload === null || payload === undefined) return null
  const parsed = antesDepoisSchema.safeParse(payload)
  return parsed.success ? parsed.data : null
}

/** "+0,8" / "−0,3" / "0,0" — variação da nota 0–10 com um décimo. */
export function variacao(antes: number | null, depois: number | null): string | null {
  if (antes === null || depois === null) return null
  const delta = Math.round((depois - antes) * 10) / 10
  const texto = Math.abs(delta).toFixed(1).replace('.', ',')
  if (delta > 0) return `+${texto}`
  if (delta < 0) return `−${texto}`
  return texto
}
