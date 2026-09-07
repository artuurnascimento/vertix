import { describe, expect, test } from 'vitest'
import {
  CODIGO_BUG_CVV,
  ehBugDeContrato,
  formatarCentavos,
  mensagemErroUpsell,
  precisaCvv,
  precoDaOferta,
  proximaEtapaAoRecusar,
  resolverOferta,
} from './upsellFluxo'
import type { CheckoutInfo } from './upsellFluxo'

const PRINCIPAL = { id: 'p1', nome: 'Plano de Correção', preco_centavos: 19700 }
const EXTRA = { id: 'p2', nome: 'Acompanhamento 30 dias', preco_centavos: 9700 }
const BARATO = { id: 'p3', nome: 'Checklist express', preco_centavos: 4700 }

function info(overrides: Partial<CheckoutInfo> = {}): CheckoutInfo {
  return {
    checkout: {
      upsell_produto_id: 'p2',
      upsell_titulo: 'Leve o acompanhamento',
      upsell_texto: 'Trinta dias de ajustes com a gente.',
      downsell_produto_id: 'p3',
      downsell_titulo: 'Só o checklist, então',
      downsell_texto: null,
      ...overrides.checkout,
    },
    produto: PRINCIPAL,
    bump: null,
    ...overrides,
  }
}

describe('resolverOferta', () => {
  test('devolve null quando a etapa não tem produto configurado', () => {
    const semUpsell = info({ checkout: { upsell_produto_id: null } })
    expect(resolverOferta(semUpsell, 'upsell')).toBeNull()
  })

  test('devolve null na etapa fim e sem informação de checkout', () => {
    expect(resolverOferta(info(), 'fim')).toBeNull()
    expect(resolverOferta(null, 'upsell')).toBeNull()
  })

  test('usa título e texto da configuração e o preço do produto direto', () => {
    const oferta = resolverOferta(info({ upsell_produto: EXTRA }), 'upsell')
    expect(oferta).toMatchObject({
      etapa: 'upsell',
      produtoId: 'p2',
      titulo: 'Leve o acompanhamento',
      texto: 'Trinta dias de ajustes com a gente.',
      nomeProduto: 'Acompanhamento 30 dias',
      precoCentavos: 9700,
    })
  })

  test('acha o produto da oferta dentro da lista de produtos', () => {
    const oferta = resolverOferta(info({ produtos: [EXTRA, BARATO] }), 'downsell')
    expect(oferta?.precoCentavos).toBe(4700)
    expect(oferta?.nomeProduto).toBe('Checklist express')
  })

  test('cai para um título padrão quando a configuração não tem título', () => {
    const semTitulo = info({
      checkout: { upsell_produto_id: 'p2', upsell_titulo: null },
    })
    expect(resolverOferta(semTitulo, 'upsell')?.titulo).toBe(
      'Uma última oportunidade'
    )
  })

  test('sem preço conhecido a oferta sai com precoCentavos null', () => {
    const oferta = resolverOferta(info(), 'upsell')
    expect(oferta?.precoCentavos).toBeNull()
  })
})

describe('precoDaOferta', () => {
  test('prefere o preço do produto ao da configuração', () => {
    const comAmbos = info({
      checkout: { upsell_produto_id: 'p2', upsell_preco_centavos: 100 },
    })
    expect(precoDaOferta(comAmbos, 'upsell', EXTRA)).toBe(9700)
  })

  test('usa o preço da configuração quando não há produto', () => {
    const soConfig = info({
      checkout: { upsell_produto_id: 'p2', upsell_preco_centavos: 5500 },
    })
    expect(precoDaOferta(soConfig, 'upsell', null)).toBe(5500)
  })
})

describe('proximaEtapaAoRecusar', () => {
  test('recusar o upsell leva ao downsell quando ele existe', () => {
    expect(proximaEtapaAoRecusar('upsell', info())).toBe('downsell')
  })

  test('recusar o upsell sem downsell configurado vai para a confirmação', () => {
    const semDownsell = info({
      checkout: { upsell_produto_id: 'p2', downsell_produto_id: null },
    })
    expect(proximaEtapaAoRecusar('upsell', semDownsell)).toBe('fim')
  })

  test('recusar o downsell sempre encerra — não insistimos uma terceira vez', () => {
    expect(proximaEtapaAoRecusar('downsell', info())).toBe('fim')
  })
})

describe('precisaCvv', () => {
  test('resposta aprovada nunca pede o código de novo', () => {
    expect(precisaCvv({ ok: true, total_centavos: 9700 })).toBe(false)
  })

  test('reconhece as falhas de código de segurança', () => {
    expect(precisaCvv({ ok: false, erro: 'cvv_invalido' })).toBe(true)
    expect(precisaCvv({ ok: false, erro: 'security_code_required' })).toBe(true)
    expect(
      precisaCvv({ ok: false, erro: 'cc_rejected_bad_filled_security_code' })
    ).toBe(true)
  })

  test('cvv_nao_aceito NÃO pede o código — é bug nosso, não da pessoa', () => {
    const bug = { ok: false, erro: CODIGO_BUG_CVV }
    expect(precisaCvv(bug)).toBe(false)
    expect(ehBugDeContrato(bug)).toBe(true)
  })

  test('outro erro qualquer não vira pedido de código', () => {
    expect(precisaCvv({ ok: false, erro: 'cartao_recusado' })).toBe(false)
    expect(precisaCvv(null)).toBe(false)
    expect(ehBugDeContrato({ ok: false, erro: 'cartao_recusado' })).toBe(false)
  })
})

describe('mensagemErroUpsell', () => {
  test('erro desconhecido garante que nada foi cobrado duas vezes', () => {
    const mensagem = mensagemErroUpsell({ ok: false, erro: 'coisa_estranha' })
    expect(mensagem).toContain('compra anterior segue confirmada')
    expect(mensagem).toContain('nada foi cobrado agora')
  })

  test('erro conhecido tem texto próprio', () => {
    expect(mensagemErroUpsell({ ok: false, erro: 'cvv_invalido' })).toContain(
      'Código de segurança incorreto'
    )
  })

  test('o bug de contrato não expõe jargão nem culpa a pessoa', () => {
    const mensagem = mensagemErroUpsell({ ok: false, erro: CODIGO_BUG_CVV })
    expect(mensagem).toContain('problema nosso')
    expect(mensagem).toContain('nada foi cobrado agora')
    expect(mensagem.toLowerCase()).not.toContain('cvv')
  })
})

describe('formatação', () => {
  test('centavos viram moeda pt-BR', () => {
    expect(formatarCentavos(19700).replace(/\s/g, ' ')).toBe('R$ 197,00')
  })

  test('valor desconhecido não vira R$ 0,00 nem NaN', () => {
    expect(formatarCentavos(null)).toBe('—')
    expect(formatarCentavos(Number.NaN)).toBe('—')
  })
})
