import { raioxSupabase } from '../leadsRaiox/raioxSupabase'
import { reportUrl } from '../leadsRaiox/raioxData'
import { intervaloDoPeriodo } from '../../lib/periodo'
import type { Intervalo, Periodo } from '../../lib/periodo'

/**
 * Dados do Vertix Scan lidos DIRETO do banco, com o client autenticado do
 * painel. As tabelas `analyses` e `leads` moram no mesmo projeto Supabase
 * (migração 20260905100000), então não é preciso passar pela edge function
 * apps-proxy nem manter SCAN_API_URL/SCAN_SERVICE_TOKEN.
 */

/** Métricas do topo da página. */
export interface ScanStats {
  /** Todo o histórico, sem filtro. */
  analises_total: number
  leads_total: number
  /** Dentro do período escolhido no filtro. */
  analises_periodo: number
  leads_periodo: number
}

/** Lead na tabela da página. */
export interface ScanLead {
  id: string
  nome: string
  whatsapp: string
  loja_url: string
  dominio: string
  score: number
  status: string
  criado_em: string
  /** Link do relatório — o que vai no WhatsApp do cliente. */
  relatorio_url: string | null
  /** Quando o cliente abriu o relatório; null = ainda não leu. */
  relatorio_aberto_em: string | null
  /** Id da análise, para reprocessar quando a profunda falha. */
  analysis_id: string | null
  /** Status da análise: 'failed' libera o botão de reprocessar. */
  analysis_status: string | null
}

export interface ScanLeadsResponse {
  total: number
  leads: ScanLead[]
}

/** Tamanho da página da tabela de leads. */
export const SCAN_PAGE_SIZE = 50

/** Conta linhas sem trazê-las (head + count exato). */
async function contar(tabela: string, intervalo?: Intervalo): Promise<number> {
  let q = raioxSupabase.from(tabela).select('id', { count: 'exact', head: true })
  if (intervalo) {
    q = q.gte('created_at', intervalo.desde)
    if (intervalo.ate) q = q.lt('created_at', intervalo.ate)
  }
  const { count, error } = await q
  if (error) throw new Error(error.message)
  return count ?? 0
}

export async function fetchScanStats(periodo: Periodo): Promise<ScanStats> {
  const intervalo = intervaloDoPeriodo(periodo)
  const [analises_total, analises_periodo, leads_total, leads_periodo] =
    await Promise.all([
      contar('analyses'),
      contar('analyses', intervalo),
      contar('leads'),
      contar('leads', intervalo),
    ])
  return { analises_total, leads_total, analises_periodo, leads_periodo }
}

interface LinhaLead {
  id: string
  name: string
  whatsapp: string
  status: string
  created_at: string
  report_token: string | null
  report_code: string | null
  relatorio_aberto_em: string | null
  analyses: {
    id: string
    url: string | null
    domain: string | null
    score: number | null
    status: string | null
  } | null
}

export async function fetchScanLeads(
  offset: number,
  periodo?: Periodo
): Promise<ScanLeadsResponse> {
  let q = raioxSupabase
    .from('leads')
    .select(
      'id, name, whatsapp, status, created_at, report_token, report_code, relatorio_aberto_em, analyses(id, url, domain, score, status)',
      { count: 'exact' }
    )
  if (periodo) {
    const intervalo = intervaloDoPeriodo(periodo)
    q = q.gte('created_at', intervalo.desde)
    if (intervalo.ate) q = q.lt('created_at', intervalo.ate)
  }
  const { data, count, error } = await q
    .order('created_at', { ascending: false })
    .range(offset, offset + SCAN_PAGE_SIZE - 1)
  if (error) throw new Error(error.message)

  const leads = ((data ?? []) as unknown as LinhaLead[]).map((l) => ({
    id: l.id,
    nome: l.name,
    whatsapp: l.whatsapp,
    loja_url: l.analyses?.url ?? '',
    dominio: l.analyses?.domain ?? '',
    score: l.analyses?.score ?? 0,
    status: l.status,
    criado_em: l.created_at,
    relatorio_url: l.analyses ? reportUrl(l.analyses.id, l.report_token, l.report_code) : null,
    relatorio_aberto_em: l.relatorio_aberto_em,
    analysis_id: l.analyses?.id ?? null,
    analysis_status: l.analyses?.status ?? null,
  }))
  return { total: count ?? leads.length, leads }
}

/**
 * Link wa.me com o número reduzido a dígitos (null quando não sobra nada);
 * `mensagem` opcional vai pré-preenchida no campo de texto.
 */
export function whatsappLink(numero: string, mensagem?: string): string | null {
  const digits = numero.replace(/\D/g, '')
  if (digits === '') return null
  const base = `https://wa.me/${digits}`
  return mensagem ? `${base}?text=${encodeURIComponent(mensagem)}` : base
}

/** Mensagem de follow-up do lead: cumprimento + link do relatório (quando houver). */
export function mensagemFollowUp(lead: {
  nome: string
  dominio: string | null
  relatorio_url: string | null
}): string {
  const primeiroNome = lead.nome.trim().split(/\s+/)[0] || lead.nome
  const loja = lead.dominio ? ` da ${lead.dominio}` : ''
  if (lead.relatorio_url) {
    return `Oi, ${primeiroNome}! Aqui é a Vertix. Seu relatório do Vertix Scan${loja} está pronto: ${lead.relatorio_url} — se quiser, a gente conversa sobre como resolver os pontos.`
  }
  return `Oi, ${primeiroNome}! Aqui é a Vertix, sobre a análise do Vertix Scan${loja}. Podemos conversar sobre o relatório?`
}

/** Pill de status do lead — mapa dos conhecidos + fallback neutro. */
export const SCAN_STATUS_META: Record<string, { label: string; className: string }> = {
  novo: {
    label: 'Novo',
    className: 'border-accent/30 bg-accent/10 text-accent',
  },
  contatado: {
    label: 'Contatado',
    className: 'border-amber-400/25 bg-amber-400/10 text-amber-300',
  },
  negociando: {
    label: 'Negociando',
    className: 'border-sky-400/25 bg-sky-400/10 text-sky-300',
  },
  fechado: {
    label: 'Fechado',
    className: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300',
  },
  perdido: {
    label: 'Perdido',
    className: 'border-red-400/25 bg-red-400/10 text-red-300',
  },
}

export function scanStatusMeta(status: string): { label: string; className: string } {
  return (
    SCAN_STATUS_META[status] ?? {
      label: status,
      className: 'border-white/10 bg-white/5 text-muted',
    }
  )
}
