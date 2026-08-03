/**
 * fetch-campaign-breakdown
 *
 * Snapshot AO VIVO (nada persistido) dos níveis finos de uma campanha:
 *   POST { campaign_id, level: 'adset' | 'ad' }
 * Auth: JWT de membro do time (mesmo mecanismo do sync-ad-metrics).
 * level=adset → insights agregados do mês por conjunto de anúncios.
 * level=ad    → insights agregados do mês por anúncio + thumbnail do
 *               criativo (segunda chamada em lote à Graph API).
 * Resposta: { itens: [{ id, nome, gasto, impressoes, cliques, conversoes,
 *             receita, thumbnail_url? }] }
 * Sem META_ADS_TOKEN → 400 "META_ADS_TOKEN não configurado".
 * NUNCA loga tokens.
 */

import { withCors } from '../_shared/cors.ts'

interface RequestBody {
  campaign_id?: string
  level?: 'adset' | 'ad'
}

interface InsightAction {
  action_type?: string
  value?: string
}

interface BreakdownRow {
  adset_id?: string
  adset_name?: string
  ad_id?: string
  ad_name?: string
  spend?: string
  impressions?: string
  clicks?: string
  actions?: InsightAction[]
  action_values?: InsightAction[]
}

interface ItemNormalizado {
  id: string
  nome: string
  gasto: number
  impressoes: number
  cliques: number
  conversoes: number
  receita: number
  thumbnail_url?: string
}

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function pickActionValue(
  actions: InsightAction[] | undefined,
  actionType: string
): number {
  const match = actions?.find((a) => a.action_type === actionType)
  if (!match?.value) return 0
  const parsed = Number(match.value)
  return Number.isFinite(parsed) ? parsed : 0
}

function parseConversoes(actions: InsightAction[] | undefined): number {
  const purchase = pickActionValue(actions, 'purchase')
  if (purchase > 0) return Math.round(purchase)
  const lead = pickActionValue(actions, 'lead')
  if (lead > 0) return Math.round(lead)
  return 0
}

Deno.serve(withCors(async (req) => {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'method_not_allowed' }, 405)
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return jsonResponse({ error: 'Não autenticado.' }, 401)
  }
  const jwt = authHeader.slice('Bearer '.length)

  let body: RequestBody
  try {
    body = await req.json()
  } catch {
    body = {}
  }
  if (!body.campaign_id || (body.level !== 'adset' && body.level !== 'ad')) {
    return jsonResponse(
      { error: 'campaign_id e level (adset|ad) são obrigatórios.' },
      400
    )
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('[fetch-campaign-breakdown] Env do Supabase ausente.')
    return jsonResponse({ error: 'env_supabase_ausente' }, 500)
  }

  // Autentica e valida membro do time.
  const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: serviceRoleKey, Authorization: `Bearer ${jwt}` },
  })
  if (!userRes.ok) return jsonResponse({ error: 'Não autenticado.' }, 401)
  const user = (await userRes.json()) as { id?: string }
  if (!user.id) return jsonResponse({ error: 'Não autenticado.' }, 401)

  const profileRes = await fetch(
    `${supabaseUrl}/rest/v1/profiles?id=eq.${user.id}&select=id`,
    {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    }
  )
  const profiles = profileRes.ok
    ? ((await profileRes.json()) as Array<{ id: string }>)
    : []
  if (profiles.length === 0) {
    return jsonResponse({ error: 'Acesso negado.' }, 403)
  }

  const metaAdsToken = Deno.env.get('META_ADS_TOKEN')
  if (!metaAdsToken) {
    return jsonResponse({ error: 'META_ADS_TOKEN não configurado' }, 400)
  }

  // Resolve a campanha local → meta_campaign_id.
  const campRes = await fetch(
    `${supabaseUrl}/rest/v1/ad_campaigns?id=eq.${body.campaign_id}&select=meta_campaign_id`,
    {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    }
  )
  const camps = campRes.ok
    ? ((await campRes.json()) as Array<{ meta_campaign_id: string }>)
    : []
  if (camps.length === 0) {
    return jsonResponse({ error: 'Campanha não encontrada.' }, 404)
  }
  const metaCampaignId = camps[0].meta_campaign_id

  const idField = body.level === 'adset' ? 'adset_id' : 'ad_id'
  const nameField = body.level === 'adset' ? 'adset_name' : 'ad_name'

  const insightsRes = await fetch(
    `https://graph.facebook.com/v21.0/${metaCampaignId}/insights` +
      `?level=${body.level}&date_preset=this_month` +
      `&fields=${idField},${nameField},spend,impressions,clicks,actions,action_values` +
      `&limit=200&access_token=${metaAdsToken}`
  )
  const insightsBody = (await insightsRes.json()) as {
    data?: BreakdownRow[]
    error?: { message?: string }
  }
  if (!insightsRes.ok || insightsBody.error) {
    return jsonResponse(
      {
        error: insightsBody.error?.message
          ? `Falha ao consultar a Meta: ${insightsBody.error.message}`
          : 'Falha ao consultar a Meta Graph API.',
      },
      502
    )
  }

  const itens: ItemNormalizado[] = (insightsBody.data ?? []).map((row) => {
    const id = (body.level === 'adset' ? row.adset_id : row.ad_id) ?? ''
    const nome =
      (body.level === 'adset' ? row.adset_name : row.ad_name) ?? id
    const gasto = row.spend ? Number(row.spend) : 0
    const impressoes = row.impressions ? Number(row.impressions) : 0
    const cliques = row.clicks ? Number(row.clicks) : 0
    return {
      id,
      nome,
      gasto: Number.isFinite(gasto) ? gasto : 0,
      impressoes: Number.isFinite(impressoes) ? impressoes : 0,
      cliques: Number.isFinite(cliques) ? cliques : 0,
      conversoes: parseConversoes(row.actions),
      receita: pickActionValue(row.action_values, 'purchase'),
    }
  })

  // Miniaturas dos criativos (só nível de anúncio) — 1 chamada em lote.
  if (body.level === 'ad' && itens.length > 0) {
    const ids = itens
      .map((i) => i.id)
      .filter(Boolean)
      .slice(0, 50)
      .join(',')
    try {
      const creativesRes = await fetch(
        `https://graph.facebook.com/v21.0/?ids=${ids}` +
          `&fields=creative{thumbnail_url}&access_token=${metaAdsToken}`
      )
      if (creativesRes.ok) {
        const creativesBody = (await creativesRes.json()) as Record<
          string,
          { creative?: { thumbnail_url?: string } }
        >
        for (const item of itens) {
          const thumb = creativesBody[item.id]?.creative?.thumbnail_url
          if (thumb) item.thumbnail_url = thumb
        }
      }
    } catch {
      // Miniatura é enfeite — falha silenciosa, números continuam valendo.
    }
  }

  return jsonResponse({ itens })
}))
