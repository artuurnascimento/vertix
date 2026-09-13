import type { ItemDaFila } from '../comercial/fila'
import { formatarReais, sinaisDoScan } from '../comercial/fila'

/**
 * O ranking único do dashboard (jornada, fase 3).
 *
 * Antes havia três listas — prioridades (recebível atrasado, proposta sem
 * resposta, briefing parado), nudges e a fila comercial — e um cliente com
 * pagamento atrasado, projeto parado e ticket aberto aparecia três vezes.
 * Aqui cada fonte vira um MOTIVO, os motivos são agrupados por cliente e o
 * cartão é ordenado por prioridade = urgência × valor em jogo × intenção —
 * a mesma régua da fila comercial (comercial/fila.ts).
 *
 * Puro: recebe as linhas já carregadas e `hoje` ('AAAA-MM-DD'); quem busca
 * é PrioritiesWorkspace.tsx.
 */

export type TipoDeMotivo =
  | 'recebivel_vencido'
  | 'proposta_sem_resposta'
  | 'briefing_pendente'
  | 'acao_vencida'
  | 'sinal_scan'
  | 'nudge'

export interface MotivoDePrioridade {
  chave: string
  tipo: TipoDeMotivo
  /** Uma linha, com o número que importa: "R$ 3.200 vencidos há 4 dias". */
  texto: string
  /** Dias de atraso (0 = vence hoje / sem atraso). */
  urgencia: number
  /** R$ em jogo. */
  valor: number
  /** 1 = neutro; sobe com sinais de intenção do Scan. */
  intencao: number
  link: string
  /** Só nos motivos que vieram de um nudge — é o que "Resolver" fecha. */
  nudgeId?: string
}

export interface CartaoDePrioridade {
  chave: string
  clientId: string | null
  /** Projeto para "agendar retorno" (grava proxima_acao_em). */
  projectId: string | null
  nome: string
  motivos: MotivoDePrioridade[]
  prioridade: number
  valor: number
  /** Motivo principal + quantos mais. */
  porque: string
  link: string
}

export interface RecebivelParaRanking {
  id: string
  descricao: string
  valor: number
  vencimento: string
  status: string
  project_id: string | null
  client_id: string | null
}

export interface PropostaParaRanking {
  id: string
  titulo: string
  valor_total: number
  status: string
  sent_at: string | null
  created_at: string
  project_id: string
}

export interface BriefingParaRanking {
  id: string
  status: string
  project_id: string
}

export interface NudgeParaRanking {
  id: string
  tipo: string
  severidade: string
  titulo: string
  descricao: string | null
  link: string | null
  project_id: string | null
  client_id: string | null
  created_at: string
}

export interface ProjetoParaRanking {
  id: string
  nome: string
  client_id: string | null
  cliente: string | null
}

export interface EntradasDoRanking {
  hoje: string
  recebiveis: readonly RecebivelParaRanking[]
  propostas: readonly PropostaParaRanking[]
  briefings: readonly BriefingParaRanking[]
  nudges: readonly NudgeParaRanking[]
  fila: readonly ItemDaFila[]
  /** Índice projeto → cliente, para o que só chega com project_id. */
  projetos: readonly ProjetoParaRanking[]
}

const MS_POR_DIA = 24 * 60 * 60 * 1000
/** Atraso além disto não deixa o cartão mais urgente — só vira "há muito tempo". */
const TETO_DE_URGENCIA_DIAS = 60
/** Nudges que só repetem um fato já lido de outra fonte: não viram motivo próprio. */
const NUDGES_REDUNDANTES = new Set(['pagamento_atrasado', 'proposta_sem_resposta', 'briefing_parado'])

/** Dias inteiros de `de` até `ate` ('AAAA-MM-DD'); negativo = futuro. */
export function diasAte(de: string, ate: string): number {
  return Math.round((Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / MS_POR_DIA)
}

function diasDesde(iso: string, hoje: string): number {
  return Math.max(0, diasAte(iso.slice(0, 10), hoje))
}

function ha(dias: number): string {
  if (dias <= 0) return 'hoje'
  return `há ${dias} dia${dias > 1 ? 's' : ''}`
}

function pesoValor(valor: number): number {
  return 1 + Math.log10(1 + Math.max(0, valor) / 100)
}

function pontuacao(m: MotivoDePrioridade): number {
  const urgencia = 1 + Math.min(m.urgencia, TETO_DE_URGENCIA_DIAS) / 5
  return urgencia * pesoValor(m.valor) * m.intencao
}

/** Severidade do nudge no lugar da intenção: ele não traz valor em jogo, só o quanto grita. */
const PESO_DO_NUDGE: Record<string, number> = { urgente: 2, atencao: 1, info: 0.5 }

interface MotivoComDono extends MotivoDePrioridade {
  clientId: string | null
  projectId: string | null
  nome: string | null
}

function motivosDasEntradas(e: EntradasDoRanking): MotivoComDono[] {
  const projeto = new Map(e.projetos.map((p) => [p.id, p] as const))
  const donoDoProjeto = (projectId: string | null) => {
    const p = projectId ? projeto.get(projectId) : undefined
    return { clientId: p?.client_id ?? null, projectId: projectId ?? null, nome: p?.cliente ?? p?.nome ?? null }
  }
  const motivos: MotivoComDono[] = []

  for (const r of e.recebiveis) {
    if (r.status !== 'pendente') continue
    const atraso = diasAte(r.vencimento, e.hoje)
    if (atraso <= 0) continue
    const dono = donoDoProjeto(r.project_id)
    motivos.push({
      ...dono,
      clientId: r.client_id ?? dono.clientId,
      chave: `recebivel:${r.id}`,
      tipo: 'recebivel_vencido',
      texto: `${formatarReais(r.valor)} vencidos ${ha(atraso)} — ${r.descricao}`,
      urgencia: atraso,
      valor: r.valor,
      intencao: 1,
      link: `/admin/financeiro?abrir=${r.id}`,
    })
  }

  for (const p of e.propostas) {
    if (p.status !== 'enviada') continue
    const dias = diasDesde(p.sent_at ?? p.created_at, e.hoje)
    motivos.push({
      ...donoDoProjeto(p.project_id),
      chave: `proposta:${p.id}`,
      tipo: 'proposta_sem_resposta',
      texto: `proposta de ${formatarReais(p.valor_total)} sem resposta ${ha(dias)}`,
      urgencia: dias,
      valor: p.valor_total,
      intencao: 1,
      link: `/admin/propostas?abrir=${p.id}`,
    })
  }

  for (const b of e.briefings) {
    if (b.status !== 'enviado') continue
    motivos.push({
      ...donoDoProjeto(b.project_id),
      chave: `briefing:${b.id}`,
      tipo: 'briefing_pendente',
      texto: 'briefing enviado e ainda não preenchido',
      urgencia: 0,
      valor: 0,
      intencao: 1,
      link: `/admin/projetos/${b.project_id}`,
    })
  }

  for (const item of e.fila) {
    const sinais = sinaisDoScan(item)
    const valor = item.valor_estimado ?? 0
    const intencao = 1 + sinais.length * 0.75 + (item.comprou_plano ? 1 : 0)
    const dono = { clientId: item.client_id, projectId: item.project_id, nome: item.cliente }
    if (item.proxima_acao_em) {
      const atraso = diasAte(item.proxima_acao_em, e.hoje)
      if (atraso >= 0) {
        motivos.push({
          ...dono,
          chave: `acao:${item.project_id}`,
          tipo: 'acao_vencida',
          texto:
            atraso > 0
              ? `${item.proxima_acao ?? 'ação combinada'} — venceu ${ha(atraso)}`
              : `${item.proxima_acao ?? 'ação combinada'} — para hoje`,
          urgencia: atraso,
          valor,
          intencao,
          link: `/admin/projetos/${item.project_id}`,
        })
      }
    } else if (sinais.length > 0) {
      motivos.push({
        ...dono,
        chave: `sinal:${item.project_id}`,
        tipo: 'sinal_scan',
        texto: `${sinais.join(', ')} — sem próximo passo`,
        urgencia: 0,
        valor,
        intencao,
        link: `/admin/projetos/${item.project_id}`,
      })
    }
  }

  for (const n of e.nudges) {
    if (NUDGES_REDUNDANTES.has(n.tipo)) continue
    const dono = donoDoProjeto(n.project_id)
    motivos.push({
      ...dono,
      clientId: n.client_id ?? dono.clientId,
      chave: `nudge:${n.id}`,
      tipo: 'nudge',
      texto: n.descricao ? `${n.titulo} — ${n.descricao}` : n.titulo,
      urgencia: diasDesde(n.created_at, e.hoje),
      valor: 0,
      intencao: PESO_DO_NUDGE[n.severidade] ?? 1,
      link: n.link ?? (n.project_id ? `/admin/projetos/${n.project_id}` : '/admin/clientes'),
      nudgeId: n.id,
    })
  }

  return motivos
}

/**
 * Um cartão por cliente (ou por projeto, quando o dado não sabe o cliente),
 * do mais urgente para o menos. O nudge de "pagamento atrasado" e o
 * recebível vencido do mesmo cliente são UM motivo, não dois.
 */
export function montarPrioridades(entradas: EntradasDoRanking): CartaoDePrioridade[] {
  const grupos = new Map<string, CartaoDePrioridade>()
  for (const m of motivosDasEntradas(entradas)) {
    const chave = m.clientId ? `cliente:${m.clientId}` : m.projectId ? `projeto:${m.projectId}` : m.chave
    const { clientId, projectId, nome, ...motivo } = m
    const existente = grupos.get(chave)
    if (existente) {
      if (existente.motivos.some((x) => x.chave === motivo.chave)) continue
      existente.motivos.push(motivo)
      if (!existente.projectId && projectId) existente.projectId = projectId
      if (existente.nome === 'Sem cliente' && nome) existente.nome = nome
    } else {
      grupos.set(chave, {
        chave,
        clientId,
        projectId,
        nome: nome ?? 'Sem cliente',
        motivos: [motivo],
        prioridade: 0,
        valor: 0,
        porque: '',
        link: clientId ? `/admin/clientes/${clientId}` : motivo.link,
      })
    }
  }

  const cartoes = [...grupos.values()].map((c) => {
    const motivos = [...c.motivos].sort((a, b) => pontuacao(b) - pontuacao(a))
    const prioridade = motivos.reduce((soma, m) => soma + pontuacao(m), 0)
    const valor = motivos.reduce((soma, m) => soma + m.valor, 0)
    const porque = motivos.length > 1 ? `${motivos[0].texto} · +${motivos.length - 1}` : motivos[0].texto
    return { ...c, motivos, prioridade, valor, porque }
  })
  return cartoes.sort((a, b) => b.prioridade - a.prioridade || a.nome.localeCompare(b.nome, 'pt-BR'))
}
