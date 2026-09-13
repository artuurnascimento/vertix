/**
 * A fila comercial: o que está combinado (próxima ação com data), o que está
 * sem próximo passo, e os sinais do Scan que pedem contato — ordenados por
 * urgência × valor × intenção. Puro, para os testes cobrirem a ordem.
 */

export interface ItemDaFila {
  project_id: string
  projeto: string
  status: string
  client_id: string
  cliente: string
  empresa: string | null
  responsavel_id: string | null
  responsavel: string | null
  proxima_acao: string | null
  /** 'AAAA-MM-DD'. */
  proxima_acao_em: string | null
  valor_estimado: number | null
  previsao_fechamento: string | null
  updated_at: string
  comprou_plano: boolean
  pediu_ajuda: string | null
  reuniao_em: string | null
  relatorio_aberto_em: string | null
  tickets_abertos: number
}

export type MotivoDePerda = 'preco' | 'timing' | 'sem_resposta' | 'concorrente' | 'sem_fit' | 'outro'

export const MOTIVOS_DE_PERDA: readonly { valor: MotivoDePerda; label: string }[] = [
  { valor: 'preco', label: 'Preço' },
  { valor: 'timing', label: 'Não era a hora' },
  { valor: 'sem_resposta', label: 'Parou de responder' },
  { valor: 'concorrente', label: 'Fechou com outro' },
  { valor: 'sem_fit', label: 'Não era o cliente certo' },
  { valor: 'outro', label: 'Outro' },
]

/** Etapas em que o projeto ainda é uma oportunidade (venda não fechou). */
export const ETAPAS_DE_VENDA = new Set(['lead', 'briefing_enviado', 'briefing_recebido'])

export type Secao = 'vencidas' | 'hoje' | 'sinais' | 'sem_passo'

export interface ItemOrdenado extends ItemDaFila {
  secao: Secao
  /** Dias de atraso da próxima ação (0 = hoje; negativo = futuro). */
  atrasoDias: number | null
  /** Por que este item está aqui, em uma linha. */
  motivo: string
  prioridade: number
}

const DIA_MS = 86_400_000

function diasEntre(deIso: string, hojeIso: string): number {
  return Math.round((Date.parse(hojeIso) - Date.parse(deIso)) / DIA_MS)
}

export function formatarReais(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

/** Os sinais do Scan que valem contato, na ordem em que pesam. */
export function sinaisDoScan(item: ItemDaFila): string[] {
  const sinais: string[] = []
  if (item.comprou_plano) sinais.push('comprou o plano')
  if (item.pediu_ajuda) sinais.push(`pediu ajuda: "${item.pediu_ajuda.slice(0, 60)}"`)
  if (item.reuniao_em) sinais.push('marcou reunião')
  if (item.tickets_abertos > 0) sinais.push(`${item.tickets_abertos} ticket${item.tickets_abertos > 1 ? 's' : ''} aberto${item.tickets_abertos > 1 ? 's' : ''}`)
  if (!item.comprou_plano && item.relatorio_aberto_em) sinais.push('abriu o relatório')
  return sinais
}

/**
 * Classifica e ordena. `hoje` é 'AAAA-MM-DD' (o dia local de quem olha).
 * Prioridade = urgência (atraso) × valor em jogo × intenção (sinais).
 */
export function ordenarFila(itens: readonly ItemDaFila[], hoje: string): ItemOrdenado[] {
  const ordenados = itens.flatMap<ItemOrdenado>((item) => {
    const sinais = sinaisDoScan(item)
    const valor = item.valor_estimado ?? 0
    const pesoValor = 1 + Math.log10(1 + valor / 100)
    const pesoIntencao = 1 + sinais.length * 0.75 + (item.comprou_plano ? 1 : 0)

    if (item.proxima_acao_em) {
      const atraso = diasEntre(item.proxima_acao_em, hoje)
      if (atraso < 0) return [] // combinado para o futuro: ainda não é "hoje"
      const secao: Secao = atraso > 0 ? 'vencidas' : 'hoje'
      const motivo =
        atraso > 0
          ? `${item.proxima_acao ?? 'Ação combinada'} — venceu há ${atraso} dia${atraso > 1 ? 's' : ''}`
          : `${item.proxima_acao ?? 'Ação combinada'} — para hoje`
      return [{ ...item, secao, atrasoDias: atraso, motivo, prioridade: (2 + atraso) * pesoValor * pesoIntencao }]
    }

    if (sinais.length > 0) {
      return [{ ...item, secao: 'sinais', atrasoDias: null, motivo: sinais.join(' · '), prioridade: 1.5 * pesoValor * pesoIntencao }]
    }

    if (ETAPAS_DE_VENDA.has(item.status)) {
      const parado = diasEntre(item.updated_at.slice(0, 10), hoje)
      return [{
        ...item,
        secao: 'sem_passo',
        atrasoDias: null,
        motivo: parado > 0 ? `sem próximo passo há ${parado} dia${parado > 1 ? 's' : ''}` : 'sem próximo passo',
        prioridade: (0.5 + Math.min(parado, 30) / 30) * pesoValor,
      }]
    }

    return []
  })
  // Seção primeiro (o combinado vence o sugerido), prioridade dentro dela.
  const ordem: Record<Secao, number> = { vencidas: 0, hoje: 1, sinais: 2, sem_passo: 3 }
  return ordenados.sort((a, b) => ordem[a.secao] - ordem[b.secao] || b.prioridade - a.prioridade)
}

/** Data local 'AAAA-MM-DD' somando dias — para os botões "adiar". */
export function somarDias(hoje: string, dias: number): string {
  const [a, m, d] = hoje.split('-').map(Number)
  const data = new Date(a, m - 1, d + dias)
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`
}

export function hojeLocal(agora: Date = new Date()): string {
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-${String(agora.getDate()).padStart(2, '0')}`
}
