import { z } from 'zod'
import type { Json } from '../../lib/database.types'

/**
 * Tipagem e parsing do payload da RPC pública get_portal_ads.
 * Mesmo padrão de portalData.ts — validação na fronteira, nunca confiar no
 * shape do jsonb retornado pelo banco.
 */

const portalAdsMesAtualSchema = z.object({
  gasto: z.number(),
  impressoes: z.number(),
  cliques: z.number(),
  conversoes: z.number(),
  receita: z.number(),
})

const portalAdsSerieDiaSchema = z.object({
  data: z.string(),
  gasto: z.number(),
  conversoes: z.number(),
})

const portalAdsDataSchema = z.object({
  mes_atual: portalAdsMesAtualSchema,
  serie_30d: z
    .array(portalAdsSerieDiaSchema)
    .nullish()
    .transform((value) => value ?? []),
})

export type PortalAdsData = z.infer<typeof portalAdsDataSchema>
export type PortalAdsSerieDia = PortalAdsData['serie_30d'][number]

/** Payload de get_portal_ads — null = token inexistente, sem conta ativa ou shape inválido. */
export function parsePortalAds(json: Json | null): PortalAdsData | null {
  if (json == null) return null
  const parsed = portalAdsDataSchema.safeParse(json)
  return parsed.success ? parsed.data : null
}

/** ROAS = receita / gasto. null quando gasto é 0 (indefinido, não "zero retorno"). */
export function calcRoas(gasto: number, receita: number): number | null {
  if (gasto <= 0) return null
  return receita / gasto
}

/** 4.2 → "4,2" — uma casa decimal, padrão pt-BR, para o texto leigo de ROAS. */
export function formatRoas(roas: number): string {
  return roas.toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })
}
