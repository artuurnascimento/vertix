import type { PessoaNoFunil } from './funil'

/**
 * Funil com origem (jornada, fase 4): as pessoas de `funil_pessoas`
 * cruzadas por campanha, com receita, custo de aquisição e tempo até a
 * contratação. Responde "qual campanha traz gente que compra?" e "quanto
 * custa um lead que vira cliente?" — o que decide onde pôr o dinheiro de
 * tráfego. Puro; a busca fica em useReportsData.ts.
 */

export interface PessoaComReceita extends PessoaNoFunil {
  /** numeric do Postgres chega como string pelo PostgREST. */
  receita_plano: number | string | null
  receita_contratos: number | string | null
}

export interface SessaoResumida {
  utm_campaign: string | null
  utm_source: string | null
}

export interface LinhaDaOrigem {
  chave: string
  campanha: string
  origem: string
  sessoes: number
  leads: number
  relatorios: number
  compras: number
  reunioes: number
  contratos: number
  receita: number
  /** receita ÷ leads; null sem leads. */
  receitaPorLead: number | null
  /** compras ÷ leads (0–1); null sem leads. */
  conversaoCompra: number | null
  /** contratos ÷ leads (0–1); null sem leads. */
  conversaoContrato: number | null
}

export interface TempoAteContratacao {
  n: number
  medianaDias: number | null
  mediaDias: number | null
}

export interface ResumoDaOrigem {
  leads: number
  compras: number
  contratos: number
  receita: number
  gasto: number
  receitaPorLead: number | null
  /** gasto ÷ compras (planos pagos); null sem gasto ou sem compras. */
  cac: number | null
  /** gasto ÷ contratos (implementação); null sem gasto ou sem contratos. */
  cacContrato: number | null
  /** receita ÷ gasto; null sem gasto. */
  retorno: number | null
}

export const SEM_CAMPANHA = 'direto'
const MS_POR_DIA = 24 * 60 * 60 * 1000

function numero(valor: number | string | null | undefined): number {
  const n = typeof valor === 'string' ? Number(valor) : (valor ?? 0)
  return Number.isFinite(n) ? n : 0
}

export function receitaDaPessoa(p: PessoaComReceita): number {
  return numero(p.receita_plano) + numero(p.receita_contratos)
}

/** Campanha do lead; sem campanha, a origem (utm_source/referrer); sem nada, "direto". */
export function chaveDaOrigem(campanha: string | null | undefined, origem: string | null | undefined): string {
  return campanha?.trim() || origem?.trim() || SEM_CAMPANHA
}

function razao(parte: number, todo: number): number | null {
  return todo > 0 ? parte / todo : null
}

/**
 * Uma linha por campanha, com as pessoas de cada etapa e a receita. Sessões
 * (utm_sessions) entram só para dar a taxa sessão → lead; campanhas com
 * sessão e sem lead aparecem com zero, porque é isso que se quer ver.
 */
export function porCampanha(
  pessoas: readonly PessoaComReceita[],
  sessoes: readonly SessaoResumida[] = []
): LinhaDaOrigem[] {
  const linhas = new Map<string, LinhaDaOrigem>()
  const linha = (chave: string, origem: string): LinhaDaOrigem => {
    const atual = linhas.get(chave)
    if (atual) return atual
    const nova: LinhaDaOrigem = {
      chave,
      campanha: chave,
      origem,
      sessoes: 0,
      leads: 0,
      relatorios: 0,
      compras: 0,
      reunioes: 0,
      contratos: 0,
      receita: 0,
      receitaPorLead: null,
      conversaoCompra: null,
      conversaoContrato: null,
    }
    linhas.set(chave, nova)
    return nova
  }

  for (const s of sessoes) {
    linha(chaveDaOrigem(s.utm_campaign, s.utm_source), s.utm_source?.trim() || SEM_CAMPANHA).sessoes += 1
  }
  for (const p of pessoas) {
    if (!p.lead_em) continue // comprador sem lead (checkout direto) não tem origem para atribuir
    const l = linha(chaveDaOrigem(p.campanha, p.origem), p.origem?.trim() || SEM_CAMPANHA)
    l.leads += 1
    if (p.relatorio_em) l.relatorios += 1
    if (p.compra_em) l.compras += 1
    if (p.reuniao_em) l.reunioes += 1
    if (p.contratado_em) l.contratos += 1
    l.receita += receitaDaPessoa(p)
  }

  return [...linhas.values()]
    .map((l) => ({
      ...l,
      receita: Math.round(l.receita * 100) / 100,
      receitaPorLead: razao(l.receita, l.leads),
      conversaoCompra: razao(l.compras, l.leads),
      conversaoContrato: razao(l.contratos, l.leads),
    }))
    .sort(
      (a, b) =>
        b.receita - a.receita ||
        b.leads - a.leads ||
        b.sessoes - a.sessoes ||
        a.campanha.localeCompare(b.campanha, 'pt-BR')
    )
}

/** Dias entre o primeiro lead e a proposta aceita, para quem contratou. */
export function tempoAteContratacao(pessoas: readonly PessoaComReceita[]): TempoAteContratacao {
  const dias = pessoas
    .filter((p) => p.lead_em && p.contratado_em)
    .map((p) => (Date.parse(p.contratado_em as string) - Date.parse(p.lead_em as string)) / MS_POR_DIA)
    .filter((d) => Number.isFinite(d) && d >= 0)
    .sort((a, b) => a - b)
  if (dias.length === 0) return { n: 0, medianaDias: null, mediaDias: null }
  const meio = Math.floor(dias.length / 2)
  const mediana = dias.length % 2 === 1 ? dias[meio] : (dias[meio - 1] + dias[meio]) / 2
  const media = dias.reduce((s, d) => s + d, 0) / dias.length
  return { n: dias.length, medianaDias: Math.round(mediana), mediaDias: Math.round(media) }
}

/** Custo de aquisição: gasto ÷ conversões; null quando não há gasto ou conversão. */
export function cac(gasto: number, conversoes: number): number | null {
  if (!(gasto > 0) || !(conversoes > 0)) return null
  return gasto / conversoes
}

export function resumoDaOrigem(pessoas: readonly PessoaComReceita[], gasto: number): ResumoDaOrigem {
  const comLead = pessoas.filter((p) => p.lead_em)
  const leads = comLead.length
  const compras = comLead.filter((p) => p.compra_em).length
  const contratos = comLead.filter((p) => p.contratado_em).length
  const receita = Math.round(comLead.reduce((s, p) => s + receitaDaPessoa(p), 0) * 100) / 100
  return {
    leads,
    compras,
    contratos,
    receita,
    gasto,
    receitaPorLead: razao(receita, leads),
    cac: cac(gasto, compras),
    cacContrato: cac(gasto, contratos),
    retorno: gasto > 0 ? receita / gasto : null,
  }
}
