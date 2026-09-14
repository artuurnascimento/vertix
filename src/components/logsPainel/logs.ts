import type { Json, Tables } from '../../lib/database.types'

/**
 * A página Logs lê `logs_sistema` — a trilha única (ver migração
 * logs_sistema). Aqui ficam só as regras puras: filtro, agrupamento,
 * resumo, mescla do Realtime e a leitura dos filtros da URL. Sem React,
 * sem Supabase — tudo testável em memória.
 */

export type LinhaDeLog = Tables<'logs_sistema'>
export type Nivel = 'debug' | 'info' | 'aviso' | 'erro' | 'fatal'
export type Origem = 'navegador' | 'vercel' | 'edge' | 'worker' | 'banco'
export type Periodo = '1h' | '24h' | '7d' | '30d' | 'tudo'

export const NIVEIS: Nivel[] = ['fatal', 'erro', 'aviso', 'info', 'debug']
export const ORIGENS: Origem[] = ['navegador', 'edge', 'vercel', 'worker', 'banco']
export const PERIODOS: Periodo[] = ['1h', '24h', '7d', '30d', 'tudo']

/** Só o que costuma importar, por padrão: o resto é um clique. */
export const NIVEIS_PADRAO: Nivel[] = ['fatal', 'erro', 'aviso']

export const ROTULO_NIVEL: Record<Nivel, string> = {
  fatal: 'Fatal',
  erro: 'Erro',
  aviso: 'Aviso',
  info: 'Info',
  debug: 'Debug',
}

export const ROTULO_ORIGEM: Record<Origem, string> = {
  navegador: 'Navegador',
  edge: 'Edge function',
  vercel: 'Vercel',
  worker: 'Worker do Scan',
  banco: 'Banco',
}

export const ROTULO_PERIODO: Record<Periodo, string> = {
  '1h': 'Última hora',
  '24h': 'Últimas 24 h',
  '7d': 'Últimos 7 dias',
  '30d': 'Últimos 30 dias',
  tudo: 'Tudo',
}

/** Classes do selo de nível — semântica, não decoração. */
export const CLASSE_NIVEL: Record<Nivel, string> = {
  fatal: 'text-red-200 border-red-400/40 bg-red-500/20',
  erro: 'text-red-300 border-red-400/30 bg-red-400/10',
  aviso: 'text-amber-300 border-amber-400/30 bg-amber-400/10',
  info: 'text-sky-300 border-sky-400/30 bg-sky-400/10',
  debug: 'text-muted border-white/10 bg-white/5',
}

export interface Filtros {
  niveis: Nivel[]
  origem: Origem | null
  fonte: string | null
  periodo: Periodo
  busca: string
}

export const FILTROS_PADRAO: Filtros = {
  niveis: NIVEIS_PADRAO,
  origem: null,
  fonte: null,
  periodo: '24h',
  busca: '',
}

const MS_POR_MINUTO = 60_000
const MS_POR_HORA = 60 * MS_POR_MINUTO
const MS_POR_DIA = 24 * MS_POR_HORA

export function ehNivel(v: string | null | undefined): v is Nivel {
  return NIVEIS.includes(v as Nivel)
}
export function ehOrigem(v: string | null | undefined): v is Origem {
  return ORIGENS.includes(v as Origem)
}
export function ehPeriodo(v: string | null | undefined): v is Periodo {
  return PERIODOS.includes(v as Periodo)
}

/** Instante a partir do qual o período vale; null = sem corte. */
export function inicioDoPeriodo(periodo: Periodo, agora: Date): Date | null {
  switch (periodo) {
    case '1h':
      return new Date(agora.getTime() - MS_POR_HORA)
    case '24h':
      return new Date(agora.getTime() - MS_POR_DIA)
    case '7d':
      return new Date(agora.getTime() - 7 * MS_POR_DIA)
    case '30d':
      return new Date(agora.getTime() - 30 * MS_POR_DIA)
    default:
      return null
  }
}

// ---------------------------------------------------------------------------
// URL ↔ filtros. A notificação de fatal manda para /admin/logs?fonte=x.
// ---------------------------------------------------------------------------

export function lerFiltros(busca: URLSearchParams): Filtros {
  const niveis = (busca.get('nivel') ?? '').split(',').filter(ehNivel)
  const origem = busca.get('origem')
  const periodo = busca.get('periodo')
  return {
    niveis: niveis.length ? niveis : NIVEIS_PADRAO,
    origem: ehOrigem(origem) ? origem : null,
    fonte: busca.get('fonte')?.trim() || null,
    periodo: ehPeriodo(periodo) ? periodo : '24h',
    busca: busca.get('q')?.trim() ?? '',
  }
}

export function filtrosParaBusca(f: Filtros): URLSearchParams {
  const p = new URLSearchParams()
  if (f.niveis.join(',') !== NIVEIS_PADRAO.join(',')) p.set('nivel', f.niveis.join(','))
  if (f.origem) p.set('origem', f.origem)
  if (f.fonte) p.set('fonte', f.fonte)
  if (f.periodo !== '24h') p.set('periodo', f.periodo)
  if (f.busca) p.set('q', f.busca)
  return p
}

// ---------------------------------------------------------------------------
// Filtro em memória (o servidor já filtra; isto é para o Realtime e a busca).
// ---------------------------------------------------------------------------

function contem(texto: string | null, termo: string): boolean {
  return Boolean(texto) && (texto as string).toLowerCase().includes(termo)
}

export function filtrar(linhas: LinhaDeLog[], f: Filtros, agora: Date): LinhaDeLog[] {
  const desde = inicioDoPeriodo(f.periodo, agora)
  const termo = f.busca.trim().toLowerCase()
  return linhas.filter((l) => {
    if (!f.niveis.includes(l.nivel as Nivel)) return false
    if (f.origem && l.origem !== f.origem) return false
    if (f.fonte && l.fonte !== f.fonte) return false
    if (desde && new Date(l.ultima_em) < desde) return false
    if (termo) {
      const bate =
        contem(l.mensagem, termo) || contem(l.evento, termo) || contem(l.fonte, termo) ||
        contem(l.requisicao_id, termo) || contem(l.sessao_id, termo) || contem(l.versao, termo)
      if (!bate) return false
    }
    return true
  })
}

// ---------------------------------------------------------------------------
// Realtime: uma linha nova ou atualizada entra no lugar certo.
// ---------------------------------------------------------------------------

export const MAXIMO_EM_MEMORIA = 500

export function mesclar(linhas: LinhaDeLog[], nova: LinhaDeLog): LinhaDeLog[] {
  const semEla = linhas.filter((l) => l.id !== nova.id)
  const ordenadas = [nova, ...semEla].sort((a, b) => (a.ultima_em < b.ultima_em ? 1 : a.ultima_em > b.ultima_em ? -1 : 0))
  return ordenadas.slice(0, MAXIMO_EM_MEMORIA)
}

// ---------------------------------------------------------------------------
// Agrupamento e resumo
// ---------------------------------------------------------------------------

export interface GrupoDeEvento {
  fonte: string
  evento: string
  nivel: Nivel
  ocorrencias: number
  linhas: number
  ultimaEm: string
}

/** Os eventos que mais se repetem, somando `ocorrencias` de cada linha. */
export function agruparPorEvento(linhas: LinhaDeLog[], limite = 8): GrupoDeEvento[] {
  const grupos = new Map<string, GrupoDeEvento>()
  for (const l of linhas) {
    const chave = `${l.fonte}|${l.evento}`
    const g = grupos.get(chave)
    if (g) {
      g.ocorrencias += l.ocorrencias
      g.linhas += 1
      if (l.ultima_em > g.ultimaEm) g.ultimaEm = l.ultima_em
      if (NIVEIS.indexOf(l.nivel as Nivel) < NIVEIS.indexOf(g.nivel)) g.nivel = l.nivel as Nivel
    } else {
      grupos.set(chave, { fonte: l.fonte, evento: l.evento, nivel: l.nivel as Nivel, ocorrencias: l.ocorrencias, linhas: 1, ultimaEm: l.ultima_em })
    }
  }
  return [...grupos.values()].sort((a, b) => b.ocorrencias - a.ocorrencias).slice(0, limite)
}

export interface Resumo {
  erros: number
  fatais: number
  avisos: number
  fontesComErro: number
}

/** Números das últimas 24 h a partir de linhas leves (nivel, fonte, ocorrencias). */
export function resumo(linhas: Array<Pick<LinhaDeLog, 'nivel' | 'fonte' | 'ocorrencias'>>): Resumo {
  const r: Resumo = { erros: 0, fatais: 0, avisos: 0, fontesComErro: 0 }
  const fontes = new Set<string>()
  for (const l of linhas) {
    if (l.nivel === 'fatal') {
      r.fatais += l.ocorrencias
      fontes.add(l.fonte)
    } else if (l.nivel === 'erro') {
      r.erros += l.ocorrencias
      fontes.add(l.fonte)
    } else if (l.nivel === 'aviso') r.avisos += l.ocorrencias
  }
  r.fontesComErro = fontes.size
  return r
}

/** Fontes distintas, para o select. */
export function fontesDe(linhas: LinhaDeLog[]): string[] {
  return [...new Set(linhas.map((l) => l.fonte))].sort()
}

// ---------------------------------------------------------------------------
// Detalhe
// ---------------------------------------------------------------------------

/** Linhas da mesma requisição ou da mesma sessão do checkout. */
export function relacionadas(linhas: LinhaDeLog[], alvo: LinhaDeLog): LinhaDeLog[] {
  return linhas.filter(
    (l) =>
      l.id !== alvo.id &&
      ((alvo.requisicao_id && l.requisicao_id === alvo.requisicao_id) ||
        (alvo.sessao_id && l.sessao_id === alvo.sessao_id))
  )
}

/** "/c/plano-correcao?x" → "plano-correcao" (para o link ao Ao vivo). */
export function slugDoCheckout(contexto: Json): string | null {
  const rota = contexto && typeof contexto === 'object' && !Array.isArray(contexto) ? contexto.rota : null
  if (typeof rota !== 'string') return null
  const m = /^\/c\/([a-z0-9][a-z0-9-]*)/.exec(rota)
  return m ? m[1] : null
}

export interface MigalhaLida {
  t: number
  tipo: string
  texto: string
  dados?: Record<string, unknown>
}

/** As migalhas do contexto, quando existem e têm a forma esperada. */
export function migalhasDe(contexto: Json): MigalhaLida[] {
  if (!contexto || typeof contexto !== 'object' || Array.isArray(contexto)) return []
  const lista = contexto.migalhas
  if (!Array.isArray(lista)) return []
  return lista.flatMap((m) => {
    if (!m || typeof m !== 'object' || Array.isArray(m)) return []
    const t = typeof m.t === 'number' ? m.t : 0
    const tipo = typeof m.tipo === 'string' ? m.tipo : 'outro'
    const texto = typeof m.texto === 'string' ? m.texto : ''
    const dados = m.dados && typeof m.dados === 'object' && !Array.isArray(m.dados) ? (m.dados as Record<string, unknown>) : undefined
    return [{ t, tipo, texto, ...(dados ? { dados } : {}) }]
  })
}

/** O contexto sem as migalhas (elas têm bloco próprio). */
export function contextoSemMigalhas(contexto: Json): Record<string, unknown> {
  if (!contexto || typeof contexto !== 'object' || Array.isArray(contexto)) return {}
  const { migalhas: _m, ...resto } = contexto as Record<string, unknown>
  return resto
}

export function haQuanto(iso: string, agora: Date): string {
  const diff = Math.max(0, agora.getTime() - new Date(iso).getTime())
  const segundos = Math.round(diff / 1000)
  if (segundos < 45) return 'agora'
  const minutos = Math.round(segundos / 60)
  if (minutos < 60) return `há ${minutos} min`
  const horas = Math.round(minutos / 60)
  if (horas < 48) return `há ${horas} h`
  return `há ${Math.round(horas / 24)} dias`
}

export function dataHora(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export function jsonBonito(valor: Json): string {
  try {
    return JSON.stringify(valor, null, 2)
  } catch {
    return String(valor)
  }
}
