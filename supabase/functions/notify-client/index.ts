/**
 * notify-client
 *
 * Recebe o payload dos triggers de emails_automaticos.sql:
 *   { event: 'proposta_enviada' | 'projeto_entregue' | 'parcela_criada', record: {...} }
 * onde `record` é a linha NEW da tabela que disparou o trigger (proposals,
 * projects ou receivables). Carrega os dados relacionados (cliente do
 * projeto/proposta/parcela — email + nome) via service role e envia um email
 * pt-BR simples e client-safe via Resend.
 *
 * Sem RESEND_API_KEY configurada, loga e responde 200 (no-op gracioso).
 * Cliente sem email → 200 skip silencioso (loga só o evento).
 * NUNCA loga chaves.
 */

type NotifyEvent = 'proposta_enviada' | 'projeto_entregue' | 'parcela_criada'

interface ProposalRecord {
  id: string
  project_id: string
  titulo: string
  token: string
}

interface ProjectRecord {
  id: string
  client_id: string
  nome: string
}

interface ReceivableRecord {
  id: string
  project_id: string
  client_id: string
  descricao: string
  valor: number
  vencimento: string
  payment_link: string | null
}

type EventRecord = ProposalRecord | ProjectRecord | ReceivableRecord

interface WebhookPayload {
  event?: NotifyEvent
  record?: EventRecord | null
}

interface ClientInfo {
  nome: string
  empresa: string | null
  email: string | null
}

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
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

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function formatBRL(valor: number): string {
  return valor.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function formatDateBR(iso: string): string {
  const [year, month, day] = iso.split('-')
  if (!year || !month || !day) return iso
  return `${day}/${month}/${year}`
}

function emailShell(title: string, bodyHtml: string): string {
  return `
  <div style="background:#f4f4f4;padding:40px 24px;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e5e5e5;border-radius:12px;padding:32px;">
      <p style="margin:0;font-size:12px;letter-spacing:3px;color:#8a8a82;">VERTIX</p>
      <h1 style="margin:16px 0 0;font-size:22px;color:#1a1a1a;">${title}</h1>
      ${bodyHtml}
    </div>
  </div>`
}

/**
 * Só deixa passar URL http(s) absoluta. Qualquer outra coisa (javascript:,
 * data:, aspas que escapariam do atributo href) vira null e o botão não é
 * renderizado. Vale mesmo com os dados vindo do banco: um payment_link
 * corrompido não pode virar vetor de injeção dentro do e-mail.
 */
function safeUrl(raw: string | null): string | null {
  if (!raw) return null
  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    return null
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null
  return parsed.toString()
}

function ctaButton(href: string, label: string): string {
  const safe = safeUrl(href)
  if (!safe) {
    console.warn('[notify-client] URL de CTA rejeitada.')
    return ''
  }
  return `
      <a href="${escapeHtml(safe)}"
         style="display:inline-block;margin-top:24px;background:#6c5bf2;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 20px;border-radius:8px;">
        ${escapeHtml(label)}
      </a>`
}

function buildPropostaEnviadaEmail(
  clienteNome: string,
  projetoUrl: string
): { subject: string; html: string } {
  const body = `
      <p style="margin:16px 0 0;font-size:14px;line-height:1.6;color:#4a4a4a;">
        Olá, <strong>${escapeHtml(clienteNome)}</strong>! Sua proposta comercial está pronta
        para análise. Acesse o link abaixo para ver os detalhes e responder.
      </p>
      ${ctaButton(projetoUrl, 'Ver proposta')}`
  return {
    subject: 'Sua proposta está pronta',
    html: emailShell('Proposta enviada', body),
  }
}

function buildProjetoEntregueEmail(
  clienteNome: string,
  projetoNome: string,
  portalUrl: string
): { subject: string; html: string } {
  const body = `
      <p style="margin:16px 0 0;font-size:14px;line-height:1.6;color:#4a4a4a;">
        Parabéns, <strong>${escapeHtml(clienteNome)}</strong>! O projeto
        <strong>${escapeHtml(projetoNome)}</strong> foi entregue. Acesse o portal do
        cliente para conferir tudo.
      </p>
      ${ctaButton(portalUrl, 'Acessar portal do cliente')}`
  return {
    subject: `Projeto entregue — ${projetoNome}`,
    html: emailShell('Projeto entregue', body),
  }
}

function buildParcelaCriadaEmail(
  clienteNome: string,
  descricao: string,
  valor: number,
  vencimento: string,
  paymentLink: string | null
): { subject: string; html: string } {
  const linkHtml = paymentLink ? ctaButton(paymentLink, 'Pagar agora') : ''
  const body = `
      <p style="margin:16px 0 0;font-size:14px;line-height:1.6;color:#4a4a4a;">
        Olá, <strong>${escapeHtml(clienteNome)}</strong>! Uma nova parcela foi gerada:
      </p>
      <p style="margin:16px 0 0;font-size:14px;line-height:1.6;color:#1a1a1a;">
        <strong>${escapeHtml(descricao)}</strong><br/>
        Valor: <strong>${escapeHtml(formatBRL(valor))}</strong><br/>
        Vencimento: <strong>${escapeHtml(formatDateBR(vencimento))}</strong>
      </p>
      ${linkHtml}`
  return {
    subject: `Nova parcela — ${formatBRL(valor)}`,
    html: emailShell('Parcela gerada', body),
  }
}

async function fetchClient(
  supabaseUrl: string,
  serviceRoleKey: string,
  clientId: string
): Promise<ClientInfo | null> {
  const res = await fetch(
    `${supabaseUrl}/rest/v1/clients?id=eq.${clientId}&select=nome,empresa,email`,
    {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    }
  )
  if (!res.ok) {
    console.error('[notify-client] Falha ao buscar cliente:', res.status)
    return null
  }
  const clients = (await res.json()) as ClientInfo[]
  return clients[0] ?? null
}

async function fetchProject(
  supabaseUrl: string,
  serviceRoleKey: string,
  projectId: string
): Promise<{ id: string; nome: string; client_id: string; portal_token: string } | null> {
  const res = await fetch(
    `${supabaseUrl}/rest/v1/projects?id=eq.${projectId}` +
      '&select=id,nome,client_id,portal_token',
    {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    }
  )
  if (!res.ok) {
    console.error('[notify-client] Falha ao buscar projeto:', res.status)
    return null
  }
  const projects = (await res.json()) as Array<{
    id: string
    nome: string
    client_id: string
    portal_token: string
  }>
  return projects[0] ?? null
}

async function fetchProposal(
  supabaseUrl: string,
  serviceRoleKey: string,
  proposalId: string
): Promise<ProposalRecord | null> {
  const res = await fetch(
    `${supabaseUrl}/rest/v1/proposals?id=eq.${proposalId}` +
      '&select=id,project_id,titulo,token',
    {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    }
  )
  if (!res.ok) {
    console.error('[notify-client] Falha ao buscar proposta:', res.status)
    return null
  }
  const proposals = (await res.json()) as ProposalRecord[]
  return proposals[0] ?? null
}

async function fetchReceivable(
  supabaseUrl: string,
  serviceRoleKey: string,
  receivableId: string
): Promise<ReceivableRecord | null> {
  const res = await fetch(
    `${supabaseUrl}/rest/v1/receivables?id=eq.${receivableId}` +
      '&select=id,project_id,client_id,descricao,valor,vencimento,payment_link',
    {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    }
  )
  if (!res.ok) {
    console.error('[notify-client] Falha ao buscar parcela:', res.status)
    return null
  }
  const receivables = (await res.json()) as ReceivableRecord[]
  return receivables[0] ?? null
}

async function sendEmail(
  resendApiKey: string,
  to: string,
  subject: string,
  html: string
): Promise<boolean> {
  const emailRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Vertix <no-reply@vertix.studio>',
      reply_to: 'contato@vertix.studio',
      to: [to],
      subject,
      html,
    }),
  })

  const emailBody = (await emailRes.json()) as Record<string, unknown>
  if (!emailRes.ok) {
    console.error(
      '[notify-client] Erro do Resend:',
      emailRes.status,
      JSON.stringify(emailBody)
    )
    return false
  }
  console.info('[notify-client] Email enviado:', emailBody.id)
  return true
}

Deno.serve(async (req) => {
  // Só triggers internos do banco podem chamar: exige o segredo compartilhado.
  // A anon key sozinha não basta — ela é pública (vai no bundle do frontend).
  const edgeSecret = Deno.env.get('EDGE_SHARED_SECRET')
  if (!edgeSecret) {
    console.error('[notify-client] EDGE_SHARED_SECRET não configurado.')
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

  const event = payload.event
  const record = payload.record
  if (!event || !record) {
    return jsonResponse({ ok: true, skipped: 'sem_evento_ou_record' })
  }

  const resendApiKey = Deno.env.get('RESEND_API_KEY')
  if (!resendApiKey) {
    console.info(`[notify-client] RESEND_API_KEY ausente — no-op. evento=${event}`)
    return jsonResponse({ ok: true, skipped: 'sem_config_email', event })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const adminAppUrl = Deno.env.get('ADMIN_APP_URL') ?? 'http://localhost:5175'
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('[notify-client] Env do Supabase ausente.')
    return jsonResponse({ ok: false, reason: 'env_supabase_ausente' }, 500)
  }

  if (event === 'proposta_enviada') {
    // Nunca confia no payload: o token da proposta (que dá acesso à página
    // pública) tem de vir do banco, não da requisição.
    const proposal = await fetchProposal(
      supabaseUrl,
      serviceRoleKey,
      (record as ProposalRecord).id
    )
    if (!proposal) {
      return jsonResponse({ ok: false, reason: 'proposta_nao_encontrada' }, 404)
    }
    const project = await fetchProject(supabaseUrl, serviceRoleKey, proposal.project_id)
    if (!project) {
      return jsonResponse({ ok: false, reason: 'projeto_nao_encontrado' }, 404)
    }
    const client = await fetchClient(supabaseUrl, serviceRoleKey, project.client_id)
    if (!client?.email) {
      console.info(`[notify-client] Cliente sem email — evento=${event}`)
      return jsonResponse({ ok: true, skipped: 'cliente_sem_email', event })
    }

    const clienteNome = client.empresa ?? client.nome
    const propostaUrl = `${adminAppUrl}/proposta/${proposal.token}`
    const { subject, html } = buildPropostaEnviadaEmail(clienteNome, propostaUrl)
    const sent = await sendEmail(resendApiKey, client.email, subject, html)
    return jsonResponse({ ok: sent, event })
  }

  if (event === 'projeto_entregue') {
    // Nunca confia no payload: nome do projeto e portal_token vêm do banco.
    const project = await fetchProject(
      supabaseUrl,
      serviceRoleKey,
      (record as ProjectRecord).id
    )
    if (!project) {
      return jsonResponse({ ok: false, reason: 'projeto_nao_encontrado' }, 404)
    }
    const client = await fetchClient(supabaseUrl, serviceRoleKey, project.client_id)
    if (!client?.email) {
      console.info(`[notify-client] Cliente sem email — evento=${event}`)
      return jsonResponse({ ok: true, skipped: 'cliente_sem_email', event })
    }

    const clienteNome = client.empresa ?? client.nome
    const portalUrl = project.portal_token
      ? `${adminAppUrl}/portal/${project.portal_token}`
      : adminAppUrl
    const { subject, html } = buildProjetoEntregueEmail(clienteNome, project.nome, portalUrl)
    const sent = await sendEmail(resendApiKey, client.email, subject, html)
    return jsonResponse({ ok: sent, event })
  }

  if (event === 'parcela_criada') {
    // Nunca confia no payload: re-busca a parcela no banco pelo id, para que
    // descrição/valor/payment_link do e-mail venham sempre do banco.
    const receivable = await fetchReceivable(
      supabaseUrl,
      serviceRoleKey,
      (record as ReceivableRecord).id
    )
    if (!receivable) {
      return jsonResponse({ ok: false, reason: 'parcela_nao_encontrada' }, 404)
    }
    const client = await fetchClient(supabaseUrl, serviceRoleKey, receivable.client_id)
    if (!client?.email) {
      console.info(`[notify-client] Cliente sem email — evento=${event}`)
      return jsonResponse({ ok: true, skipped: 'cliente_sem_email', event })
    }

    const clienteNome = client.empresa ?? client.nome
    const { subject, html } = buildParcelaCriadaEmail(
      clienteNome,
      receivable.descricao,
      receivable.valor,
      receivable.vencimento,
      receivable.payment_link
    )
    const sent = await sendEmail(resendApiKey, client.email, subject, html)
    return jsonResponse({ ok: sent, event })
  }

  console.info(`[notify-client] Evento desconhecido: ${event}`)
  return jsonResponse({ ok: true, skipped: 'evento_desconhecido', event })
})
