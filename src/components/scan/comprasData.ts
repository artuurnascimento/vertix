import { raioxSupabase } from '../leadsRaiox/raioxSupabase'
import { intervaloDoPeriodo } from '../../lib/periodo'
import type { Periodo } from '../../lib/periodo'

/**
 * Vendas do Plano de Correção (public.raiox_compras), lidas com o client
 * autenticado do painel. A tabela mora no mesmo projeto Supabase e só dá
 * SELECT para a equipe (migração 20260907160000): quem escreve são as edge
 * functions com service role. Aqui NUNCA se escreve — só leitura.
 *
 * `analysis_id`/`lead_id` são uuid sem foreign key de propósito (a faxina de
 * leads de teste não pode arrastar uma compra paga). Sem FK o PostgREST não
 * faz embed, então o nome do comprador e o domínio da loja vêm em consultas
 * separadas e são casados aqui, em memória.
 */

/** Uma compra, já com comprador e loja resolvidos. */
export interface ScanCompra {
  id: string
  criado_em: string
  status: string
  valor_centavos: number
  /** Loja analisada — vem de public.analyses. */
  dominio: string | null
  /** Comprador — vem de public.leads (o lead que virou venda). */
  comprador: string | null
  email: string | null
  /** Código curto do plano entregue; abre a página do plano no site do Scan. */
  plano_code: string | null
  plano_gerado_em: string | null
  recibo_enviado_em: string | null
  pago_em: string | null
  /** Bônus: os dois concorrentes que o cliente informa depois da compra. */
  concorrentes: string[] | null
  /** Reanálise de 30 dias: agendada e, depois, executada. */
  reanalise_agendada_em: string | null
  reanalise_analysis_id: string | null
}

export interface ScanComprasResponse {
  /** Quantas compras existem no período (count exato do banco). */
  total: number
  compras: ScanCompra[]
  /** true quando o período tem mais compras do que o teto carregado. */
  truncado: boolean
}

/**
 * Teto de linhas por período. O PostgREST não soma no servidor sem uma view,
 * então os cartões são calculados sobre as linhas carregadas — carregar tudo
 * é o que os mantém honestos. 500 compras de R$ 197 são ~R$ 98 mil no
 * período: se um dia estourar, `truncado` avisa na tela em vez de mentir.
 */
export const COMPRAS_LIMITE = 500

interface LinhaCompra {
  id: string
  analysis_id: string
  lead_id: string | null
  valor_centavos: number
  status: string
  plano_code: string | null
  plano_gerado_em: string | null
  recibo_enviado_em: string | null
  concorrentes: string[] | null
  reanalise_agendada_em: string | null
  reanalise_analysis_id: string | null
  pago_em: string | null
  created_at: string
}

/** Mapa id → valor, para casar as compras com leads e análises. */
async function mapaPor<T extends string>(
  tabela: string,
  colunas: string,
  ids: string[]
): Promise<Map<string, Record<T, string | null>>> {
  if (ids.length === 0) return new Map()
  const { data, error } = await raioxSupabase
    .from(tabela)
    .select(colunas)
    .in('id', ids)
  if (error) throw new Error(error.message)
  const linhas = (data ?? []) as unknown as Array<{ id: string } & Record<T, string | null>>
  return new Map(linhas.map((l) => [l.id, l]))
}

export async function fetchScanCompras(
  periodo: Periodo
): Promise<ScanComprasResponse> {
  const intervalo = intervaloDoPeriodo(periodo)
  let q = raioxSupabase
    .from('raiox_compras')
    .select(
      'id, analysis_id, lead_id, valor_centavos, status, plano_code, plano_gerado_em, recibo_enviado_em, concorrentes, reanalise_agendada_em, reanalise_analysis_id, pago_em, created_at',
      { count: 'exact' }
    )
    .gte('created_at', intervalo.desde)
  if (intervalo.ate) q = q.lt('created_at', intervalo.ate)

  const { data, count, error } = await q
    .order('created_at', { ascending: false })
    .range(0, COMPRAS_LIMITE - 1)
  if (error) throw new Error(error.message)

  const linhas = (data ?? []) as unknown as LinhaCompra[]
  const [analises, leads] = await Promise.all([
    mapaPor<'domain'>('analyses', 'id, domain', [
      ...new Set(linhas.map((l) => l.analysis_id)),
    ]),
    mapaPor<'name' | 'email'>('leads', 'id, name, email', [
      ...new Set(linhas.map((l) => l.lead_id).filter((id): id is string => id != null)),
    ]),
  ])

  const compras: ScanCompra[] = linhas.map((l) => {
    const lead = l.lead_id ? leads.get(l.lead_id) : undefined
    return {
      id: l.id,
      criado_em: l.created_at,
      status: l.status,
      valor_centavos: l.valor_centavos,
      dominio: analises.get(l.analysis_id)?.domain ?? null,
      comprador: lead?.name ?? null,
      email: lead?.email ?? null,
      plano_code: l.plano_code,
      plano_gerado_em: l.plano_gerado_em,
      recibo_enviado_em: l.recibo_enviado_em,
      pago_em: l.pago_em,
      concorrentes: l.concorrentes,
      reanalise_agendada_em: l.reanalise_agendada_em,
      reanalise_analysis_id: l.reanalise_analysis_id,
    }
  })

  const total = count ?? compras.length
  return { total, compras, truncado: total > compras.length }
}
