/**
 * Google Calendar da Vertix — o que a marcação de call precisa dele.
 *
 * Três chamadas, e só três: renovar o access token (o refresh token de longa
 * duração fica nos secrets, autorizado uma vez pela conta dona do
 * calendário), perguntar os períodos ocupados (free/busy) e criar o evento
 * com a videochamada — é o `conferenceData` que faz o Google gerar o link do
 * Meet e o convite para o e-mail do lead.
 *
 * Fuso: tudo aqui é calculado em America/Sao_Paulo, que é onde a agenda vive;
 * os ISOs que saem são absolutos (com offset), então o painel e o Scan não
 * precisam saber de fuso nenhum.
 *
 * NUNCA loga tokens. Falhas do Google viram erro com o status, sem o corpo.
 */

export const FUSO = 'America/Sao_Paulo'

interface Env {
  clientId: string
  clientSecret: string
  refreshToken: string
  calendarId: string
}

export function lerEnvGoogle(): Env | null {
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID')?.trim()
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')?.trim()
  const refreshToken = Deno.env.get('GOOGLE_REFRESH_TOKEN')?.trim()
  const calendarId = Deno.env.get('GOOGLE_CALENDAR_ID')?.trim() || 'primary'
  if (!clientId || !clientSecret || !refreshToken) return null
  return { clientId, clientSecret, refreshToken, calendarId }
}

/** Access token de curta duração a partir do refresh token. */
export async function accessToken(env: Env): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.clientId,
      client_secret: env.clientSecret,
      refresh_token: env.refreshToken,
      grant_type: 'refresh_token',
    }),
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) throw new Error(`google_token_${res.status}`)
  const json = (await res.json()) as { access_token?: string }
  if (!json.access_token) throw new Error('google_token_vazio')
  return json.access_token
}

export interface Periodo {
  inicio: string
  fim: string
}

/** Períodos ocupados no calendário entre duas datas (ISO). */
export async function ocupados(
  env: Env,
  token: string,
  de: string,
  ate: string
): Promise<Periodo[]> {
  const res = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      timeMin: de,
      timeMax: ate,
      timeZone: FUSO,
      items: [{ id: env.calendarId }],
    }),
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) throw new Error(`google_freebusy_${res.status}`)
  const json = (await res.json()) as {
    calendars?: Record<string, { busy?: { start: string; end: string }[] }>
  }
  const busy = json.calendars?.[env.calendarId]?.busy ?? Object.values(json.calendars ?? {})[0]?.busy ?? []
  return busy.map((b) => ({ inicio: b.start, fim: b.end }))
}

export interface NovoEvento {
  titulo: string
  descricao: string
  inicio: string
  fim: string
  /** E-mail do lead: recebe o convite com o Meet. */
  convidado: { email: string; nome: string }
  /** Id estável para o Meet (idempotência do createRequest). */
  requestId: string
}

export interface EventoCriado {
  id: string
  meetUrl: string | null
  htmlLink: string | null
}

/**
 * Cria o evento com videochamada e manda o convite ao lead. `sendUpdates=all`
 * é o que faz o Google enviar o e-mail com o link — nós não mandamos outro.
 */
export async function criarEventoComMeet(
  env: Env,
  token: string,
  evento: NovoEvento
): Promise<EventoCriado> {
  const url =
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(env.calendarId)}/events` +
    '?conferenceDataVersion=1&sendUpdates=all'
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      summary: evento.titulo,
      description: evento.descricao,
      start: { dateTime: evento.inicio, timeZone: FUSO },
      end: { dateTime: evento.fim, timeZone: FUSO },
      attendees: [{ email: evento.convidado.email, displayName: evento.convidado.nome }],
      conferenceData: {
        createRequest: {
          requestId: evento.requestId,
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      },
      reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 10 }, { method: 'email', minutes: 60 }] },
      guestsCanModify: false,
    }),
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new Error(`google_evento_${res.status}`)
  const json = (await res.json()) as {
    id: string
    hangoutLink?: string
    htmlLink?: string
    conferenceData?: { entryPoints?: { entryPointType?: string; uri?: string }[] }
  }
  const meet =
    json.hangoutLink ??
    json.conferenceData?.entryPoints?.find((e) => e.entryPointType === 'video')?.uri ??
    null
  return { id: json.id, meetUrl: meet, htmlLink: json.htmlLink ?? null }
}

// ---------------------------------------------------------------------------
// Horários livres — puro, testável sem rede
// ---------------------------------------------------------------------------

export const DURACAO_MIN = 30
export const HORA_INICIO = 9
export const HORA_FIM = 18
/** Só marca a partir de amanhã, no mínimo 24 h à frente. */
export const ANTECEDENCIA_MIN_MS = 24 * 60 * 60 * 1000
export const DIAS_A_FRENTE = 10

/** Partes de uma data no fuso de São Paulo. */
function partesSP(d: Date): { ano: number; mes: number; dia: number; hora: number; minuto: number; diaSemana: number } {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: FUSO,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    weekday: 'short',
  })
  const p = Object.fromEntries(fmt.formatToParts(d).map((x) => [x.type, x.value]))
  const dias: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  return {
    ano: Number(p.year),
    mes: Number(p.month),
    dia: Number(p.day),
    hora: Number(p.hour) % 24,
    minuto: Number(p.minute),
    diaSemana: dias[p.weekday] ?? 0,
  }
}

/** Offset (min) de São Paulo numa data — o Brasil não tem horário de verão desde 2019, mas não se confia nisso. */
function offsetSPMinutos(d: Date): number {
  const p = partesSP(d)
  const comoUtc = Date.UTC(p.ano, p.mes - 1, p.dia, p.hora, p.minuto)
  return Math.round((comoUtc - d.getTime()) / 60_000)
}

/** Date absoluto para "ano-mes-dia hora:minuto" em São Paulo. */
function dataSP(ano: number, mes: number, dia: number, hora: number, minuto: number): Date {
  const chute = new Date(Date.UTC(ano, mes - 1, dia, hora, minuto))
  const offset = offsetSPMinutos(chute)
  return new Date(chute.getTime() - offset * 60_000)
}

function sobrepoe(aIni: number, aFim: number, bIni: number, bFim: number): boolean {
  return aIni < bFim && bIni < aFim
}

/**
 * Todos os horários de 30 min, seg–sex 9h–18h (SP), a partir de 24 h de
 * `agora`, nos próximos `DIAS_A_FRENTE` dias, que não batem em nenhum período
 * ocupado. Saída em ISO absoluto, ordenada.
 */
export function horariosLivres(agora: Date, ocupadosLista: Periodo[]): string[] {
  const minimo = agora.getTime() + ANTECEDENCIA_MIN_MS
  const busy = ocupadosLista.map((o) => ({ i: Date.parse(o.inicio), f: Date.parse(o.fim) }))
  const saida: string[] = []
  for (let d = 1; d <= DIAS_A_FRENTE + 1; d++) {
    const diaRef = new Date(agora.getTime() + d * 24 * 60 * 60 * 1000)
    const p = partesSP(diaRef)
    if (p.diaSemana === 0 || p.diaSemana === 6) continue
    for (let h = HORA_INICIO; h < HORA_FIM; h++) {
      for (let m = 0; m < 60; m += DURACAO_MIN) {
        const ini = dataSP(p.ano, p.mes, p.dia, h, m)
        const fim = new Date(ini.getTime() + DURACAO_MIN * 60_000)
        if (ini.getTime() < minimo) continue
        if (busy.some((b) => sobrepoe(ini.getTime(), fim.getTime(), b.i, b.f))) continue
        saida.push(ini.toISOString())
      }
    }
  }
  return saida
}

/** "sexta-feira, 19 de setembro, 10:30" — para o título e os logs. */
export function formatarSP(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: FUSO,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}
