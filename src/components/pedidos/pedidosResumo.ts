import { formatBRL } from '../../lib/commercial'
import type { Pedido } from './pedidosData'

/**
 * Contas e rótulos da tela de Pedidos. Funções PURAS — sem rede, sem banco,
 * sem React —, testadas em pedidosResumo.test.ts e usadas por Pedidos.tsx,
 * PedidosTable.tsx e ReembolsoModal.tsx.
 *
 * Duas delas existem para impedir reembolso acidental e por isso têm teste
 * próprio: `podeReembolsar` (quando o botão aparece) e `confirmacaoConfere`
 * (o que libera o botão dentro do modal).
 */

/** Data curta + hora, no fuso do navegador ("08/09/26, 14:32"). */
export function dataHora(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** 19700 → "R$ 197,00". O banco guarda centavos; a tela mostra reais. */
export function formatCentavos(centavos: number): string {
  return formatBRL(centavos / 100)
}

/**
 * Quanto tempo depois do pagamento a entrega vira problema. Mesmo limite da
 * visão de vendas do Scan: o worker entrega logo após o webhook confirmar, e
 * uma hora sem carimbo de entrega quer dizer que o cliente pagou e não
 * recebeu.
 */
export const ATRASO_ENTREGA_MS = 60 * 60 * 1000

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

export interface Pill {
  label: string
  className: string
}

const STATUS: Record<string, Pill> = {
  pago: {
    label: 'Pago',
    className: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300',
  },
  aguardando: {
    label: 'Aguardando pagamento',
    className: 'border-amber-400/25 bg-amber-400/10 text-amber-300',
  },
  recusado: {
    label: 'Recusado',
    className: 'border-white/10 bg-white/5 text-muted',
  },
  reembolsado: {
    label: 'Reembolsado',
    className: 'border-red-400/25 bg-red-400/10 text-red-300',
  },
}

/** Pill do status do pedido — os quatro do check constraint da tabela. */
export function pedidoStatusMeta(status: string): Pill {
  return (
    STATUS[status] ?? { label: status, className: 'border-white/10 bg-white/5 text-muted' }
  )
}

// ---------------------------------------------------------------------------
// Reembolso: quando o botão pode existir
// ---------------------------------------------------------------------------

/**
 * O botão de reembolso só existe em pedido PAGO.
 *
 * 'aguardando' e 'recusado' nunca tiraram dinheiro do cliente — estornar
 * seria devolver o que ninguém pagou. 'reembolsado' já foi, e mandar de novo
 * é pedir um estorno em dobro ao gateway. Sobra exatamente um estado, e é
 * esta função que garante que só ele mostra o botão.
 */
export function podeReembolsar(pedido: Pick<Pedido, 'status'>): boolean {
  return pedido.status === 'pago'
}

/**
 * O valor exato que a pessoa precisa digitar para liberar o reembolso, sem o
 * "R$" e sem separador de milhar: 19700 → "197,00".
 *
 * É o valor, e não uma palavra fixa como "REEMBOLSAR", porque uma palavra
 * fixa vira memória muscular depois do terceiro uso — e aí a confirmação
 * forte deixa de confirmar coisa alguma. O valor obriga a olhar a linha.
 */
export function valorParaConfirmar(centavos: number): string {
  return (centavos / 100).toFixed(2).replace('.', ',')
}

/**
 * Texto digitado → centavos, ou null quando não dá para ler um valor.
 *
 * Tolerante com a forma ("R$ 1.970,00", "1970,00", "1970.00", "1970") porque
 * a confirmação existe para provar ATENÇÃO, não para testar formatação: quem
 * conferiu o valor e digitou certo não pode ser barrado por um ponto.
 */
export function centavosDigitados(texto: string): number | null {
  const limpo = texto.replace(/[^0-9.,]/g, '')
  if (limpo === '') return null

  let normalizado: string
  if (limpo.includes(',')) {
    // Vírgula presente = separador decimal brasileiro; pontos são milhar.
    normalizado = limpo.replace(/\./g, '').replace(',', '.')
  } else {
    const partes = limpo.split('.')
    // "1970.00" é decimal; "1.970" é milhar. O que decide é o tamanho do
    // último grupo — três dígitos só aparecem em separação de milhar.
    const ultimo = partes.length > 1 ? partes[partes.length - 1] : ''
    normalizado =
      partes.length > 1 && ultimo.length !== 3
        ? `${partes.slice(0, -1).join('')}.${ultimo}`
        : partes.join('')
  }

  const numero = Number(normalizado)
  if (!Number.isFinite(numero)) return null
  return Math.round(numero * 100)
}

/**
 * Libera (ou não) o botão que devolve o dinheiro. Compara em CENTAVOS, e não
 * como texto, para que "197" e "197,00" contem como o mesmo acerto — e para
 * que "196,99" nunca conte.
 */
export function confirmacaoConfere(digitado: string, totalCentavos: number): boolean {
  return centavosDigitados(digitado) === totalCentavos
}

// ---------------------------------------------------------------------------
// O que a pessoa precisa ver antes de decidir um reembolso
// ---------------------------------------------------------------------------

export type EstadoEntrega = 'entregue' | 'pendente' | 'atrasada' | 'nada_a_entregar'

export interface EntregaMeta extends Pill {
  estado: EstadoEntrega
  /** Pagou e não recebeu: a linha inteira ganha destaque de alerta. */
  alerta: boolean
}

/** Carimbo de entrega, seja pelo worker ou pela geração do plano. */
export function entregueEm(pedido: Pedido): string | null {
  return pedido.entregue_em ?? pedido.plano_gerado_em
}

/**
 * Em que pé está a entrega. Importa para o reembolso: devolver dinheiro de
 * algo já entregue é a decisão cara; de algo nunca entregue, quase sempre a
 * decisão certa.
 */
export function entregaDoPedido(pedido: Pedido, agora: Date = new Date()): EntregaMeta {
  if (entregueEm(pedido) !== null) {
    return {
      estado: 'entregue',
      label: 'Entregue',
      className: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300',
      alerta: false,
    }
  }
  if (pedido.status !== 'pago') {
    return {
      estado: 'nada_a_entregar',
      label: 'Nada a entregar',
      className: 'border-white/10 text-muted',
      alerta: false,
    }
  }

  const referencia = new Date(pedido.criado_em).getTime()
  const atrasada =
    !Number.isNaN(referencia) && agora.getTime() - referencia > ATRASO_ENTREGA_MS
  return atrasada
    ? {
        estado: 'atrasada',
        label: 'Pagou e não recebeu',
        className: 'border-red-400/40 bg-red-500/15 text-red-200',
        alerta: true,
      }
    : {
        estado: 'pendente',
        label: 'Entregando',
        className: 'border-amber-400/25 bg-amber-400/10 text-amber-300',
        alerta: false,
      }
}

/**
 * O pedido virou parcela no Financeiro? Se virou, o reembolso deixa um
 * recebível órfão para alguém acertar à mão — a tela precisa avisar antes.
 */
export function temRecebivel(pedido: Pedido): boolean {
  return (
    pedido.receivable_id !== null ||
    pedido.itens.some((item) => item.receivable_id !== null)
  )
}

export type MetodoPagamento = 'pix' | 'cartao' | 'desconhecido'

/**
 * Forma de pagamento, deduzida — a tabela não guarda o método.
 *
 * `mp_card_id` só é gravado quando o MP salva um cartão, e o desconto por
 * método hoje só existe no Pix. Fora desses dois sinais não dá para afirmar
 * nada, e a tela mostra "—" em vez de chutar "cartão".
 */
export function metodoDoPedido(pedido: Pedido): MetodoPagamento {
  if (pedido.mp_card_id !== null) return 'cartao'
  if (pedido.desconto_metodo_centavos > 0) return 'pix'
  return 'desconhecido'
}

export const METODO_LABEL: Record<MetodoPagamento, string> = {
  pix: 'Pix',
  cartao: 'Cartão',
  desconhecido: '—',
}

/** "Plano de Correção + 1 item" — o que a pessoa comprou, em uma linha. */
export function resumoDosItens(pedido: Pedido): string {
  const nomes = pedido.itens.filter((item) => item.pago).map((item) => item.nome)
  // Pedido não pago não tem item pago nenhum; aí o snapshot inteiro é o que
  // a pessoa tentou comprar, e é isso que interessa mostrar.
  const lista = nomes.length > 0 ? nomes : pedido.itens.map((item) => item.nome)
  if (lista.length === 0) return 'Sem itens'
  if (lista.length === 1) return lista[0]
  return `${lista[0]} + ${lista.length - 1} ${lista.length === 2 ? 'item' : 'itens'}`
}

// ---------------------------------------------------------------------------
// Cartões do topo
// ---------------------------------------------------------------------------

export interface ResumoPedidos {
  pagos: number
  /** Soma dos pedidos pagos, em centavos. Reembolsados já saíram daqui. */
  receitaCentavos: number
  /** Checkouts abandonados: ainda em 'aguardando'. */
  aguardando: number
  reembolsados: number
  /** Quanto voltou para clientes no período, em centavos. */
  reembolsadoCentavos: number
}

export function resumoDosPedidos(pedidos: readonly Pedido[]): ResumoPedidos {
  return pedidos.reduce<ResumoPedidos>(
    (acc, p) => ({
      pagos: acc.pagos + (p.status === 'pago' ? 1 : 0),
      receitaCentavos: acc.receitaCentavos + (p.status === 'pago' ? p.total_centavos : 0),
      aguardando: acc.aguardando + (p.status === 'aguardando' ? 1 : 0),
      reembolsados: acc.reembolsados + (p.status === 'reembolsado' ? 1 : 0),
      reembolsadoCentavos:
        acc.reembolsadoCentavos + (p.status === 'reembolsado' ? p.total_centavos : 0),
    }),
    {
      pagos: 0,
      receitaCentavos: 0,
      aguardando: 0,
      reembolsados: 0,
      reembolsadoCentavos: 0,
    }
  )
}
