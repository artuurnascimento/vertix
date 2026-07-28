/**
 * payment-reminders
 *
 * Sem input (disparada por cron/Scheduled Function). Busca receivables
 * pendentes com vencimento = hoje+3 ou vencidas (< hoje), envia email de
 * lembrete via Resend (mesmo padrão de notify-briefing-submitted) ao email
 * do cliente com descrição/valor/payment_link (se houver). Retorna contagem.
 *
 * Sem RESEND_API_KEY configurada, loga e responde 200 (no-op gracioso).
 */

interface ReceivableWithClient {
  id: string
  descricao: string
  valor: number
  vencimento: string
  payment_link: string | null
  clients: { nome: string; email: string | null } | null
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

function formatMoney(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function buildEmailHtml(
  clienteNome: string,
  descricao: string,
  valorFormatado: string,
  vencimentoFormatado: string,
  paymentLink: string | null
): string {
  const botao = paymentLink
    ? `<a href="${paymentLink}"
         style="display:inline-block;margin-top:24px;background:#6c5bf2;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 20px;border-radius:8px;">
        Pagar agora
      </a>`
    : ''

  return `
  <div style="background:#0c0c0c;padding:40px 24px;font-family:'Kanit',Arial,sans-serif;color:#f4f4f0;">
    <div style="max-width:520px;margin:0 auto;background:#151515;border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:32px;">
      <p style="margin:0;font-size:12px;letter-spacing:4px;color:#8a8a82;">VERTIX</p>
      <h1 style="margin:16px 0 0;font-size:22px;color:#f4f4f0;">Lembrete de pagamento</h1>
      <p style="margin:16px 0 0;font-size:14px;line-height:1.6;color:#8a8a82;">
        Olá <strong style="color:#f4f4f0;">${escapeHtml(clienteNome)}</strong>, identificamos uma parcela
        <strong style="color:#f4f4f0;">${escapeHtml(descricao)}</strong> no valor de
        <strong style="color:#f4f4f0;">${escapeHtml(valorFormatado)}</strong>
        com vencimento em <strong style="color:#f4f4f0;">${escapeHtml(vencimentoFormatado)}</strong>.
      </p>
      ${botao}
    </div>
  </div>`
}

Deno.serve(async (_req) => {
  const resendApiKey = Deno.env.get('RESEND_API_KEY')
  if (!resendApiKey) {
    console.info('[payment-reminders] RESEND_API_KEY ausente — no-op.')
    return jsonResponse({ ok: true, skipped: 'sem_config_email', enviados: 0 })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('[payment-reminders] Env do Supabase ausente.')
    return jsonResponse({ ok: false, reason: 'env_supabase_ausente' }, 500)
  }

  const hoje = new Date()
  const hojeStr = hoje.toISOString().slice(0, 10)
  const emTresDias = new Date(hoje.getTime() + 3 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10)

  // Vencidas (< hoje) OU vencendo em exatamente hoje+3.
  const filtro =
    `status=eq.pendente&or=(vencimento.lt.${hojeStr},vencimento.eq.${emTresDias})`

  const receivablesRes = await fetch(
    `${supabaseUrl}/rest/v1/receivables?${filtro}` +
      '&select=id,descricao,valor,vencimento,payment_link,clients(nome,email)',
    {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    }
  )
  if (!receivablesRes.ok) {
    console.error('[payment-reminders] Falha ao buscar receivables:', receivablesRes.status)
    return jsonResponse({ ok: false, reason: 'falha_ao_buscar' }, 502)
  }

  const receivables = (await receivablesRes.json()) as ReceivableWithClient[]
  let enviados = 0

  for (const r of receivables) {
    const email = r.clients?.email
    if (!email) continue

    const clienteNome = r.clients?.nome ?? 'Cliente'
    const valorFormatado = formatMoney(r.valor)
    const vencimentoFormatado = new Date(r.vencimento + 'T00:00:00').toLocaleDateString('pt-BR')

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Vertix <nao-responda@vertix.studio>',
        to: [email],
        subject: `Lembrete de pagamento — ${r.descricao}`,
        html: buildEmailHtml(
          clienteNome,
          r.descricao,
          valorFormatado,
          vencimentoFormatado,
          r.payment_link
        ),
      }),
    })

    if (!emailRes.ok) {
      const errorBody = await emailRes.json().catch(() => ({}))
      console.error(
        '[payment-reminders] Erro do Resend para receivable',
        r.id,
        emailRes.status,
        JSON.stringify(errorBody)
      )
      continue
    }

    enviados += 1
  }

  return jsonResponse({ ok: true, enviados, total_candidatas: receivables.length })
})
