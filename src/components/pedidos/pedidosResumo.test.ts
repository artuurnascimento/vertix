import { describe, expect, it } from 'vitest'
import {
  centavosDigitados,
  confirmacaoConfere,
  entregaDoPedido,
  metodoDoPedido,
  pedidoStatusMeta,
  podeReembolsar,
  resumoDosItens,
  resumoDosPedidos,
  temRecebivel,
  valorParaConfirmar,
} from './pedidosResumo'
import { parseItens } from './pedidosData'
import type { Pedido, PedidoItem } from './pedidosData'

/**
 * O que estes testes protegem é dinheiro saindo, não pixel.
 *
 * Duas regras impedem um reembolso acidental: o botão só existe em pedido
 * pago, e o botão do modal só libera quando o valor exato foi digitado. Se
 * qualquer uma afrouxar, um clique passa a devolver dinheiro e revogar o
 * acesso de um cliente que não pediu isso.
 */

const ITEM: PedidoItem = {
  produto_id: 'p1',
  nome: 'Plano de Correção',
  tipo: 'principal',
  preco_centavos: 19700,
  pago: true,
  entrega: 'plano_scan',
  receivable_id: null,
}

function pedido(over: Partial<Pedido> = {}): Pedido {
  return {
    id: 'ped-1',
    criado_em: '2026-09-08T12:00:00.000Z',
    cliente_nome: 'Maria Souza',
    cliente_email: 'maria@loja.com',
    cliente_whatsapp: null,
    itens: [ITEM],
    subtotal_centavos: 19700,
    desconto_centavos: 0,
    desconto_metodo_centavos: 0,
    total_centavos: 19700,
    status: 'pago',
    mp_payment_id: '123',
    mp_card_id: null,
    receivable_id: null,
    plano_code: null,
    origem: null,
    entregue_em: null,
    plano_gerado_em: null,
    recibo_enviado_em: null,
    reembolsado_em: null,
    checkout_titulo: 'Plano de Correção',
    checkout_slug: 'plano',
    ...over,
  }
}

describe('podeReembolsar — quando o botão aparece', () => {
  it('aparece no pedido pago', () => {
    expect(podeReembolsar(pedido({ status: 'pago' }))).toBe(true)
  })

  it.each(['aguardando', 'recusado', 'reembolsado'])(
    'não aparece no pedido %s',
    (status) => {
      expect(podeReembolsar(pedido({ status }))).toBe(false)
    }
  )

  it('não aparece em status desconhecido — o padrão é não oferecer estorno', () => {
    expect(podeReembolsar(pedido({ status: 'chargeback' }))).toBe(false)
  })
})

describe('confirmação forte — o valor digitado', () => {
  it('mostra o valor esperado sem R$ e sem separador de milhar', () => {
    expect(valorParaConfirmar(19700)).toBe('197,00')
    expect(valorParaConfirmar(197000)).toBe('1970,00')
    expect(valorParaConfirmar(50)).toBe('0,50')
  })

  it.each([
    ['197,00', true],
    ['197', true],
    ['197.00', true],
    ['R$ 197,00', true],
    [' 197,00 ', true],
  ])('aceita %s como confirmação de R$ 197,00', (digitado, esperado) => {
    expect(confirmacaoConfere(digitado, 19700)).toBe(esperado)
  })

  it.each(['', '   ', '19700', '196,99', '197,01', '1,97', 'reembolsar', 'R$'])(
    'recusa %s',
    (digitado) => {
      expect(confirmacaoConfere(digitado, 19700)).toBe(false)
    }
  )

  it('não confunde milhar com decimal', () => {
    expect(confirmacaoConfere('1.970,00', 197000)).toBe(true)
    expect(confirmacaoConfere('1.970', 197000)).toBe(true)
    expect(confirmacaoConfere('1.970', 19700)).toBe(false)
  })

  it('devolve null quando não há número para ler', () => {
    expect(centavosDigitados('abc')).toBeNull()
    expect(centavosDigitados('')).toBeNull()
  })

  it('um valor certo de OUTRO pedido não libera este', () => {
    // O texto de confirmação é o valor DESTE pedido; digitar o do vizinho
    // (memória muscular de quem reembolsa em série) tem de barrar.
    expect(confirmacaoConfere('197,00', 9700)).toBe(false)
  })
})

describe('entregaDoPedido', () => {
  const agora = new Date('2026-09-08T14:00:00.000Z')

  it('mostra entregue quando há carimbo do worker', () => {
    const meta = entregaDoPedido(
      pedido({ entregue_em: '2026-09-08T12:05:00.000Z' }),
      agora
    )
    expect(meta.estado).toBe('entregue')
    expect(meta.alerta).toBe(false)
  })

  it('aceita o plano gerado como prova de entrega', () => {
    const meta = entregaDoPedido(
      pedido({ plano_gerado_em: '2026-09-08T12:05:00.000Z' }),
      agora
    )
    expect(meta.estado).toBe('entregue')
  })

  it('denuncia quem pagou há mais de uma hora e não recebeu', () => {
    const meta = entregaDoPedido(pedido(), agora)
    expect(meta.estado).toBe('atrasada')
    expect(meta.alerta).toBe(true)
  })

  it('não cobra entrega de pedido que ninguém pagou', () => {
    const meta = entregaDoPedido(pedido({ status: 'aguardando' }), agora)
    expect(meta.estado).toBe('nada_a_entregar')
    expect(meta.alerta).toBe(false)
  })

  it('espera sem alarme dentro da primeira hora', () => {
    const meta = entregaDoPedido(pedido(), new Date('2026-09-08T12:30:00.000Z'))
    expect(meta.estado).toBe('pendente')
    expect(meta.alerta).toBe(false)
  })
})

describe('o que a tela mostra para decidir', () => {
  it('reconhece recebível no pedido ou em um item', () => {
    expect(temRecebivel(pedido())).toBe(false)
    expect(temRecebivel(pedido({ receivable_id: 'rec-1' }))).toBe(true)
    expect(
      temRecebivel(pedido({ itens: [{ ...ITEM, receivable_id: 'rec-2' }] }))
    ).toBe(true)
  })

  it('deduz o método só quando há sinal — nunca chuta cartão', () => {
    expect(metodoDoPedido(pedido({ mp_card_id: 'card-1' }))).toBe('cartao')
    expect(metodoDoPedido(pedido({ desconto_metodo_centavos: 1000 }))).toBe('pix')
    expect(metodoDoPedido(pedido())).toBe('desconhecido')
  })

  it('resume os itens pagos em uma linha', () => {
    expect(resumoDosItens(pedido())).toBe('Plano de Correção')
    expect(
      resumoDosItens(
        pedido({ itens: [ITEM, { ...ITEM, nome: 'Bônus', tipo: 'bump' }] })
      )
    ).toBe('Plano de Correção + 1 item')
  })

  it('mostra o que foi tentado quando nada foi pago', () => {
    expect(resumoDosItens(pedido({ itens: [{ ...ITEM, pago: false }] }))).toBe(
      'Plano de Correção'
    )
  })

  it('dá rótulo legível a todos os status do check constraint', () => {
    expect(pedidoStatusMeta('pago').label).toBe('Pago')
    expect(pedidoStatusMeta('reembolsado').label).toBe('Reembolsado')
    // Status novo no banco não pode virar pill em branco.
    expect(pedidoStatusMeta('chargeback').label).toBe('chargeback')
  })
})

describe('resumoDosPedidos', () => {
  it('tira o reembolsado da receita e o conta à parte', () => {
    const resumo = resumoDosPedidos([
      pedido({ id: '1', status: 'pago' }),
      pedido({ id: '2', status: 'pago' }),
      pedido({ id: '3', status: 'reembolsado' }),
      pedido({ id: '4', status: 'aguardando' }),
      pedido({ id: '5', status: 'recusado' }),
    ])
    expect(resumo.pagos).toBe(2)
    expect(resumo.receitaCentavos).toBe(39400)
    expect(resumo.aguardando).toBe(1)
    expect(resumo.reembolsados).toBe(1)
    expect(resumo.reembolsadoCentavos).toBe(19700)
  })

  it('devolve zeros sem pedidos', () => {
    expect(resumoDosPedidos([])).toEqual({
      pagos: 0,
      receitaCentavos: 0,
      aguardando: 0,
      reembolsados: 0,
      reembolsadoCentavos: 0,
    })
  })
})

describe('parseItens — jsonb solto do banco', () => {
  it('lê o snapshot que a edge function grava', () => {
    expect(
      parseItens([
        {
          produto_id: 'p1',
          nome: 'Plano',
          tipo: 'principal',
          preco_centavos: 19700,
          pago: true,
          entrega: 'plano_scan',
        },
      ])
    ).toEqual([
      {
        produto_id: 'p1',
        nome: 'Plano',
        tipo: 'principal',
        preco_centavos: 19700,
        pago: true,
        entrega: 'plano_scan',
        receivable_id: null,
      },
    ])
  })

  it('não quebra com jsonb malformado', () => {
    expect(parseItens(null)).toEqual([])
    expect(parseItens('nada disso')).toEqual([])
    expect(parseItens([null, 3, 'x'])).toEqual([])
  })

  it('completa o item incompleto em vez de descartar a venda', () => {
    const [item] = parseItens([{ preco_centavos: 900 }])
    expect(item.nome).toBe('Item sem nome')
    expect(item.preco_centavos).toBe(900)
    expect(item.pago).toBe(false)
  })
})
