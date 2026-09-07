/**
 * Períodos dos painéis (link de bio, Vertix Scan): as janelas corridas
 * ("últimos 30 dias") e os meses fechados ("set/26"), sempre no horário de
 * Brasília — um evento de 1º de setembro às 00h30 UTC é de agosto para quem
 * olha o painel daqui.
 *
 * Importado por src/components/ui/FiltroPeriodo.tsx, src/pages/VertixScan.tsx
 * e src/components/bio-admin/BioPainelResumo.tsx. Cálculo puro, sem rede: as
 * páginas convertem o resultado em filtro de consulta (Vertix Scan) ou em
 * recorte em memória (link de bio). Só lida com datas ISO de `created_at`.
 */

const FUSO = 'America/Sao_Paulo'
/** Brasil sem horário de verão desde 2019: o deslocamento é fixo. */
const OFFSET_BRASILIA = '-03:00'

/** Janelas corridas oferecidas no filtro. */
export const PERIODOS_CORRIDOS = [
  { id: '7d', rotulo: '7 dias', dias: 7 },
  { id: '30d', rotulo: '30 dias', dias: 30 },
  { id: '90d', rotulo: '90 dias', dias: 90 },
  { id: '365d', rotulo: '12 meses', dias: 365 },
] as const

export type PeriodoCorrido = (typeof PERIODOS_CORRIDOS)[number]['id']
/** Um período corrido ou a chave de um mês fechado ("2026-09"). */
export type Periodo = PeriodoCorrido | string

export interface Intervalo {
  /** Início, em ISO UTC (inclusivo). */
  desde: string
  /** Fim, em ISO UTC (exclusivo). Ausente nas janelas corridas. */
  ate?: string
}

/** "2026-09" a partir de um ISO, no fuso de São Paulo (e não em UTC). */
export function chaveMes(iso: string): string | null {
  const data = new Date(iso)
  if (Number.isNaN(data.getTime())) return null
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(data)
  const ano = partes.find((p) => p.type === 'year')?.value
  const mes = partes.find((p) => p.type === 'month')?.value
  return ano && mes ? `${ano}-${mes}` : null
}

/** "set/26" a partir de "2026-09". */
export function rotuloMes(chave: string): string {
  const [ano, mes] = chave.split('-')
  const data = new Date(Number(ano), Number(mes) - 1, 1)
  const nome = new Intl.DateTimeFormat('pt-BR', { month: 'short' })
    .format(data)
    .replace('.', '')
  return `${nome}/${ano.slice(2)}`
}

/** Os últimos `quantidade` meses fechados, do mais recente ao mais antigo. */
export function mesesRecentes(
  quantidade = 6,
  agora: Date = new Date()
): Array<{ valor: string; rotulo: string }> {
  const atual = chaveMes(agora.toISOString())
  if (!atual) return []
  const [ano, mes] = atual.split('-').map(Number)
  return Array.from({ length: quantidade }, (_, i) => {
    const d = new Date(Date.UTC(ano, mes - 1 - i, 1))
    const chave = `${d.getUTCFullYear()}-${String(
      d.getUTCMonth() + 1
    ).padStart(2, '0')}`
    return { valor: chave, rotulo: rotuloMes(chave) }
  })
}

/** Começo e fim do período escolhido, prontos para filtrar por `created_at`. */
export function intervaloDoPeriodo(
  periodo: Periodo,
  agora: Date = new Date()
): Intervalo {
  const corrido = PERIODOS_CORRIDOS.find((p) => p.id === periodo)
  if (corrido) {
    const desde = new Date(agora)
    desde.setDate(desde.getDate() - corrido.dias)
    return { desde: desde.toISOString() }
  }

  const [ano, mes] = periodo.split('-').map(Number)
  if (!ano || !mes) return { desde: new Date(0).toISOString() }
  const inicio = new Date(
    `${ano}-${String(mes).padStart(2, '0')}-01T00:00:00${OFFSET_BRASILIA}`
  )
  const proximoAno = mes === 12 ? ano + 1 : ano
  const proximoMes = mes === 12 ? 1 : mes + 1
  const fim = new Date(
    `${proximoAno}-${String(proximoMes).padStart(
      2,
      '0'
    )}-01T00:00:00${OFFSET_BRASILIA}`
  )
  return { desde: inicio.toISOString(), ate: fim.toISOString() }
}

/** Como o período aparece na tela ("30 dias", "set/26"). */
export function rotuloDoPeriodo(periodo: Periodo): string {
  const corrido = PERIODOS_CORRIDOS.find((p) => p.id === periodo)
  return corrido ? corrido.rotulo : rotuloMes(periodo)
}

/** O registro está dentro do período? Usado nos recortes em memória. */
export function dentroDoPeriodo(
  createdAt: string,
  intervalo: Intervalo
): boolean {
  if (createdAt < intervalo.desde) return false
  return intervalo.ate == null || createdAt < intervalo.ate
}
