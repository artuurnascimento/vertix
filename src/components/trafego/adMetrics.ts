/**
 * Cálculos puros das métricas de tráfego pago. Derivados NUNCA são
 * armazenados — sempre calculados destas funções. Divisão por zero
 * devolve null (exibido como "—"), nunca Infinity/NaN.
 */

export interface DailyMetric {
  data: string
  gasto: number
  impressoes: number | null
  cliques: number | null
  conversoes: number | null
  receita: number | null
}

export interface MonthAggregate {
  gasto: number
  impressoes: number
  cliques: number
  conversoes: number
  receita: number
}

/** Soma as métricas dos dias que caem no mês corrente (local). */
export function aggregateCurrentMonth(rows: DailyMetric[]): MonthAggregate {
  const now = new Date()
  const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  return rows
    .filter((row) => row.data.startsWith(monthPrefix))
    .reduce(
      (acc, row) => ({
        gasto: acc.gasto + row.gasto,
        impressoes: acc.impressoes + (row.impressoes ?? 0),
        cliques: acc.cliques + (row.cliques ?? 0),
        conversoes: acc.conversoes + (row.conversoes ?? 0),
        receita: acc.receita + (row.receita ?? 0),
      }),
      { gasto: 0, impressoes: 0, cliques: 0, conversoes: 0, receita: 0 }
    )
}

/** Retorno sobre investimento: receita/gasto. null com gasto zero. */
export function roas(gasto: number, receita: number): number | null {
  if (gasto <= 0) return null
  return receita / gasto
}

/** Custo por mil impressões. null sem impressões. */
export function cpm(gasto: number, impressoes: number): number | null {
  if (impressoes <= 0) return null
  return (gasto / impressoes) * 1000
}

/** Custo por clique. null sem cliques. */
export function cpc(gasto: number, cliques: number): number | null {
  if (cliques <= 0) return null
  return gasto / cliques
}

/** Taxa de cliques (%): cliques/impressões × 100. null sem impressões. */
export function ctr(cliques: number, impressoes: number): number | null {
  if (impressoes <= 0) return null
  return (cliques / impressoes) * 100
}

/** Número pt-BR com 2 casas, ou "—" quando o derivado é indefinido. */
export function formatDerived(value: number | null, prefix = ''): string {
  if (value === null) return '—'
  return (
    prefix +
    value.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  )
}
