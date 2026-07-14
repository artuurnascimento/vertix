/**
 * sync-ad-metrics
 *
 * Recebe { ad_account_id? } opcional, exige JWT de usuário autenticado (via
 * header Authorization) que seja membro do time (checado em public.profiles
 * com service role — mesmo mecanismo do create-payment-link), busca a(s)
 * conta(s) de anúncio ATIVA(s) — a única indicada, ou todas ativas quando o
 * body vem vazio — e sincroniza métricas diárias via Meta Graph API
 * (insights de spend/impressions/clicks/actions/action_values, last_7d).
 *
 * Para cada conta: upsert por (ad_account_id, data) via service role.
 *   conversoes = actions[type='purchase'].value, senão actions[type='lead'].value,
 *                senão 0.
 *   receita = action_values[type='purchase'].value, senão 0.
 * Sucesso por conta → last_sync_at=now(), last_sync_error=null.
 * Falha por conta → last_sync_error com mensagem amigável + notificação
 * (tipo 'trafego') via service role; NÃO derruba a sincronização das outras
 * contas (loop continua, resumo agrega sucesso/falha).
 *
 * Sem META_ADS_TOKEN configurado → 400 "META_ADS_TOKEN não configurado"
 * (mesmo padrão do MP_ACCESS_TOKEN em create-payment-link).
 * NUNCA loga o valor de META_ADS_TOKEN nem do JWT recebido.
 */

interface RequestBody {
  ad_account_id?: string
}

interface AdAccountRecord {
  id: string
  meta_account_id: string
  status: string
}

interface InsightAction {
  action_type?: string
  value?: string
}

interface InsightRow {
  date_start?: string
  spend?: string
  impressions?: string
  clicks?: string
  actions?: InsightAction[]
  action_values?: InsightAction[]
}

interface InsightsResponse {
  data?: InsightRow[]
  error?: { message?: string }
}

interface SyncSummary {
  sincronizadas: number
  falhas: number
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

function friendlyGraphError(message: string | undefined): string {
  if (!message) return 'Falha ao consultar a Meta Graph API.'
  return `Falha ao consultar a Meta Graph API: ${message}`
}

Deno.serve(async (req) => {
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

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('[sync-ad-metrics] Env do Supabase ausente.')
    return jsonResponse({ error: 'env_supabase_ausente' }, 500)
  }

  // Valida o JWT e resolve o usuário autenticado.
  const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${jwt}`,
    },
  })
  if (!userRes.ok) {
    return jsonResponse({ error: 'Não autenticado.' }, 401)
  }
  const user = (await userRes.json()) as { id?: string }
  if (!user.id) {
    return jsonResponse({ error: 'Não autenticado.' }, 401)
  }

  // is_team_member: existe profile para esse uid.
  const profileRes = await fetch(
    `${supabaseUrl}/rest/v1/profiles?id=eq.${user.id}&select=id`,
    {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    }
  )
  if (!profileRes.ok) {
    console.error('[sync-ad-metrics] Falha ao checar profile:', profileRes.status)
    return jsonResponse({ error: 'Falha ao validar permissão.' }, 502)
  }
  const profiles = (await profileRes.json()) as Array<{ id: string }>
  if (profiles.length === 0) {
    return jsonResponse({ error: 'Acesso negado.' }, 403)
  }

  const metaAdsToken = Deno.env.get('META_ADS_TOKEN')
  if (!metaAdsToken) {
    return jsonResponse({ error: 'META_ADS_TOKEN não configurado' }, 400)
  }

  // Busca a(s) conta(s) ativa(s) a sincronizar: uma específica (se
  // ad_account_id foi informado e está ativa) ou todas as ativas.
  const accountsFilter = body.ad_account_id
    ? `id=eq.${body.ad_account_id}&status=eq.ativo`
    : `status=eq.ativo`
  const accountsRes = await fetch(
    `${supabaseUrl}/rest/v1/ad_accounts?${accountsFilter}&select=id,meta_account_id,status`,
    {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    }
  )
  if (!accountsRes.ok) {
    console.error('[sync-ad-metrics] Falha ao buscar ad_accounts:', accountsRes.status)
    return jsonResponse({ error: 'Falha ao buscar contas de anúncio.' }, 502)
  }
  const accounts = (await accountsRes.json()) as AdAccountRecord[]

  if (accounts.length === 0) {
    return jsonResponse({ sincronizadas: 0, falhas: 0 } satisfies SyncSummary)
  }

  let sincronizadas = 0
  let falhas = 0

  for (const account of accounts) {
    try {
      const insightsUrl =
        `https://graph.facebook.com/v21.0/${account.meta_account_id}/insights` +
        `?time_increment=1&fields=spend,impressions,clicks,actions,action_values` +
        `&date_preset=last_7d&access_token=${metaAdsToken}`

      const insightsRes = await fetch(insightsUrl)
      const insightsBody = (await insightsRes.json()) as InsightsResponse

      if (!insightsRes.ok || insightsBody.error) {
        throw new Error(friendlyGraphError(insightsBody.error?.message))
      }

      const rows = insightsBody.data ?? []

      for (const row of rows) {
        if (!row.date_start) continue

        const gasto = row.spend ? Number(row.spend) : 0
        const impressoes = row.impressions ? Number(row.impressions) : 0
        const cliques = row.clicks ? Number(row.clicks) : 0
        const conversoes = parseConversoes(row.actions)
        const receita = pickActionValue(row.action_values, 'purchase')

        const upsertRes = await fetch(
          `${supabaseUrl}/rest/v1/ad_metrics_daily?on_conflict=ad_account_id,data`,
          {
            method: 'POST',
            headers: {
              apikey: serviceRoleKey,
              Authorization: `Bearer ${serviceRoleKey}`,
              'Content-Type': 'application/json',
              Prefer: 'resolution=merge-duplicates,return=minimal',
            },
            body: JSON.stringify({
              ad_account_id: account.id,
              data: row.date_start,
              gasto: Number.isFinite(gasto) ? gasto : 0,
              impressoes: Number.isFinite(impressoes) ? impressoes : 0,
              cliques: Number.isFinite(cliques) ? cliques : 0,
              conversoes,
              receita: Number.isFinite(receita) ? receita : 0,
            }),
          }
        )

        if (!upsertRes.ok) {
          const upsertErrBody = await upsertRes.text()
          console.error(
            '[sync-ad-metrics] Falha no upsert de métricas:',
            upsertRes.status,
            upsertErrBody
          )
          throw new Error('Falha ao gravar métricas sincronizadas.')
        }
      }

      // Sucesso: limpa erro e marca horário de sincronização.
      const successUpdateRes = await fetch(
        `${supabaseUrl}/rest/v1/ad_accounts?id=eq.${account.id}`,
        {
          method: 'PATCH',
          headers: {
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal',
          },
          body: JSON.stringify({
            last_sync_at: new Date().toISOString(),
            last_sync_error: null,
          }),
        }
      )
      if (!successUpdateRes.ok) {
        console.error(
          '[sync-ad-metrics] Falha ao atualizar last_sync_at:',
          successUpdateRes.status
        )
      }

      sincronizadas += 1
    } catch (err) {
      falhas += 1
      const mensagemAmigavel =
        err instanceof Error ? err.message : 'Falha desconhecida ao sincronizar.'

      console.error(
        `[sync-ad-metrics] Falha na conta ${account.id}:`,
        mensagemAmigavel
      )

      const errorUpdateRes = await fetch(
        `${supabaseUrl}/rest/v1/ad_accounts?id=eq.${account.id}`,
        {
          method: 'PATCH',
          headers: {
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal',
          },
          body: JSON.stringify({ last_sync_error: mensagemAmigavel }),
        }
      )
      if (!errorUpdateRes.ok) {
        console.error(
          '[sync-ad-metrics] Falha ao gravar last_sync_error:',
          errorUpdateRes.status
        )
      }

      const notifyRes = await fetch(`${supabaseUrl}/rest/v1/notifications`, {
        method: 'POST',
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          tipo: 'trafego',
          titulo: 'Falha ao sincronizar tráfego',
          descricao: mensagemAmigavel,
          link: '/admin/trafego',
        }),
      })
      if (!notifyRes.ok) {
        console.error(
          '[sync-ad-metrics] Falha ao criar notificação:',
          notifyRes.status
        )
      }
      // Continua para a próxima conta — falha isolada não derruba as outras.
    }
  }

  return jsonResponse({ sincronizadas, falhas } satisfies SyncSummary)
})
