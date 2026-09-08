import { catalogoSupabase } from '../produtos/catalogoSupabase'
import { supabase } from '../../lib/supabase'
import { intervaloDoPeriodo } from '../../lib/periodo'
import type { Periodo } from '../../lib/periodo'

/**
 * Leitura de public.pedidos — o que foi realmente comprado no checkout
 * próprio (20260908100000_checkout.sql) — e a chamada do reembolso.
 *
 * Até esta tela existir, o pedido do checkout não aparecia em lugar nenhum do
 * painel: a aba de vendas do Scan lê `raiox_compras`, que é outra tabela e
 * outro funil. Quem vendia pelo checkout não conseguia ver o que vendeu — e,
 * por consequência, não conseguia reembolsar.
 *
 * Aqui NUNCA se escreve na tabela. A migração dá à equipe apenas SELECT;
 * quem muda o status de um pedido é a edge function `checkout-reembolsar`,
 * com service role, porque devolver dinheiro no gateway e revogar o acesso
 * precisam acontecer juntos ou não acontecer.
 */

/** Um item do snapshot `pedidos.itens` (jsonb gravado na hora da compra). */
export interface PedidoItem {
  produto_id: string | null
  nome: string
  /** 'principal' | 'bump' | 'upsell' | 'downsell'. */
  tipo: string
  preco_centavos: number
  /** false = reservado pelo upsell e ainda não cobrado. */
  pago: boolean
  /** 'plano_scan' | 'manual' — como este item é entregue. */
  entrega: string | null
  /** Recebível que cobrou este item, quando a venda virou parcela. */
  receivable_id: string | null
}

export interface Pedido {
  id: string
  criado_em: string
  cliente_nome: string
  cliente_email: string
  cliente_whatsapp: string | null
  itens: PedidoItem[]
  subtotal_centavos: number
  desconto_centavos: number
  /** Parte do desconto que veio do método de pagamento (hoje, só Pix). */
  desconto_metodo_centavos: number
  total_centavos: number
  /** 'aguardando' | 'pago' | 'recusado' | 'reembolsado'. */
  status: string
  mp_payment_id: string | null
  /** Cartão salvo no MP (id opaco). Presença indica pagamento em cartão. */
  mp_card_id: string | null
  receivable_id: string | null
  plano_code: string | null
  origem: string | null
  entregue_em: string | null
  plano_gerado_em: string | null
  recibo_enviado_em: string | null
  /** Quando o reembolso foi feito. NULL enquanto a coluna não existir. */
  reembolsado_em: string | null
  /** Oferta que originou o pedido — vem do embed de public.checkouts. */
  checkout_titulo: string | null
  checkout_slug: string | null
}

export interface PedidosResposta {
  /** Quantos pedidos existem no período (count exato do banco). */
  total: number
  pedidos: Pedido[]
  /** true quando o período tem mais pedidos do que o teto carregado. */
  truncado: boolean
  /**
   * true quando a coluna `reembolsado_em` ainda não existe neste ambiente.
   * A tela usa isso para não afirmar "nunca reembolsado" sobre um dado que
   * ela simplesmente não conseguiu ler.
   */
  semColunaReembolso: boolean
}

/**
 * Teto de linhas por período, mesmo motivo do COMPRAS_LIMITE do Scan: o
 * PostgREST não soma no servidor sem uma view, então os cartões do topo são
 * calculados sobre as linhas carregadas. Carregar tudo é o que os mantém
 * honestos; quando estourar, `truncado` avisa na tela em vez de mentir.
 */
export const PEDIDOS_LIMITE = 500

/**
 * A coluna do reembolso nasce numa migração que está sendo escrita em
 * paralelo a esta tela. Pedir uma coluna inexistente ao PostgREST derruba a
 * consulta INTEIRA (42703), e a lista de pedidos é útil mesmo sem ela — por
 * isso a primeira tentativa a inclui e a segunda desiste dela.
 */
const COLUNA_REEMBOLSO = 'reembolsado_em'
const CODIGO_COLUNA_AUSENTE = '42703'

const COLUNAS_BASE =
  'id, created_at, cliente_nome, cliente_email, cliente_whatsapp, itens, ' +
  'subtotal_centavos, desconto_centavos, desconto_metodo_centavos, total_centavos, ' +
  'status, mp_payment_id, mp_card_id, receivable_id, plano_code, origem, ' +
  'entregue_em, plano_gerado_em, recibo_enviado_em, checkouts(titulo, slug)'

interface LinhaPedido {
  id: string
  created_at: string
  cliente_nome: string
  cliente_email: string
  cliente_whatsapp: string | null
  itens: unknown
  subtotal_centavos: number
  desconto_centavos: number
  desconto_metodo_centavos: number | null
  total_centavos: number
  status: string
  mp_payment_id: string | null
  mp_card_id: string | null
  receivable_id: string | null
  plano_code: string | null
  origem: string | null
  entregue_em: string | null
  plano_gerado_em: string | null
  recibo_enviado_em: string | null
  reembolsado_em?: string | null
  checkouts: { titulo: string | null; slug: string | null } | null
}

function ehRegistro(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
}

function texto(valor: unknown): string | null {
  return typeof valor === 'string' && valor.trim() !== '' ? valor.trim() : null
}

function inteiro(valor: unknown): number {
  return typeof valor === 'number' && Number.isFinite(valor) ? Math.round(valor) : 0
}

function codigoDoErro(erro: unknown): string | null {
  if (!ehRegistro(erro)) return null
  return typeof erro.code === 'string' ? erro.code : null
}

/**
 * `itens` é jsonb solto: pode ter sido gravado por uma versão anterior da
 * edge function ou por SQL na mão. Um item malformado não pode derrubar a
 * tela inteira de pedidos, então cada campo é lido com tolerância.
 */
export function parseItens(bruto: unknown): PedidoItem[] {
  if (!Array.isArray(bruto)) return []
  return bruto.flatMap((item): PedidoItem[] => {
    if (!ehRegistro(item)) return []
    return [
      {
        produto_id: texto(item.produto_id),
        nome: texto(item.nome) ?? 'Item sem nome',
        tipo: texto(item.tipo) ?? 'principal',
        preco_centavos: inteiro(item.preco_centavos),
        pago: item.pago === true,
        entrega: texto(item.entrega),
        receivable_id: texto(item.receivable_id),
      },
    ]
  })
}

function paraPedido(linha: LinhaPedido): Pedido {
  return {
    id: linha.id,
    criado_em: linha.created_at,
    cliente_nome: linha.cliente_nome,
    cliente_email: linha.cliente_email,
    cliente_whatsapp: linha.cliente_whatsapp,
    itens: parseItens(linha.itens),
    subtotal_centavos: linha.subtotal_centavos,
    desconto_centavos: linha.desconto_centavos,
    desconto_metodo_centavos: linha.desconto_metodo_centavos ?? 0,
    total_centavos: linha.total_centavos,
    status: linha.status,
    mp_payment_id: linha.mp_payment_id,
    mp_card_id: linha.mp_card_id,
    receivable_id: linha.receivable_id,
    plano_code: linha.plano_code,
    origem: linha.origem,
    entregue_em: linha.entregue_em,
    plano_gerado_em: linha.plano_gerado_em,
    recibo_enviado_em: linha.recibo_enviado_em,
    reembolsado_em: linha.reembolsado_em ?? null,
    checkout_titulo: linha.checkouts?.titulo ?? null,
    checkout_slug: linha.checkouts?.slug ?? null,
  }
}

async function consultar(
  colunas: string,
  periodo: Periodo
): Promise<{ linhas: LinhaPedido[]; total: number }> {
  const intervalo = intervaloDoPeriodo(periodo)
  let q = catalogoSupabase
    .from('pedidos')
    .select(colunas, { count: 'exact' })
    .gte('created_at', intervalo.desde)
  if (intervalo.ate) q = q.lt('created_at', intervalo.ate)

  const { data, count, error } = await q
    .order('created_at', { ascending: false })
    .range(0, PEDIDOS_LIMITE - 1)
  if (error) throw error

  const linhas = (data ?? []) as unknown as LinhaPedido[]
  return { linhas, total: count ?? linhas.length }
}

export async function fetchPedidos(periodo: Periodo): Promise<PedidosResposta> {
  let semColunaReembolso = false
  let resultado: { linhas: LinhaPedido[]; total: number }

  try {
    resultado = await consultar(`${COLUNAS_BASE}, ${COLUNA_REEMBOLSO}`, periodo)
  } catch (erro) {
    if (codigoDoErro(erro) !== CODIGO_COLUNA_AUSENTE) throw erro
    semColunaReembolso = true
    resultado = await consultar(COLUNAS_BASE, periodo)
  }

  const pedidos = resultado.linhas.map(paraPedido)
  return {
    total: resultado.total,
    pedidos,
    truncado: resultado.total > pedidos.length,
    semColunaReembolso,
  }
}

// ---------------------------------------------------------------------------
// Reembolso
// ---------------------------------------------------------------------------

/**
 * Os dois desfechos de sucesso da edge function. `ja_reembolsado` NÃO é
 * erro: duas abas abertas, um retry de rede ou um estorno feito ontem caem
 * todos ali, e a tela deve mostrar "reembolsado" em vez de uma falha.
 */
export type ResultadoReembolso = 'reembolsado' | 'ja_reembolsado'

/** Erro de reembolso já traduzido para quem está olhando a tela. */
export class ReembolsoError extends Error {
  /** true quando a edge function ainda não foi publicada neste ambiente. */
  naoPublicada: boolean

  constructor(message: string, naoPublicada = false) {
    super(message)
    this.name = 'ReembolsoError'
    this.naoPublicada = naoPublicada
  }
}

/**
 * Códigos que a function devolve SEM `mensagem` própria. Os que têm mensagem
 * (gateway_recusou, gateway_indisponivel, reembolsado_sem_registro,
 * reembolso_em_andamento…) são mostrados com o texto do servidor: ele sabe se
 * o dinheiro saiu, e reescrever aqui só criaria uma segunda versão da
 * verdade, capaz de divergir da primeira numa atualização do backend.
 */
const MENSAGENS: Record<string, string> = {
  pedido_nao_encontrado: 'Esse pedido não existe mais no banco.',
  nao_autenticado: 'Sua sessão expirou. Entre de novo e repita a operação.',
  acesso_negado: 'Seu usuário não tem permissão para reembolsar.',
  falha_ao_validar_permissao:
    'Não deu para conferir sua permissão. Nada foi cobrado nem estornado.',
  config_ausente:
    'O ambiente está sem a credencial do Mercado Pago. Nada foi estornado.',
  falha_ao_reservar_reembolso:
    'O banco não conseguiu reservar este reembolso. Nada foi estornado — tente de novo.',
  payload_invalido: 'A requisição saiu malformada. Recarregue a página.',
  pedido_id_invalido: 'A requisição saiu sem o pedido. Recarregue a página.',
  method_not_allowed: 'A função de reembolso recusou a chamada. Recarregue a página.',
}

const MENSAGEM_PADRAO =
  'Não deu para reembolsar. O dinheiro pode não ter voltado — confira no Mercado Pago antes de tentar de novo.'

const MENSAGEM_NAO_PUBLICADA =
  'A função de reembolso ainda não está publicada neste ambiente. O pedido continua pago e nada foi cobrado nem estornado.'

async function corpoDoErro(erro: unknown): Promise<Record<string, unknown> | null> {
  const contexto = (erro as { context?: unknown })?.context
  if (!(contexto instanceof Response)) return null
  try {
    const corpo: unknown = await contexto.clone().json()
    return ehRegistro(corpo) ? corpo : null
  } catch {
    return null
  }
}

function statusDoErro(erro: unknown): number | null {
  const contexto = (erro as { context?: unknown })?.context
  return contexto instanceof Response ? contexto.status : null
}

/**
 * Corpo de resposta → mensagem, ou null quando a resposta é de sucesso.
 * A `mensagem` do servidor tem precedência sobre o mapa local (ver MENSAGENS).
 */
export function mensagemDoCorpo(corpo: Record<string, unknown> | null): string | null {
  if (corpo === null) return null
  const codigo = texto(corpo.erro) ?? texto(corpo.error)
  if (codigo === null) return null
  return texto(corpo.mensagem) ?? MENSAGENS[codigo] ?? MENSAGEM_PADRAO
}

/** 'ja_reembolsado' e 'reembolsado' são sucesso; qualquer outro corpo não é. */
function resultadoDoCorpo(corpo: unknown): ResultadoReembolso {
  if (!ehRegistro(corpo)) return 'reembolsado'
  return texto(corpo.resultado) === 'ja_reembolsado' ? 'ja_reembolsado' : 'reembolsado'
}

/**
 * Estorna o pedido inteiro e revoga o acesso do cliente, numa chamada só.
 *
 * O contrato é `{ pedido_id }` (supabase/functions/checkout-reembolsar).
 * Devolve como terminou, porque "já estava reembolsado" e "acabei de
 * reembolsar" são a mesma resposta HTTP e frases diferentes na tela.
 */
export async function reembolsarPedido(
  pedidoId: string
): Promise<ResultadoReembolso> {
  const { data, error } = await supabase.functions.invoke('checkout-reembolsar', {
    body: { pedido_id: pedidoId },
  })

  if (error) {
    const corpo = await corpoDoErro(error)
    const mensagem = mensagemDoCorpo(corpo)
    if (mensagem !== null) throw new ReembolsoError(mensagem)
    // 404 SEM corpo reconhecível = a rota não existe. Com corpo, o 404 é
    // `pedido_nao_encontrado`, que já saiu pelo ramo acima — distinguir os
    // dois importa porque um manda publicar a function e o outro, não.
    if (statusDoErro(error) === 404) {
      throw new ReembolsoError(MENSAGEM_NAO_PUBLICADA, true)
    }
    throw new ReembolsoError(MENSAGEM_PADRAO)
  }

  // A function também pode responder 2xx com um `erro` no corpo: sucesso de
  // transporte não é sucesso de estorno, e tratar como sucesso mostraria
  // "reembolsado" para um cliente que continua sem o dinheiro de volta.
  const mensagem = mensagemDoCorpo(ehRegistro(data) ? data : null)
  if (mensagem !== null) throw new ReembolsoError(mensagem)

  return resultadoDoCorpo(data)
}
