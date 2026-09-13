/**
 * Carga por pessoa (jornada, fase 6): quanto de trabalho estimado ainda
 * está aberto por responsável e em quantas semanas isso cabe. Com uma pessoa
 * é a fila em semanas; com duas, é quem está afogado. Puro; a busca fica em
 * CargaPorPessoa.tsx.
 */

export interface ProjetoParaCarga {
  id: string
  nome: string
  status: string
  perdido_em: string | null
  responsavel_id: string | null
  horas_estimadas: number | string | null
}

export interface PerfilParaCarga {
  id: string
  nome: string
}

export interface CargaDaPessoa {
  /** null = projetos sem responsável. */
  responsavelId: string | null
  nome: string
  projetos: number
  semEstimativa: number
  estimadas: number
  realizadas: number
  /** estimadas − realizadas, nunca negativo. */
  restantes: number
  /** restantes ÷ capacidade semanal; null sem capacidade. */
  semanas: number | null
}

export const SEM_RESPONSAVEL = 'Sem responsável'
/** Projeto entregue não pesa; perdido também não. */
const STATUS_FECHADOS = new Set(['entregue'])

function numero(valor: number | string | null): number {
  const n = typeof valor === 'string' ? Number(valor) : (valor ?? 0)
  return Number.isFinite(n) && n > 0 ? n : 0
}

function arredondar(n: number): number {
  return Math.round(n * 10) / 10
}

export function projetosAbertos(projetos: readonly ProjetoParaCarga[]): ProjetoParaCarga[] {
  return projetos.filter((p) => !STATUS_FECHADOS.has(p.status) && !p.perdido_em)
}

/**
 * Uma linha por responsável com projeto aberto (+ "Sem responsável" quando
 * houver), da carga maior para a menor. As horas realizadas só contam nos
 * projetos abertos — o que já foi entregue não é carga.
 */
export function cargaPorPessoa(
  projetos: readonly ProjetoParaCarga[],
  horasPorProjeto: ReadonlyMap<string, number>,
  perfis: readonly PerfilParaCarga[],
  capacidadeSemanal: number
): CargaDaPessoa[] {
  const nomes = new Map(perfis.map((p) => [p.id, p.nome] as const))
  const linhas = new Map<string | null, CargaDaPessoa>()
  for (const projeto of projetosAbertos(projetos)) {
    const chave = projeto.responsavel_id
    const linha = linhas.get(chave) ?? {
      responsavelId: chave,
      nome: chave ? (nomes.get(chave) ?? 'Alguém da equipe') : SEM_RESPONSAVEL,
      projetos: 0,
      semEstimativa: 0,
      estimadas: 0,
      realizadas: 0,
      restantes: 0,
      semanas: null,
    }
    const estimadas = numero(projeto.horas_estimadas)
    const realizadas = horasPorProjeto.get(projeto.id) ?? 0
    linha.projetos += 1
    if (estimadas === 0) linha.semEstimativa += 1
    linha.estimadas += estimadas
    linha.realizadas += realizadas
    // Projeto sem estimativa não deixa o restante negativo nem infla o dos outros.
    linha.restantes += estimadas > 0 ? Math.max(0, estimadas - realizadas) : 0
    linhas.set(chave, linha)
  }
  return [...linhas.values()]
    .map((l) => ({
      ...l,
      estimadas: arredondar(l.estimadas),
      realizadas: arredondar(l.realizadas),
      restantes: arredondar(l.restantes),
      semanas: capacidadeSemanal > 0 ? arredondar(l.restantes / capacidadeSemanal) : null,
    }))
    .sort((a, b) => b.restantes - a.restantes || b.projetos - a.projetos || a.nome.localeCompare(b.nome, 'pt-BR'))
}

/** Soma de horas por projeto a partir das linhas de time_entries. */
export function somarHorasPorProjeto(entradas: readonly { project_id: string; horas: number | string }[]): Map<string, number> {
  const mapa = new Map<string, number>()
  for (const e of entradas) {
    mapa.set(e.project_id, (mapa.get(e.project_id) ?? 0) + numero(e.horas))
  }
  return mapa
}
