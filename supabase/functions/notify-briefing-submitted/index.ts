/**
 * notify-briefing-submitted
 *
 * Recebe o payload do Database Webhook (AFTER UPDATE em public.briefings,
 * quando status vira 'preenchido'), busca projeto + cliente com service role
 * e notifica o admin por email via Resend.
 *
 * Sem RESEND_API_KEY configurada, loga e responde 200 (no-op gracioso) para
 * não quebrar o webhook.
 */

interface BriefingRecord {
  id: string
  project_id: string
  status: string
  submitted_at: string | null
}

interface WebhookPayload {
  type?: string
  table?: string
  record?: BriefingRecord | null
  old_record?: BriefingRecord | null
}

interface ProjectWithClient {
  id: string
  nome: string
  tipo_servico: string
  clients: { nome: string; empresa: string | null } | null
}

const TIPO_SERVICO_LABELS: Record<string, string> = {
  ecommerce: 'E-commerce',
  sistema: 'Sistema',
  site: 'Site',
}

/** Comparação em tempo constante — não vaza o segredo por timing. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
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
  tipoLabel: string,
  projetoUrl: string
): string {
  return `
  <div style="background:#0c0c0c;padding:40px 24px;font-family:'Kanit',Arial,sans-serif;color:#f4f4f0;">
    <div style="max-width:520px;margin:0 auto;background:#151515;border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:32px;">
      <p style="margin:0;font-size:12px;letter-spacing:4px;color:#8a8a82;">VERTIX</p>
      <h1 style="margin:16px 0 0;font-size:22px;color:#f4f4f0;">Briefing recebido</h1>
      <p style="margin:16px 0 0;font-size:14px;line-height:1.6;color:#8a8a82;">
        O cliente <strong style="color:#f4f4f0;">${escapeHtml(clienteNome)}</strong>
        preencheu o briefing do projeto
        <strong style="color:#f4f4f0;">${escapeHtml(projetoNome)}</strong>
        (${escapeHtml(tipoLabel)}).
      </p>
      <a href="${projetoUrl}"
         style="display:inline-block;margin-top:24px;background:#6c5bf2;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 20px;border-radius:8px;">
        Ver respostas no painel
      </a>
    </div>
  </div>`
}

Deno.serve(async (req) => {
  // Só o webhook interno do banco pode chamar: exige o segredo compartilhado.
  // A anon key sozinha não basta — ela é pública (vai no bundle do frontend).
  const edgeSecret = Deno.env.get('EDGE_SHARED_SECRET')
  if (!edgeSecret) {
    console.error('[notify-briefing-submitted] EDGE_SHARED_SECRET não configurado.')
    return jsonResponse({ ok: false, reason: 'config_ausente' }, 500)
  }
  if (!safeEqual(req.headers.get('x-edge-secret') ?? '', edgeSecret)) {
    return jsonResponse({ ok: false, reason: 'nao_autorizado' }, 401)
  }

  let payload: WebhookPayload
  try {
    payload = await req.json()
  } catch {
    return jsonResponse({ ok: false, reason: 'payload_invalido' }, 400)
  }

  const briefingId = payload.record?.id
  if (!briefingId) {
    return jsonResponse({ ok: true, skipped: 'sem_record' })
  }

  const resendApiKey = Deno.env.get('RESEND_API_KEY')
  const adminEmail = Deno.env.get('ADMIN_EMAIL')
  if (!resendApiKey || !adminEmail) {
    console.info(
      '[notify-briefing-submitted] RESEND_API_KEY/ADMIN_EMAIL ausentes — no-op.'
    )
    return jsonResponse({ ok: true, skipped: 'sem_config_email' })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const adminAppUrl = Deno.env.get('ADMIN_APP_URL') ?? 'http://localhost:5175'
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('[notify-briefing-submitted] Env do Supabase ausente.')
    return jsonResponse({ ok: false, reason: 'env_supabase_ausente' }, 500)
  }

  // Nunca confia no payload: re-busca o briefing pelo id e confere o status
  // no banco antes de notificar.
  const briefingRes = await fetch(
    `${supabaseUrl}/rest/v1/briefings?id=eq.${briefingId}` +
      '&select=id,project_id,status',
    {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    }
  )
  if (!briefingRes.ok) {
    console.error('[notify-briefing-submitted] Falha ao buscar briefing:', briefingRes.status)
    return jsonResponse({ ok: false, reason: 'falha_ao_buscar_briefing' }, 502)
  }
  const briefings = (await briefingRes.json()) as BriefingRecord[]
  const record = briefings[0]
  if (!record || record.status !== 'preenchido') {
    return jsonResponse({ ok: true, skipped: 'status_nao_preenchido' })
  }

  // Projeto + cliente via PostgREST com service role (bypassa RLS).
  const projectRes = await fetch(
    `${supabaseUrl}/rest/v1/projects?id=eq.${record.project_id}` +
      '&select=id,nome,tipo_servico,clients(nome,empresa)',
    {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    }
  )
  if (!projectRes.ok) {
    console.error(
      '[notify-briefing-submitted] Falha ao buscar projeto:',
      projectRes.status
    )
    return jsonResponse({ ok: false, reason: 'projeto_nao_carregado' }, 502)
  }

  const projects = (await projectRes.json()) as ProjectWithClient[]
  const project = projects[0]
  if (!project) {
    return jsonResponse({ ok: false, reason: 'projeto_nao_encontrado' }, 404)
  }

  const clienteNome = project.clients?.empresa ?? project.clients?.nome ?? 'Cliente'
  const tipoLabel =
    TIPO_SERVICO_LABELS[project.tipo_servico] ?? project.tipo_servico
  const projetoUrl = `${adminAppUrl}/admin/projetos/${project.id}`

  const emailRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Vertix <no-reply@vertix.studio>',
      reply_to: 'contato@vertix.studio',
      to: [adminEmail],
      subject: `Briefing recebido — ${clienteNome} (${tipoLabel})`,
      html: buildEmailHtml(clienteNome, project.nome, tipoLabel, projetoUrl),
    }),
  })

  const emailBody = (await emailRes.json()) as Record<string, unknown>
  if (!emailRes.ok) {
    console.error(
      '[notify-briefing-submitted] Erro do Resend:',
      emailRes.status,
      JSON.stringify(emailBody)
    )
    return jsonResponse(
      { ok: false, resend_status: emailRes.status, resend_error: emailBody },
      502
    )
  }

  console.info('[notify-briefing-submitted] Email enviado:', emailBody.id)
  return jsonResponse({ ok: true, email_id: emailBody.id })
})
