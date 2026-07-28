/**
 * nps-request
 *
 * Input: { survey_id }. Disparada pelo trigger create_nps_on_delivery quando um
 * projeto vira 'entregue'. Busca a pesquisa + cliente + projeto, e envia ao
 * e-mail do cliente o link tokenizado /nps/:token (mesmo padrão Resend das
 * demais functions). Sem RESEND_API_KEY, loga e responde 200 (no-op gracioso).
 */

interface SurveyWithRelations {
  id: string
  token: string
  status: string
  clients: { nome: string; email: string | null } | null
  projects: { nome: string } | null
}

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function buildEmailHtml(
  clienteNome: string,
  projetoNome: string,
  link: string
): string {
  return `
  <div style="background:#0c0c0c;padding:40px 24px;font-family:'Kanit',Arial,sans-serif;color:#f4f4f0;">
    <div style="max-width:520px;margin:0 auto;background:#151515;border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:32px;">
      <p style="margin:0;font-size:12px;letter-spacing:4px;color:#8a8a82;">VERTIX</p>
      <h1 style="margin:16px 0 0;font-size:22px;color:#f4f4f0;">Como foi a sua experiência?</h1>
      <p style="margin:16px 0 0;font-size:14px;line-height:1.6;color:#8a8a82;">
        Olá <strong style="color:#f4f4f0;">${escapeHtml(clienteNome)}</strong>, acabamos de
        entregar <strong style="color:#f4f4f0;">${escapeHtml(projetoNome)}</strong>.
        Leva menos de um minuto: de 0 a 10, o quanto você recomendaria a Vertix?
      </p>
      <a href="${link}"
         style="display:inline-block;margin-top:24px;background:#6c5bf2;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 20px;border-radius:8px;">
        Responder pesquisa
      </a>
    </div>
  </div>`
}

Deno.serve(async (req) => {
  const resendApiKey = Deno.env.get('RESEND_API_KEY')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const appUrl = Deno.env.get('ADMIN_APP_URL') ?? 'http://localhost:5175'

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('[nps-request] Env do Supabase ausente.')
    return jsonResponse({ ok: false, reason: 'env_supabase_ausente' }, 500)
  }

  let surveyId: string | undefined
  try {
    const body = (await req.json()) as { survey_id?: string }
    surveyId = body.survey_id
  } catch {
    return jsonResponse({ ok: false, reason: 'body_invalido' }, 400)
  }

  if (!surveyId) {
    return jsonResponse({ ok: false, reason: 'survey_id_ausente' }, 400)
  }

  const surveyRes = await fetch(
    `${supabaseUrl}/rest/v1/nps_surveys?id=eq.${surveyId}` +
      '&select=id,token,status,clients(nome,email),projects(nome)',
    {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    }
  )
  if (!surveyRes.ok) {
    console.error('[nps-request] Falha ao buscar survey:', surveyRes.status)
    return jsonResponse({ ok: false, reason: 'falha_ao_buscar' }, 502)
  }

  const rows = (await surveyRes.json()) as SurveyWithRelations[]
  const survey = rows[0]
  if (!survey) {
    return jsonResponse({ ok: false, reason: 'survey_inexistente' }, 404)
  }

  const email = survey.clients?.email
  const link = `${appUrl}/nps/${survey.token}`

  if (!resendApiKey) {
    console.info('[nps-request] RESEND_API_KEY ausente — no-op.', link)
    return jsonResponse({ ok: true, skipped: 'sem_config_email', link })
  }
  if (!email) {
    console.info('[nps-request] Cliente sem e-mail — no-op.')
    return jsonResponse({ ok: true, skipped: 'cliente_sem_email' })
  }

  const clienteNome = survey.clients?.nome ?? 'Cliente'
  const projetoNome = survey.projects?.nome ?? 'seu projeto'

  const emailRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Vertix <onboarding@resend.dev>',
      to: [email],
      subject: `Como foi a entrega de ${projetoNome}?`,
      html: buildEmailHtml(clienteNome, projetoNome, link),
    }),
  })

  if (!emailRes.ok) {
    console.error('[nps-request] Falha no envio Resend:', emailRes.status)
    return jsonResponse({ ok: false, reason: 'falha_resend' }, 502)
  }

  return jsonResponse({ ok: true, enviado: true })
})
