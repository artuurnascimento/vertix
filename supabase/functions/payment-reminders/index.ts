/**
 * payment-reminders
 *
 * Sem input (disparada por cron/Scheduled Function). Envia lembrete de
 * cobrança via Resend ao email do cliente, com descrição/valor/payment_link.
 *
 * CONTROLE DE REENVIO (corrigido em 2026-09-05): antes o filtro era só
 * `pendente AND (vencida OR vence em 3 dias)`, sem registrar nada — logo toda
 * cobrança vencida era relembrada TODO DIA, indefinidamente. Agora:
 *   - aviso 3 dias antes: uma vez (lembretes_enviados = 0);
 *   - após o vencimento: no máximo a cada REENVIO_MIN_DIAS dias;
 *   - teto de MAX_LEMBRETES por cobrança.
 * Cada envio grava `ultimo_lembrete_em` e incrementa `lembretes_enviados`.
 *
 * Sem RESEND_API_KEY configurada, loga e responde 200 (no-op gracioso).
 */

/** Intervalo mínimo entre dois lembretes da MESMA cobrança. */
const REENVIO_MIN_DIAS = 7
/** Teto de lembretes por cobrança — depois disso, cobrança é no braço. */
const MAX_LEMBRETES = 4
const MS_POR_DIA = 24 * 60 * 60 * 1000

interface ReceivableWithClient {
  id: string
  descricao: string
  valor: number
  vencimento: string
  payment_link: string | null
  ultimo_lembrete_em: string | null
  lembretes_enviados: number | null
  clients: { nome: string; email: string | null } | null
}

/** Decide se esta cobrança merece um lembrete hoje. Pura — sem rede. */
export function deveLembrar(
  r: Pick<ReceivableWithClient, 'ultimo_lembrete_em' | 'lembretes_enviados'>,
  agora: Date
): boolean {
  const enviados = r.lembretes_enviados ?? 0
  if (enviados >= MAX_LEMBRETES) return false
  if (!r.ultimo_lembrete_em) return true
  const desde = agora.getTime() - new Date(r.ultimo_lembrete_em).getTime()
  return desde >= REENVIO_MIN_DIAS * MS_POR_DIA
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

/** Só URL http(s) absoluta vira botão; o resto é descartado. */
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
  const linkSeguro = safeUrl(paymentLink)
  const botao = linkSeguro
    ? `<a href="${escapeHtml(linkSeguro)}"
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

Deno.serve(async (req) => {
  // Só o cron interno do banco pode chamar: exige o segredo compartilhado.
  // A anon key sozinha não basta — ela é pública (vai no bundle do frontend).
  const edgeSecret = Deno.env.get('EDGE_SHARED_SECRET')
  if (!edgeSecret) {
    console.error('[payment-reminders] EDGE_SHARED_SECRET não configurado.')
    return jsonResponse({ ok: false, reason: 'config_ausente' }, 500)
  }
  if (!safeEqual(req.headers.get('x-edge-secret') ?? '', edgeSecret)) {
    return jsonResponse({ ok: false, reason: 'nao_autorizado' }, 401)
  }

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
      '&select=id,descricao,valor,vencimento,payment_link,ultimo_lembrete_em,' +
      'lembretes_enviados,clients(nome,email)',
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
  let ignorados = 0

  for (const r of receivables) {
    const email = r.clients?.email
    if (!email) continue

    // Guarda contra o reenvio diário: respeita intervalo e teto.
    if (!deveLembrar(r, hoje)) {
      ignorados += 1
      continue
    }

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
        from: 'Vertix <no-reply@vertix.studio>',
        reply_to: 'contato@vertix.studio',
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

    // Registro do envio ANTES de seguir: se isto falhar, é melhor não reenviar
    // amanhã do que arriscar o loop diário que motivou esta correção.
    const marcaRes = await fetch(`${supabaseUrl}/rest/v1/receivables?id=eq.${r.id}`, {
      method: 'PATCH',
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        ultimo_lembrete_em: new Date().toISOString(),
        lembretes_enviados: (r.lembretes_enviados ?? 0) + 1,
      }),
    })
    if (!marcaRes.ok) {
      console.error('[payment-reminders] Falha ao marcar lembrete do receivable', r.id, marcaRes.status)
    }

    enviados += 1
  }

  return jsonResponse({
    ok: true,
    enviados,
    ignorados,
    total_candidatas: receivables.length,
  })
})
