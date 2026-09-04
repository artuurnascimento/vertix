import { callAppsProxy } from '../lojas/appsProxy'

/**
 * Cliente tipado das rotas do Vertix Scan na edge function apps-proxy —
 * a ferramenta pública de análise de lojas que funciona como braço de
 * captação de leads. O token de serviço (SCAN_SERVICE_TOKEN) vive só nos
 * secrets da function; aqui trafega apenas o JWT do usuário logado.
 */

/** GET /api/vertix/stats */
export interface ScanStats {
  analises_total: number
  analises_7d: number
  leads_total: number
  leads_7d: number
}

/** Item de GET /api/vertix/leads */
export interface ScanLead {
  id: string
  nome: string
  whatsapp: string
  loja_url: string
  dominio: string
  score: number
  status: string
  criado_em: string
  /** Link do relatório com token — presente quando o worker tem WEB_URL. */
  relatorio_url: string | null
}

export interface ScanLeadsResponse {
  total: number
  leads: ScanLead[]
}

/** Tamanho da página da tabela de leads (limit/offset do backend). */
export const SCAN_PAGE_SIZE = 50

export function fetchScanStats(): Promise<ScanStats> {
  return callAppsProxy<ScanStats>({
    app: 'scan',
    method: 'GET',
    path: '/api/vertix/stats',
  })
}

export function fetchScanLeads(offset: number): Promise<ScanLeadsResponse> {
  return callAppsProxy<ScanLeadsResponse>({
    app: 'scan',
    method: 'GET',
    path: `/api/vertix/leads?limit=${SCAN_PAGE_SIZE}&offset=${offset}`,
  })
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
