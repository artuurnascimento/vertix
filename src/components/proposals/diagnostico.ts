import type { ProposalItem } from '../../lib/commercial'

/**
 * Montar proposta a partir do diagnóstico do Scan.
 *
 * Os problemas vêm de `analyses.deep_result.problems` (ou, sem análise
 * profunda, dos `free_problems` do `light_result`). Cada problema medido traz
 * o id da regra que o achou; a tabela `esforco_por_regra` (Configurações)
 * diz quantas horas a Vertix leva em cada uma. Item da proposta =
 * quantidade (horas) × valor unitário (valor_hora): o cliente vê de onde
 * saiu o número, e a equipe ajusta antes de enviar.
 *
 * Tudo aqui é puro e testado; quem busca no banco é diagnosticoData.ts.
 */

export type ImpactoDoProblema = 'alto' | 'medio' | 'baixo'

export interface ProblemaDoDiagnostico {
  title: string
  why?: string
  category?: string
  impact?: ImpactoDoProblema
  /** Id da regra (worker, lib/rules.ts). Ausente nos visuais e em análises antigas. */
  regra?: string
}

export interface EsforcoDaRegra {
  regra: string
  titulo: string
  horas: number
  ativo: boolean
}

export interface ItensDoDiagnostico {
  itens: ProposalItem[]
  /** Problemas que ficaram de fora: regra desativada, sem horas ou sem título. */
  pulados: number
  horas: number
}

const ORDEM_DO_IMPACTO: Record<ImpactoDoProblema, number> = { alto: 0, medio: 1, baixo: 2 }
/** Problema sem impacto conhecido vai depois de 'baixo'. */
const ORDEM_SEM_IMPACTO = 3

export const CATEGORIAS_DO_SCAN: Record<string, string> = {
  velocidade: 'Velocidade',
  identidade: 'Identidade',
  pagina_produto: 'Página de produto',
  confianca: 'Confiança',
  seo: 'SEO',
}

/** Chave de esforço do problema: a regra; sem regra, o fallback pelo impacto. */
export function chaveDoEsforco(problema: ProblemaDoDiagnostico): string {
  if (problema.regra) return problema.regra
  return `impacto_${problema.impact ?? 'medio'}`
}

/**
 * Horas da tabela para o problema. Regra que não está na tabela (o worker
 * ganhou uma regra nova antes de a tabela ser atualizada) cai no fallback do
 * impacto. null = não entra na proposta (desativada ou zero horas).
 */
export function horasDoProblema(
  problema: ProblemaDoDiagnostico,
  esforcos: ReadonlyMap<string, EsforcoDaRegra>
): number | null {
  const linha = esforcos.get(chaveDoEsforco(problema)) ?? esforcos.get(`impacto_${problema.impact ?? 'medio'}`)
  if (!linha || !linha.ativo || !(linha.horas > 0)) return null
  return linha.horas
}

/** "Velocidade · Imagens pesadas na home" — a categoria dá contexto na proposta. */
export function descricaoDoItem(problema: ProblemaDoDiagnostico): string {
  const titulo = problema.title.trim()
  const categoria = problema.category ? CATEGORIAS_DO_SCAN[problema.category] : undefined
  return categoria ? `${categoria} · ${titulo}` : titulo
}

export function ordenarPorImpacto(problemas: readonly ProblemaDoDiagnostico[]): ProblemaDoDiagnostico[] {
  return [...problemas].sort((a, b) => {
    const pa = a.impact ? ORDEM_DO_IMPACTO[a.impact] : ORDEM_SEM_IMPACTO
    const pb = b.impact ? ORDEM_DO_IMPACTO[b.impact] : ORDEM_SEM_IMPACTO
    return pa - pb
  })
}

/**
 * Um item por problema, em ordem de impacto (a proposta conta a mesma
 * história que o plano: o que devolve mais venda vem primeiro).
 */
export function itensDoDiagnostico(
  problemas: readonly ProblemaDoDiagnostico[],
  esforcos: readonly EsforcoDaRegra[],
  valorHora: number
): ItensDoDiagnostico {
  const mapa = new Map(esforcos.map((e) => [e.regra, e] as const))
  const itens: ProposalItem[] = []
  let pulados = 0
  let horas = 0
  for (const problema of ordenarPorImpacto(problemas)) {
    const h = problema.title.trim() ? horasDoProblema(problema, mapa) : null
    if (h === null) {
      pulados += 1
      continue
    }
    horas += h
    itens.push({ descricao: descricaoDoItem(problema), quantidade: h, valor_unitario: valorHora })
  }
  return { itens, pulados, horas: Math.round(horas * 10) / 10 }
}

export function tituloDaProposta(dominio: string | null | undefined): string {
  const limpo = (dominio ?? '').trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '')
  return limpo ? `Correção da loja ${limpo}` : 'Correção da loja'
}

/** Só sobrevive o que tem título; impacto e regra fora do vocabulário viram ausentes. */
export function normalizarProblemas(valor: unknown): ProblemaDoDiagnostico[] {
  if (!Array.isArray(valor)) return []
  const saida: ProblemaDoDiagnostico[] = []
  for (const bruto of valor) {
    const d = bruto as Record<string, unknown> | null
    if (!d || typeof d !== 'object' || typeof d.title !== 'string' || !d.title.trim()) continue
    const impact = d.impact === 'alto' || d.impact === 'medio' || d.impact === 'baixo' ? d.impact : undefined
    saida.push({
      title: d.title.trim(),
      why: typeof d.why === 'string' ? d.why : undefined,
      category: typeof d.category === 'string' ? d.category : undefined,
      impact,
      regra: typeof d.regra === 'string' && d.regra.trim() ? d.regra.trim() : undefined,
    })
  }
  return saida
}
