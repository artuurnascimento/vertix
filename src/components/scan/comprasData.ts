import { raioxSupabase } from '../leadsRaiox/raioxSupabase'
import {
  criarMensagemDoCorpo,
  invocarReembolso,
} from '../pedidos/reembolsoResposta'
import type { ResultadoReembolso } from '../pedidos/reembolsoResposta'
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
 *
 * A única escrita que sai daqui é o REEMBOLSO, e ela não escreve na tabela:
 * chama a edge function `scan-reembolsar`, que tem service role, porque
 * devolver dinheiro no gateway e revogar o acesso ao plano precisam acontecer
 * juntos ou não acontecer.
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
  /** Cobrança que esta venda gerou no Financeiro. O reembolso a cancela. */
  receivable_id: string | null
  /** Quando o reembolso foi feito. NULL enquanto a coluna não existir. */
  reembolsado_em: string | null
}

export interface ScanComprasResponse {
  /** Quantas compras existem no período (count exato do banco). */
  total: number
  compras: ScanCompra[]
  /** true quando o período tem mais compras do que o teto carregado. */
  truncado: boolean
  /**
   * true quando a coluna `reembolsado_em` ainda não existe neste ambiente.
   * A tela usa isso para não afirmar "nunca reembolsada" sobre um dado que ela
   * simplesmente não conseguiu ler.
   */
  semColunaReembolso: boolean
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
  receivable_id: string | null
  reembolsado_em?: string | null
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

/**
 * A coluna do reembolso nasce na migração 20260908230000. Pedir uma coluna
 * inexistente ao PostgREST derruba a consulta INTEIRA (42703), e a lista de
 * vendas é útil mesmo sem ela — por isso a primeira tentativa a inclui e a
 * segunda desiste dela. Mesmo arranjo da tela de Pedidos.
 */
const COLUNA_REEMBOLSO = 'reembolsado_em'
const CODIGO_COLUNA_AUSENTE = '42703'

const COLUNAS_BASE =
  'id, analysis_id, lead_id, valor_centavos, status, plano_code, ' +
  'plano_gerado_em, recibo_enviado_em, concorrentes, reanalise_agendada_em, ' +
  'reanalise_analysis_id, pago_em, created_at, receivable_id'

function codigoDoErro(erro: unknown): string | null {
  if (typeof erro !== 'object' || erro === null) return null
  const code = (erro as { code?: unknown }).code
  return typeof code === 'string' ? code : null
}

async function consultar(
  colunas: string,
  periodo: Periodo
): Promise<{ linhas: LinhaCompra[]; total: number }> {
  const intervalo = intervaloDoPeriodo(periodo)
  let q = raioxSupabase
    .from('raiox_compras')
    .select(colunas, { count: 'exact' })
    .gte('created_at', intervalo.desde)
  if (intervalo.ate) q = q.lt('created_at', intervalo.ate)

  const { data, count, error } = await q
    .order('created_at', { ascending: false })
    .range(0, COMPRAS_LIMITE - 1)
  if (error) throw error

  const linhas = (data ?? []) as unknown as LinhaCompra[]
  return { linhas, total: count ?? linhas.length }
}

export async function fetchScanCompras(
  periodo: Periodo
): Promise<ScanComprasResponse> {
  let semColunaReembolso = false
  let resultado: { linhas: LinhaCompra[]; total: number }

  try {
    resultado = await consultar(`${COLUNAS_BASE}, ${COLUNA_REEMBOLSO}`, periodo)
  } catch (erro) {
    if (codigoDoErro(erro) !== CODIGO_COLUNA_AUSENTE) {
      throw erro instanceof Error ? erro : new Error(String(erro))
    }
    semColunaReembolso = true
    resultado = await consultar(COLUNAS_BASE, periodo)
  }

  const linhas = resultado.linhas
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
      receivable_id: l.receivable_id,
      reembolsado_em: l.reembolsado_em ?? null,
    }
  })

  const total = resultado.total
  return {
    total,
    compras,
    truncado: total > compras.length,
    semColunaReembolso,
  }
}

// ---------------------------------------------------------------------------
// Reembolso
// ---------------------------------------------------------------------------
// A tradução da resposta e a chamada em si moram em
// `components/pedidos/reembolsoResposta.ts`, compartilhadas com a tela de
// Pedidos: as duas edge functions de reembolso respondem no MESMO contrato, e
// duas cópias da tradução divergiriam justamente na parte que diz se o
// dinheiro saiu.
//
// O que fica AQUI é o que é da compra do Scan: quais códigos esta function
// devolve sem `mensagem` própria.

/** Corpo de resposta → mensagem, ou null quando a resposta é de sucesso. */
export const mensagemDoCorpoDaCompra = criarMensagemDoCorpo({
  compra_nao_encontrada: 'Essa venda não existe mais no banco.',
  compra_id_invalido: 'A requisição saiu sem a venda. Recarregue a página.',
})

/**
 * Estorna a compra inteira e revoga o acesso ao Plano de Correção, numa
 * chamada só. O contrato é `{ compra_id }` (supabase/functions/scan-reembolsar).
 */
export async function reembolsarCompraDoScan(
  compraId: string
): Promise<ResultadoReembolso> {
  return await invocarReembolso(
    'scan-reembolsar',
    { compra_id: compraId },
    mensagemDoCorpoDaCompra
  )
}
