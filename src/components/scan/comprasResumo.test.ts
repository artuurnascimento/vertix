import { describe, expect, test } from 'vitest'
import {
  ATRASO_ENTREGA_MS,
  compraStatusMeta,
  concorrentesInformados,
  entregaDaCompra,
  formatCentavos,
  resumoDasCompras,
  taxaDeConversao,
  totaisDaVenda,
} from './comprasResumo'
import type { ScanCompra } from './comprasData'

/**
 * Testes das contas da visão de vendas do Vertix Scan (comprasResumo.ts).
 * Funções puras: sem rede e sem banco. Arquivo de teste, roda no Vitest.
 */

const AGORA = new Date('2026-09-07T12:00:00Z')

function compra(over: Partial<ScanCompra> = {}): ScanCompra {
  return {
    id: 'c1',
    criado_em: '2026-09-07T11:00:00Z',
    status: 'pago',
    valor_centavos: 19700,
    dominio: 'loja-exemplo.com.br',
    comprador: 'Maria',
    email: 'maria@exemplo.com',
    plano_code: 'abc123abc123',
    plano_gerado_em: '2026-09-07T11:02:00Z',
    recibo_enviado_em: '2026-09-07T11:03:00Z',
    pago_em: '2026-09-07T11:00:30Z',
    concorrentes: null,
    reanalise_agendada_em: null,
    reanalise_analysis_id: null,
    receivable_id: 'rec-1',
    reembolsado_em: null,
    total_centavos: over.valor_centavos ?? 19700,
    extras: [],
    ...over,
  }
}

describe('resumoDasCompras', () => {
  test('conta só as pagas na receita e separa os abandonos', () => {
    const r = resumoDasCompras([
      compra({ id: 'a', status: 'pago', valor_centavos: 19700 }),
      compra({ id: 'b', status: 'pago', valor_centavos: 19700 }),
      compra({ id: 'c', status: 'aguardando_pagamento', valor_centavos: 19700 }),
      compra({ id: 'd', status: 'cancelado', valor_centavos: 19700 }),
      compra({ id: 'e', status: 'reembolsado', valor_centavos: 19700 }),
    ])
    expect(r.pagas).toBe(2)
    expect(r.receitaCentavos).toBe(39400)
    expect(r.aguardando).toBe(1)
  })

  test('a receita é o que foi pago: com order bump o pedido vale mais que o plano', () => {
    const r = resumoDasCompras([
      compra({ id: 'a', status: 'pago', valor_centavos: 19700, total_centavos: 24400 }),
      compra({ id: 'b', status: 'reembolsado', valor_centavos: 19700, total_centavos: 24400 }),
    ])
    expect(r.receitaCentavos).toBe(24400)
  })

  test('lista vazia devolve zeros', () => {
    expect(resumoDasCompras([])).toEqual({
      pagas: 0,
      receitaCentavos: 0,
      aguardando: 0,
    })
  })
})

describe('taxaDeConversao', () => {
  test('vendas pagas sobre leads do período', () => {
    expect(taxaDeConversao(3, 100)).toBe('3,0%')
    expect(taxaDeConversao(1, 3)).toBe('33,3%')
  })

  test('sem lead no período não existe taxa', () => {
    expect(taxaDeConversao(0, 0)).toBe('—')
    expect(taxaDeConversao(2, 0)).toBe('—')
  })
})

describe('entregaDaCompra', () => {
  test('plano gerado e recibo enviado é entrega completa', () => {
    const e = entregaDaCompra(compra(), AGORA)
    expect(e.estado).toBe('entregue')
    expect(e.alerta).toBe(false)
  })

  test('plano gerado sem recibo ainda não alerta', () => {
    const e = entregaDaCompra(compra({ recibo_enviado_em: null }), AGORA)
    expect(e.estado).toBe('recibo_pendente')
    expect(e.alerta).toBe(false)
  })

  test('pago há pouco e sem plano: ainda está gerando', () => {
    const e = entregaDaCompra(
      compra({
        plano_gerado_em: null,
        recibo_enviado_em: null,
        pago_em: new Date(AGORA.getTime() - ATRASO_ENTREGA_MS / 2).toISOString(),
      }),
      AGORA
    )
    expect(e.estado).toBe('gerando')
    expect(e.alerta).toBe(false)
  })

  test('pago há mais de 1 hora e sem plano é o estado grave', () => {
    const e = entregaDaCompra(
      compra({
        plano_gerado_em: null,
        recibo_enviado_em: null,
        pago_em: new Date(AGORA.getTime() - ATRASO_ENTREGA_MS - 1000).toISOString(),
      }),
      AGORA
    )
    expect(e.estado).toBe('atrasada')
    expect(e.alerta).toBe(true)
    expect(e.label).toMatch(/não recebeu/i)
  })

  test('sem pago_em o atraso é medido pela data da compra', () => {
    const e = entregaDaCompra(
      compra({
        plano_gerado_em: null,
        recibo_enviado_em: null,
        pago_em: null,
        criado_em: '2026-09-07T09:00:00Z',
      }),
      AGORA
    )
    expect(e.estado).toBe('atrasada')
  })

  test('checkout abandonado não é entrega atrasada', () => {
    const e = entregaDaCompra(
      compra({
        status: 'aguardando_pagamento',
        plano_gerado_em: null,
        recibo_enviado_em: null,
        pago_em: null,
        criado_em: '2026-09-01T09:00:00Z',
      }),
      AGORA
    )
    expect(e.estado).toBe('sem_pagamento')
    expect(e.alerta).toBe(false)
  })
})

describe('concorrentesInformados', () => {
  test('o bônus só está completo com os dois concorrentes', () => {
    expect(concorrentesInformados(compra({ concorrentes: null }))).toBe(false)
    expect(concorrentesInformados(compra({ concorrentes: ['a.com'] }))).toBe(false)
    expect(
      concorrentesInformados(compra({ concorrentes: ['a.com', '  '] }))
    ).toBe(false)
    expect(
      concorrentesInformados(compra({ concorrentes: ['a.com', 'b.com'] }))
    ).toBe(true)
  })
})

describe('formatCentavos e compraStatusMeta', () => {
  test('centavos viram reais', () => {
    expect(formatCentavos(19700).replace(/ /g, ' ')).toBe('R$ 197,00')
  })

  test('status desconhecido não quebra a pill', () => {
    expect(compraStatusMeta('pago').label).toBe('Pago')
    expect(compraStatusMeta('estranho').label).toBe('estranho')
  })
})

describe('totaisDaVenda', () => {
  test('com pedido: o total é o do pedido e os extras são os itens pagos além do principal', () => {
    const pedido = {
        total_centavos: 24400,
        itens: [
          { nome: 'Plano de Correção', tipo: 'principal', preco_centavos: 19700, pago: true },
          { nome: 'Acompanhamento de 30 dias', tipo: 'bump', preco_centavos: 4700, pago: true },
          { nome: 'Correção Aplicada', tipo: 'upsell', preco_centavos: 149700, pago: false },
        ],
      }
    expect(totaisDaVenda({ valor_centavos: 19700, status: 'pago' }, pedido)).toEqual({
      total_centavos: 24400,
      extras: [{ nome: 'Acompanhamento de 30 dias', preco_centavos: 4700 }],
    })
    // O checkout abandonado da mesma análise não herda o pedido pago de outra tentativa.
    expect(totaisDaVenda({ valor_centavos: 19700, status: 'aguardando_pagamento' }, pedido)).toEqual({
      total_centavos: 19700,
      extras: [],
    })
  })

  test('sem pedido (fluxo antigo): o total é o plano, sem extras', () => {
    expect(totaisDaVenda({ valor_centavos: 19700, status: 'pago' }, null)).toEqual({ total_centavos: 19700, extras: [] })
    expect(totaisDaVenda({ valor_centavos: 19700, status: 'pago' }, undefined).extras).toEqual([])
  })
})
