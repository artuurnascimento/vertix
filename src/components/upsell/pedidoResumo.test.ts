import { describe, expect, test } from 'vitest'
import {
  ehPlanoDeCorrecao,
  montarResumo,
  planoScanUrl,
  situacaoDoPedido,
  somarTotal,
  temCartaoSalvo,
} from './pedidoResumo'
import type { CheckoutInfo } from './upsellFluxo'

const INFO: CheckoutInfo = {
  checkout: { upsell_produto_id: 'p2' },
  produto: { id: 'p1', nome: 'Plano de Correção', preco_centavos: 19700 },
  bump: { id: 'pb', nome: 'Auditoria de anúncios', preco_centavos: 4700 },
}

const UPSELL = {
  produtoId: 'p2',
  nome: 'Acompanhamento 30 dias',
  precoCentavos: 9700,
}

describe('montarResumo — itens vindos do banco', () => {
  test('o banco manda e o resumo não é marcado como parcial', () => {
    const resumo = montarResumo({
      info: INFO,
      pedido: {
        email: 'ana@loja.com',
        total_centavos: 24400,
        itens: [
          { id: 'p1', nome: 'Plano de Correção', preco_centavos: 19700, tipo: 'principal' },
          { id: 'pb', nome: 'Auditoria de anúncios', preco_centavos: 4700, tipo: 'bump' },
        ],
      },
      upsellAceito: null,
    })

    expect(resumo.parcial).toBe(false)
    expect(resumo.itens.map((i) => i.nome)).toEqual([
      'Plano de Correção',
      'Auditoria de anúncios',
    ])
    expect(resumo.totalCentavos).toBe(24400)
    expect(resumo.email).toBe('ana@loja.com')
  })

  test('o upsell recém-cobrado entra mesmo se o pedido ainda não o tem', () => {
    const resumo = montarResumo({
      info: INFO,
      pedido: {
        itens: [{ id: 'p1', nome: 'Plano de Correção', preco_centavos: 19700 }],
      },
      upsellAceito: UPSELL,
      totalDaCobranca: 29400,
    })

    expect(resumo.itens).toHaveLength(2)
    expect(resumo.itens[1]).toMatchObject({ tipo: 'upsell', precoCentavos: 9700 })
    expect(resumo.totalCentavos).toBe(29400)
  })

  test('não duplica o upsell quando o pedido já o traz', () => {
    const resumo = montarResumo({
      info: INFO,
      pedido: {
        itens: [{ id: 'p2', nome: 'Acompanhamento 30 dias', preco_centavos: 9700, tipo: 'upsell' }],
      },
      upsellAceito: UPSELL,
    })
    expect(resumo.itens).toHaveLength(1)
  })
})

describe('montarResumo — reconstrução pela sessão', () => {
  test('sem pedido no banco usa o produto do checkout e marca parcial', () => {
    const resumo = montarResumo({ info: INFO, pedido: null, upsellAceito: null })
    expect(resumo.parcial).toBe(true)
    expect(resumo.itens.map((i) => i.nome)).toEqual(['Plano de Correção'])
    expect(resumo.totalCentavos).toBe(19700)
  })

  test('o order bump só aparece quando o pedido confirma que foi aceito', () => {
    const semBump = montarResumo({ info: INFO, pedido: {}, upsellAceito: null })
    expect(semBump.itens).toHaveLength(1)

    const comBump = montarResumo({
      info: INFO,
      pedido: { bump_aceito: true },
      upsellAceito: null,
    })
    expect(comBump.itens.map((i) => i.tipo)).toEqual(['principal', 'bump'])
    expect(comBump.totalCentavos).toBe(24400)
  })

  test('sem informação nenhuma o resumo fica vazio em vez de inventar item', () => {
    const resumo = montarResumo({ info: null, pedido: null, upsellAceito: null })
    expect(resumo.itens).toEqual([])
  })
})

describe('somarTotal', () => {
  test('um preço desconhecido derruba o total — total errado é pior que nenhum', () => {
    expect(
      somarTotal([
        { id: 'a', nome: 'A', precoCentavos: 1000, tipo: 'principal' },
        { id: 'b', nome: 'B', precoCentavos: null, tipo: 'upsell' },
      ])
    ).toBeNull()
  })

  test('soma normal', () => {
    expect(
      somarTotal([
        { id: 'a', nome: 'A', precoCentavos: 1000, tipo: 'principal' },
        { id: 'b', nome: 'B', precoCentavos: 250, tipo: 'bump' },
      ])
    ).toBe(1250)
  })
})

describe('Plano de Correção do Scan', () => {
  test('reconhece o produto pelo nome', () => {
    expect(
      ehPlanoDeCorrecao([
        { id: 'p1', nome: 'Plano de Correção', precoCentavos: 19700, tipo: 'principal' },
      ])
    ).toBe(true)
    expect(
      ehPlanoDeCorrecao([
        { id: 'x', nome: 'Consultoria avulsa', precoCentavos: 100, tipo: 'principal' },
      ])
    ).toBe(false)
  })

  test('com código monta o link do plano; sem código cai no site do Scan', () => {
    expect(planoScanUrl('abc123')).toMatch(/\/plano\/abc123$/)
    expect(planoScanUrl(null)).not.toContain('/plano/')
  })
})

describe('temCartaoSalvo', () => {
  test('só afirma quando o pedido diz que tem E entrega o id do cartão', () => {
    expect(temCartaoSalvo({ tem_cartao_salvo: true, card_id: 'card_1' })).toBe(
      true
    )
  })

  test('sem id não dá para tokenizar, então não conta como cartão salvo', () => {
    expect(temCartaoSalvo({ tem_cartao_salvo: true, card_id: null })).toBe(false)
  })

  test('quem pagou por Pix não tem cartão salvo', () => {
    expect(temCartaoSalvo({ tem_cartao_salvo: false, card_id: null })).toBe(
      false
    )
  })

  test('status ausente conta como SEM cartão — "não sei" nunca vira "sim"', () => {
    expect(temCartaoSalvo(null)).toBe(false)
    expect(temCartaoSalvo(undefined)).toBe(false)
    expect(temCartaoSalvo({})).toBe(false)
  })
})

describe('situacaoDoPedido', () => {
  /*
   * O bug que estes testes existem para impedir: a confirmação anunciava
   * "Compra confirmada" para QUALQUER pedido, inclusive um Pix gerado e nunca
   * pago. A pessoa fechava o código achando que tinha terminado, o produto não
   * chegava, e uma venda pendente virava reclamação de quem tinha certeza de
   * ter pago.
   */
  test('só um pagamento confirmado autoriza dizer que está pago', () => {
    expect(situacaoDoPedido('pago')).toBe('pago')
    expect(situacaoDoPedido('aprovado')).toBe('pago')
  })

  test('Pix gerado e não pago fica AGUARDANDO, nunca confirmado', () => {
    expect(situacaoDoPedido('aguardando')).toBe('aguardando')
    expect(situacaoDoPedido('pendente')).toBe('aguardando')
  })

  test('recusa e reembolso têm cara própria', () => {
    expect(situacaoDoPedido('recusado')).toBe('recusado')
    expect(situacaoDoPedido('rejeitado')).toBe('recusado')
    expect(situacaoDoPedido('reembolsado')).toBe('reembolsado')
  })

  test.each([undefined, null, '', '   ', 'qualquer-coisa'])(
    'sem status confiável (%j) não afirma pagamento',
    (valor) => {
      expect(situacaoDoPedido(valor)).toBe('desconhecido')
    }
  )

  test('não se importa com caixa nem espaço em volta', () => {
    expect(situacaoDoPedido('  PAGO  ')).toBe('pago')
    expect(situacaoDoPedido('Aguardando')).toBe('aguardando')
  })
})
