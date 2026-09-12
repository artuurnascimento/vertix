/**
 * scan-agendar — marcação de call pelo Vertix Scan.
 *
 * Chamada pelo WORKER do Scan (nunca pelo navegador), com o header
 * `x-vertix-token` = SCAN_INBOUND_TOKEN, igual à scan-comprar. O worker já
 * resolveu o lead pelo código do relatório e manda os dados dele aqui.
 *
 * Duas ações no mesmo endpoint:
 *
 *   { acao: 'horarios' }
 *     → { horarios: string[] }   ISOs livres nos próximos dias, seg–sex,
 *       9h–18h de São Paulo, de 30 em 30 min, a partir de 24 h. "Livre" =
 *       não bate em nada do Google Calendar da Vertix NEM da Agenda do
 *       painel (agenda_events) — as duas agendas contam.
 *
 *   { acao: 'agendar', lead_id, inicio, nome, email, whatsapp, dominio, report_code }
 *     → { inicio, fim, meet_url }
 *       Confere que o horário ainda está livre, cria o evento no Google com
 *       o Meet (o Google manda o convite ao e-mail do lead), grava o mesmo
 *       evento em agenda_events (com meet_url e lead_id) e marca o lead como
 *       'reuniao'. Se o Google falhar, nada é gravado — melhor o lead tentar
 *       de novo do que a Agenda mostrar uma call sem videochamada.
 *
 * Sem GOOGLE_* nos secrets responde 503 — o Scan trata como "agendamento
 * indisponível" e mantém o WhatsApp como saída.
 */

import {
  DURACAO_MIN,
  FUSO,
  accessToken,
  criarEventoComMeet,
  formatarSP,
  horariosLivres,
  lerEnvGoogle,
  ocupados,
  type Periodo,
} from '../_shared/google-calendar.ts'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const CODE_RE = /^[A-Za-z0-9_-]{12}$/
const EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/

interface Body {
  acao?: string
  lead_id?: string
  inicio?: string
  nome?: string
  email?: string
  whatsapp?: string
  dominio?: string
  report_code?: string
}

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/** Eventos da Agenda do painel entre duas datas, como períodos ocupados. */
async function ocupadosNoPainel(
  restBase: string,
  headers: Record<string, string>,
  de: string,
  ate: string
): Promise<Periodo[]> {
  const res = await fetch(
    `${restBase}/agenda_events?select=inicio,fim&fim=gte.${encodeURIComponent(de)}&inicio=lte.${encodeURIComponent(ate)}`,
    { headers }
  )
  if (!res.ok) {
    console.error('[scan-agendar] Falha ao ler agenda_events:', res.status)
    return []
  }
  return (await res.json()) as Periodo[]
}

Deno.serve(async (req) => {
  const scanToken = Deno.env.get('SCAN_INBOUND_TOKEN')
  if (!scanToken) {
    console.error('[scan-agendar] SCAN_INBOUND_TOKEN não configurado.')
    return jsonResponse({ error: 'endpoint_desativado' }, 503)
  }
  if (!safeEqual(req.headers.get('x-vertix-token') ?? '', scanToken)) {
    return jsonResponse({ error: 'nao_autorizado' }, 401)
  }
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405)

  const google = lerEnvGoogle()
  if (!google) {
    console.error('[scan-agendar] GOOGLE_* ausentes nos secrets.')
    return jsonResponse({ error: 'agenda_indisponivel' }, 503)
  }
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) return jsonResponse({ error: 'env_supabase_ausente' }, 500)
  const restBase = `${supabaseUrl}/rest/v1`
  const authHeaders = { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` }
  const writeHeaders = { ...authHeaders, 'Content-Type': 'application/json', Prefer: 'return=representation' }

  let body: Body
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'payload_invalido' }, 400)
  }

  const agora = new Date()
  const janelaDe = agora.toISOString()
  const janelaAte = new Date(agora.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString()

  async function livres(): Promise<string[]> {
    const token = await accessToken(google!)
    const [doGoogle, doPainel] = await Promise.all([
      ocupados(google!, token, janelaDe, janelaAte),
      ocupadosNoPainel(restBase, authHeaders, janelaDe, janelaAte),
    ])
    return horariosLivres(agora, [...doGoogle, ...doPainel])
  }

  // ------------------------------------------------------------------------
  if (body.acao === 'horarios') {
    try {
      return jsonResponse({ horarios: await livres(), fuso: FUSO, duracao_min: DURACAO_MIN })
    } catch (erro) {
      console.error('[scan-agendar] Falha ao listar horários:', erro instanceof Error ? erro.message : erro)
      return jsonResponse({ error: 'google_indisponivel' }, 502)
    }
  }

  // ------------------------------------------------------------------------
  if (body.acao !== 'agendar') return jsonResponse({ error: 'acao_invalida' }, 400)

  const leadId = body.lead_id ?? ''
  if (!UUID_RE.test(leadId)) return jsonResponse({ error: 'lead_id_invalido' }, 400)
  const inicio = body.inicio ?? ''
  if (Number.isNaN(Date.parse(inicio))) return jsonResponse({ error: 'inicio_invalido' }, 400)
  const nome = (body.nome ?? '').trim()
  const email = (body.email ?? '').trim().toLowerCase()
  if (!nome || !EMAIL_RE.test(email)) return jsonResponse({ error: 'contato_invalido' }, 400)
  const whatsapp = (body.whatsapp ?? '').trim()
  const dominio = (body.dominio ?? '').trim() || 'loja'
  const reportCode = CODE_RE.test(body.report_code ?? '') ? body.report_code! : null

  // Um lead marca uma call de cada vez: se já existe uma futura, devolve ela.
  const existente = await fetch(
    `${restBase}/agenda_events?lead_id=eq.${leadId}&inicio=gte.${encodeURIComponent(janelaDe)}&select=inicio,fim,meet_url&order=inicio.asc&limit=1`,
    { headers: authHeaders }
  )
  if (existente.ok) {
    const linhas = (await existente.json()) as { inicio: string; fim: string; meet_url: string | null }[]
    if (linhas[0]) {
      return jsonResponse({ inicio: linhas[0].inicio, fim: linhas[0].fim, meet_url: linhas[0].meet_url, ja_marcada: true })
    }
  }

  let disponiveis: string[]
  try {
    disponiveis = await livres()
  } catch (erro) {
    console.error('[scan-agendar] Falha ao conferir horário:', erro instanceof Error ? erro.message : erro)
    return jsonResponse({ error: 'google_indisponivel' }, 502)
  }
  const inicioIso = new Date(inicio).toISOString()
  if (!disponiveis.includes(inicioIso)) return jsonResponse({ error: 'horario_indisponivel' }, 409)
  const fimIso = new Date(Date.parse(inicioIso) + DURACAO_MIN * 60_000).toISOString()

  const webUrl = (Deno.env.get('SCAN_WEB_URL') ?? 'https://scan.vertix.studio').replace(/\/+$/, '')
  const linkRelatorio = reportCode ? `${webUrl}/r/${reportCode}` : null
  const descricao = [
    `Call de 30 min sobre o Raio-X da ${dominio}.`,
    '',
    `Quem: ${nome}`,
    `E-mail: ${email}`,
    whatsapp ? `WhatsApp: ${whatsapp}` : null,
    linkRelatorio ? `Relatório: ${linkRelatorio}` : null,
    '',
    'Marcado pelo Vertix Scan.',
  ]
    .filter((l) => l !== null)
    .join('\n')

  let evento
  try {
    const token = await accessToken(google)
    evento = await criarEventoComMeet(google, token, {
      titulo: `Call · ${dominio}`,
      descricao,
      inicio: inicioIso,
      fim: fimIso,
      convidado: { email, nome },
      requestId: `scan-${leadId}-${Date.parse(inicioIso)}`,
    })
  } catch (erro) {
    console.error('[scan-agendar] Google recusou o evento:', erro instanceof Error ? erro.message : erro)
    return jsonResponse({ error: 'google_indisponivel' }, 502)
  }

  // O mesmo evento na Agenda do painel. Se falhar, a call existe no Google e
  // no e-mail do lead — o log diz o id para alguém reconciliar à mão.
  const agendaRes = await fetch(`${restBase}/agenda_events`, {
    method: 'POST',
    headers: writeHeaders,
    body: JSON.stringify({
      titulo: `Call · ${dominio}`.slice(0, 120),
      descricao,
      inicio: inicioIso,
      fim: fimIso,
      cor: 'sky',
      meet_url: evento.meetUrl,
      google_event_id: evento.id,
      lead_id: leadId,
    }),
  })
  if (!agendaRes.ok) {
    console.error(`[scan-agendar] Evento ${evento.id} criado no Google mas não na agenda_events: ${agendaRes.status}`)
  }

  // Lead: reunião marcada (o status que para a sequência de e-mails).
  const leadRes = await fetch(`${restBase}/leads?id=eq.${leadId}`, {
    method: 'PATCH',
    headers: { ...authHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'reuniao', reuniao_em: inicioIso }),
  })
  if (!leadRes.ok) console.error('[scan-agendar] Falha ao marcar o lead como reuniao:', leadRes.status)

  console.log(`[scan-agendar] Call marcada: ${formatarSP(inicioIso)} (${dominio})`)
  return jsonResponse({ inicio: inicioIso, fim: fimIso, meet_url: evento.meetUrl })
})
