import { buildWhatsAppLink, firstNameOf } from '../ui/whatsapp'
import { raioxSupabase } from './raioxSupabase'
import type {
  Analysis,
  LeadComAnalise,
  LeadStatus,
  LightResultResumo,
} from './raioxTypes'

/**
 * Camada de dados do módulo Leads Raio-X — queries e mutations contra o
 * Supabase do projeto raiox, mais os helpers de link (relatório, teaser,
 * WhatsApp contextualizado).
 */

const ABANDONO_WINDOW_DAYS = 30
const MS_IN_DAY = 24 * 60 * 60 * 1000

const ANALYSIS_FIELDS =
  'id, url, domain, status, score, light_result, created_at'

export async function fetchLeads(): Promise<LeadComAnalise[]> {
  const { data, error } = await raioxSupabase
    .from('leads')
    .select(`*, analyses(${ANALYSIS_FIELDS})`)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as LeadComAnalise[]
}

/**
 * Abandonos = analyses dos últimos 30 dias sem lead correspondente
 * (não existe tabela própria — ver CONTRACT.md). Dois selects e o
 * cruzamento é feito aqui, imutável.
 */
export async function fetchAbandonos(): Promise<Analysis[]> {
  const since = new Date(
    Date.now() - ABANDONO_WINDOW_DAYS * MS_IN_DAY
  ).toISOString()

  const [analysesRes, leadsRes] = await Promise.all([
    raioxSupabase
      .from('analyses')
      .select(ANALYSIS_FIELDS)
      .gte('created_at', since)
      .order('created_at', { ascending: false }),
    raioxSupabase.from('leads').select('analysis_id'),
  ])

  if (analysesRes.error) throw new Error(analysesRes.error.message)
  if (leadsRes.error) throw new Error(leadsRes.error.message)

  const comLead = new Set(
    (leadsRes.data ?? []).map((l) => l.analysis_id as string)
  )
  return ((analysesRes.data ?? []) as Analysis[]).filter(
    (a) => !comLead.has(a.id)
  )
}

export async function updateLeadStatus(
  id: string,
  status: LeadStatus
): Promise<void> {
  const { error } = await raioxSupabase
    .from('leads')
    .update({ status })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

// ---------------------------------------------------------------------------
// Links
// ---------------------------------------------------------------------------

// Site público do Scan. A env é só um override; o padrão já é o domínio real.
const reportBase = (
  (import.meta.env.VITE_RAIOX_REPORT_URL as string | undefined) ?? 'https://scan.vertix.studio'
).replace(/\/+$/, '')

/**
 * Link do relatório para o WhatsApp do cliente. Prefere o código curto
 * (`/r/<code>`, ~41 chars, e o worker registra a leitura); cai no link longo
 * com token para os leads criados antes do código existir.
 */
export function reportUrl(
  analysisId: string,
  token: string | null,
  code?: string | null
): string | null {
  if (code) return `${reportBase}/r/${encodeURIComponent(code)}`
  if (!token) return null
  return `${reportBase}/relatorio/${analysisId}?token=${encodeURIComponent(token)}`
}

/** Teaser público da análise (mesma base do relatório, rota /analise). */
export function teaserUrl(analysisId: string): string {
  return `${reportBase}/analise/${analysisId}`
}

/** "7,2" — score com uma casa, vírgula pt-BR. Null vira "—". */
export function formatScore(score: number | null): string {
  if (score === null || Number.isNaN(score)) return '—'
  return score.toFixed(1).replace('.', ',')
}

/**
 * Link wa.me com a mensagem contextualizada da prospecção:
 * primeiro nome + domínio + nota + primeiro problema da análise leve.
 * Retorna null quando o WhatsApp do lead é inválido (ação fica oculta).
 */
export function whatsappLinkForLead(lead: {
  name: string
  whatsapp: string
  report_token?: string | null
  report_code?: string | null
  analyses: {
    id?: string
    domain: string
    score: number | null
    light_result: LightResultResumo | null
  } | null
}): string | null {
  const primeiroNome = firstNameOf(lead.name) ?? 'tudo bem'
  const dominio = lead.analyses?.domain ?? 'sua loja'
  const nota = formatScore(lead.analyses?.score ?? null)
  const problema = lead.analyses?.light_result?.free_problems?.[0]?.title

  const abertura = `Oi ${primeiroNome}! Aqui é da Vertix. Vi a análise da ${dominio} — nota ${nota}.`
  const corpo = problema
    ? `${abertura} O ponto que mais está custando venda é ${problema}.`
    : `${abertura} Tem alguns pontos que estão custando venda.`
  // O relatório completo é entregue aqui, pelo link assinado — não no site.
  const link = lead.analyses?.id
    ? reportUrl(lead.analyses.id, lead.report_token ?? null, lead.report_code ?? null)
    : null
  const mensagem = link
    ? `${corpo} Seu relatório completo está aqui: ${link} Posso te mostrar como resolver?`
    : `${corpo} Posso te mostrar como resolver?`

  return buildWhatsAppLink(lead.whatsapp, mensagem)
}
