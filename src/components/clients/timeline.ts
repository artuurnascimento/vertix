/**
 * Linha do tempo do cliente (view `client_timeline`, migração
 * client_timeline): como cada tipo de evento é apresentado e como a lista é
 * agrupada. Puro e testado; a busca fica em timelineData.ts (este é timeline.ts).
 */

export type TipoDeEvento =
  | 'analise'
  | 'lead'
  | 'relatorio_aberto'
  | 'reuniao'
  | 'compra_plano'
  | 'pedido'
  | 'correcao_contratada'
  | 'correcao_concluida'
  | 'projeto'
  | 'perdido'
  | 'proposta_enviada'
  | 'proposta_aceita'
  | 'proposta_recusada'
  | 'contrato'
  | 'recebivel_pago'
  | 'recebivel_vencido'
  | 'assinatura'
  | 'ticket'
  | 'ticket_resolvido'
  | 'nps'
  | 'atividade'

/** Filtros da aba: cada tipo pertence a um grupo. */
export type GrupoDeEvento = 'captacao' | 'venda' | 'dinheiro' | 'entrega' | 'relacionamento'

/** Cor semântica do ponto na linha. */
export type TomDoEvento = 'neutro' | 'positivo' | 'alerta' | 'negativo'

export interface EventoDaLinha {
  id: string
  quando: string
  tipo: TipoDeEvento | string
  titulo: string
  detalhe: string | null
  link: string | null
}

export interface MetaDoEvento {
  grupo: GrupoDeEvento
  tom: TomDoEvento
}

export const GRUPOS: { valor: GrupoDeEvento | 'tudo'; rotulo: string }[] = [
  { valor: 'tudo', rotulo: 'Tudo' },
  { valor: 'captacao', rotulo: 'Captação' },
  { valor: 'venda', rotulo: 'Venda' },
  { valor: 'dinheiro', rotulo: 'Dinheiro' },
  { valor: 'entrega', rotulo: 'Entrega' },
  { valor: 'relacionamento', rotulo: 'Relacionamento' },
]

export const META_DO_EVENTO: Record<TipoDeEvento, MetaDoEvento> = {
  analise: { grupo: 'captacao', tom: 'neutro' },
  lead: { grupo: 'captacao', tom: 'neutro' },
  relatorio_aberto: { grupo: 'captacao', tom: 'neutro' },
  reuniao: { grupo: 'relacionamento', tom: 'positivo' },
  compra_plano: { grupo: 'venda', tom: 'positivo' },
  pedido: { grupo: 'venda', tom: 'positivo' },
  correcao_contratada: { grupo: 'venda', tom: 'positivo' },
  correcao_concluida: { grupo: 'entrega', tom: 'positivo' },
  projeto: { grupo: 'entrega', tom: 'neutro' },
  perdido: { grupo: 'venda', tom: 'negativo' },
  proposta_enviada: { grupo: 'venda', tom: 'neutro' },
  proposta_aceita: { grupo: 'venda', tom: 'positivo' },
  proposta_recusada: { grupo: 'venda', tom: 'negativo' },
  contrato: { grupo: 'venda', tom: 'positivo' },
  recebivel_pago: { grupo: 'dinheiro', tom: 'positivo' },
  recebivel_vencido: { grupo: 'dinheiro', tom: 'alerta' },
  assinatura: { grupo: 'dinheiro', tom: 'positivo' },
  ticket: { grupo: 'relacionamento', tom: 'alerta' },
  ticket_resolvido: { grupo: 'relacionamento', tom: 'positivo' },
  nps: { grupo: 'relacionamento', tom: 'neutro' },
  atividade: { grupo: 'entrega', tom: 'neutro' },
}

const META_DESCONHECIDA: MetaDoEvento = { grupo: 'entrega', tom: 'neutro' }

/** Tipo que a view ganhou depois desta tela continua aparecendo, sem cor. */
export function metaDoEvento(tipo: string): MetaDoEvento {
  return (META_DO_EVENTO as Record<string, MetaDoEvento>)[tipo] ?? META_DESCONHECIDA
}

/** Linha da view → evento; o que não tem data ou título válido cai fora. */
export function normalizarEventos(linhas: unknown): EventoDaLinha[] {
  if (!Array.isArray(linhas)) return []
  const saida: EventoDaLinha[] = []
  for (const bruta of linhas) {
    const d = bruta as Record<string, unknown> | null
    if (!d || typeof d !== 'object') continue
    if (typeof d.quando !== 'string' || Number.isNaN(new Date(d.quando).getTime())) continue
    if (typeof d.titulo !== 'string' || !d.titulo.trim()) continue
    if (typeof d.tipo !== 'string') continue
    const ref = typeof d.ref_id === 'string' ? d.ref_id : ''
    saida.push({
      id: `${d.tipo}:${ref || d.quando}`,
      quando: d.quando,
      tipo: d.tipo,
      titulo: d.titulo.trim(),
      detalhe: typeof d.detalhe === 'string' && d.detalhe.trim() ? d.detalhe.trim() : null,
      link: typeof d.link === 'string' && d.link.startsWith('/') ? d.link : null,
    })
  }
  return saida
}

export function filtrarPorGrupo(
  eventos: readonly EventoDaLinha[],
  grupo: GrupoDeEvento | 'tudo'
): EventoDaLinha[] {
  if (grupo === 'tudo') return [...eventos]
  return eventos.filter((e) => metaDoEvento(e.tipo).grupo === grupo)
}

export interface MesDaLinha {
  /** 'YYYY-MM', chave estável para o React. */
  chave: string
  rotulo: string
  eventos: EventoDaLinha[]
}

const MES_FORMATO = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' })

/** Mais recente primeiro, agrupado por mês — o mês é o marco que a pessoa lembra. */
export function agruparPorMes(eventos: readonly EventoDaLinha[]): MesDaLinha[] {
  const ordenados = [...eventos].sort((a, b) => b.quando.localeCompare(a.quando))
  const meses: MesDaLinha[] = []
  for (const evento of ordenados) {
    const data = new Date(evento.quando)
    const chave = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`
    const ultimo = meses[meses.length - 1]
    if (ultimo && ultimo.chave === chave) {
      ultimo.eventos.push(evento)
    } else {
      const rotulo = MES_FORMATO.format(data)
      meses.push({ chave, rotulo: rotulo.charAt(0).toUpperCase() + rotulo.slice(1), eventos: [evento] })
    }
  }
  return meses
}

const DATA_FORMATO = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' })
const HORA_FORMATO = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' })

/** "12 set" e "14:30" — a hora só quando há uma (vencimento é só dia). */
export function formatarQuando(iso: string): { dia: string; hora: string | null } {
  const data = new Date(iso)
  const meiaNoite = data.getHours() === 0 && data.getMinutes() === 0
  // "14 de ago." não cabe na coluna estreita da linha: fica "14 ago".
  const dia = DATA_FORMATO.format(data).replace('.', '').replace(' de ', ' ')
  return { dia, hora: meiaNoite ? null : HORA_FORMATO.format(data) }
}
