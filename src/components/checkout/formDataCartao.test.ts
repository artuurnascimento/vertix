/**
 * O teste que impede o bug de dinheiro nº 1.
 *
 * O servidor faz `installments = formData.installments ?? 1`. Um payload sem
 * `installments`, ou com `installments` que não é inteiro, cobra à vista quem
 * escolheu 12x — sem erro e sem log. Nenhuma dessas asserções pode ser
 * relaxada "porque o TypeScript já garante": o valor vem de um <select> e de
 * estado que muda no meio do clique, e o `as unknown as number` de vários
 * casos abaixo é justamente o formato em que ele chega em produção.
 */

import { describe, expect, it } from 'vitest'
import {
  ERRO_METODO_INDEFINIDO,
  ERRO_PARCELAMENTO_INDEFINIDO,
  ERRO_TOKEN_AUSENTE,
  montarFormDataCartao,
  sobrenomeDe,
  type EntradaFormDataCartao,
} from './formDataCartao'

/** Entrada mínima válida; cada teste sobrescreve só o que investiga. */
function entrada(
  mudancas: Partial<EntradaFormDataCartao> = {}
): EntradaFormDataCartao {
  return {
    paymentMethodId: 'visa',
    token: 'a1b2c3d4e5f6',
    installments: 1,
    issuerId: null,
    nomeCompleto: 'Maria Silva',
    ...mudancas,
  }
}

/** Açúcar para os casos que só existem em runtime (NaN, string, undefined). */
function comParcelas(valor: unknown): EntradaFormDataCartao {
  return entrada({ installments: valor as number })
}

describe('montarFormDataCartao — installments (bug de dinheiro nº 1)', () => {
  it('sempre emite a chave installments, mesmo à vista', () => {
    const payload = montarFormDataCartao(comParcelas(1))
    // `toHaveProperty` passaria com `undefined`; o que importa é a chave
    // EXISTIR com valor, porque é a ausência que aciona o `?? 1` do servidor.
    expect(Object.keys(payload)).toContain('installments')
    expect(payload.installments).toBe(1)
  })

  it('preserva a parcela escolhida', () => {
    expect(montarFormDataCartao(comParcelas(12)).installments).toBe(12)
    expect(montarFormDataCartao(comParcelas(18)).installments).toBe(18)
    expect(montarFormDataCartao(comParcelas(2)).installments).toBe(2)
  })

  it('aborta quando installments é undefined', () => {
    expect(() => montarFormDataCartao(comParcelas(undefined))).toThrow(
      ERRO_PARCELAMENTO_INDEFINIDO
    )
  })

  it('aborta quando installments é null', () => {
    expect(() => montarFormDataCartao(comParcelas(null))).toThrow(
      ERRO_PARCELAMENTO_INDEFINIDO
    )
  })

  it('aborta quando installments é 0', () => {
    expect(() => montarFormDataCartao(comParcelas(0))).toThrow(
      ERRO_PARCELAMENTO_INDEFINIDO
    )
  })

  it('aborta quando installments é negativo', () => {
    expect(() => montarFormDataCartao(comParcelas(-3))).toThrow(
      ERRO_PARCELAMENTO_INDEFINIDO
    )
  })

  it('aborta quando installments é NaN', () => {
    // `Number('')` e `Number('doze')` chegam assim de um <select> mal lido.
    expect(() => montarFormDataCartao(comParcelas(Number.NaN))).toThrow(
      ERRO_PARCELAMENTO_INDEFINIDO
    )
  })

  it('aborta quando installments é Infinity', () => {
    expect(() => montarFormDataCartao(comParcelas(Number.POSITIVE_INFINITY))).toThrow(
      ERRO_PARCELAMENTO_INDEFINIDO
    )
  })

  it('aborta quando installments é fracionário', () => {
    expect(() => montarFormDataCartao(comParcelas(1.5))).toThrow(
      ERRO_PARCELAMENTO_INDEFINIDO
    )
  })

  it('aborta quando installments é string, mesmo string numérica', () => {
    // O `value` de um <select> é string. Um esquecimento de Number() aqui
    // viraria `"12"` no JSON e o servidor cobraria... "12" parcelas? Não: o
    // MP recusaria ou o `?? 1` nem entraria. Abortamos antes de descobrir.
    expect(() => montarFormDataCartao(comParcelas('12'))).toThrow(
      ERRO_PARCELAMENTO_INDEFINIDO
    )
    expect(() => montarFormDataCartao(comParcelas('1'))).toThrow(
      ERRO_PARCELAMENTO_INDEFINIDO
    )
  })

  it('aborta com o motivo nomeado, não com uma mensagem qualquer', () => {
    expect(() => montarFormDataCartao(comParcelas(0))).toThrow(
      new Error('parcelamento_indefinido')
    )
  })
})

describe('montarFormDataCartao — contrato com o servidor', () => {
  it('produz exatamente as chaves da whitelist, e nada mais', () => {
    const payload = montarFormDataCartao(
      entrada({ installments: 12, issuerId: '26', nomeCompleto: 'Maria Silva' })
    )
    expect(Object.keys(payload).sort()).toEqual([
      'installments',
      'issuer_id',
      'payer',
      'payment_method_id',
      'token',
    ])
  })

  it('nunca inclui valor de cobrança', () => {
    const payload = montarFormDataCartao(
      entrada({ installments: 12 })
    ) as unknown as Record<string, unknown>
    // O preço sai do catálogo no servidor. Um campo de valor vindo do
    // navegador deixaria o comprador escolher quanto pagar.
    for (const proibida of [
      'transaction_amount',
      'amount',
      'total_amount',
      'total_centavos',
      'valor',
    ]) {
      expect(payload[proibida]).toBeUndefined()
    }
  })

  it('sobrevive ao JSON sem virar undefined em campo obrigatório', () => {
    const payload = montarFormDataCartao(entrada({ installments: 6 }))
    const round = JSON.parse(JSON.stringify(payload)) as Record<string, unknown>
    expect(round.installments).toBe(6)
    expect(round.token).toBe('a1b2c3d4e5f6')
    expect(round.payment_method_id).toBe('visa')
  })

  it('leva a bandeira como payment_method_id', () => {
    expect(montarFormDataCartao(entrada({ paymentMethodId: 'amex' })).payment_method_id).toBe(
      'amex'
    )
    expect(montarFormDataCartao(entrada({ paymentMethodId: 'master' })).payment_method_id).toBe(
      'master'
    )
  })

  it('aborta sem payment_method_id — o servidor devolveria 400', () => {
    expect(() => montarFormDataCartao(entrada({ paymentMethodId: null }))).toThrow(
      ERRO_METODO_INDEFINIDO
    )
    expect(() => montarFormDataCartao(entrada({ paymentMethodId: undefined }))).toThrow(
      ERRO_METODO_INDEFINIDO
    )
    expect(() => montarFormDataCartao(entrada({ paymentMethodId: '' }))).toThrow(
      ERRO_METODO_INDEFINIDO
    )
    expect(() => montarFormDataCartao(entrada({ paymentMethodId: '   ' }))).toThrow(
      ERRO_METODO_INDEFINIDO
    )
  })

  it('aborta sem token — sem ele o pedido nasce recusado no servidor', () => {
    expect(() => montarFormDataCartao(entrada({ token: null }))).toThrow(
      ERRO_TOKEN_AUSENTE
    )
    expect(() => montarFormDataCartao(entrada({ token: undefined }))).toThrow(
      ERRO_TOKEN_AUSENTE
    )
    expect(() => montarFormDataCartao(entrada({ token: '' }))).toThrow(
      ERRO_TOKEN_AUSENTE
    )
    expect(() => montarFormDataCartao(entrada({ token: '  ' }))).toThrow(
      ERRO_TOKEN_AUSENTE
    )
  })

  it('remove espaços de método e token', () => {
    const payload = montarFormDataCartao(
      entrada({ paymentMethodId: ' visa ', token: ' tok_1 ' })
    )
    expect(payload.payment_method_id).toBe('visa')
    expect(payload.token).toBe('tok_1')
  })
})

describe('montarFormDataCartao — issuer_id', () => {
  it('omite a chave quando não há emissor', () => {
    for (const vazio of [null, undefined, '', '   ']) {
      const payload = montarFormDataCartao(entrada({ issuerId: vazio }))
      // O servidor testa `!= null`: uma string vazia PASSARIA e mandaria
      // emissor em branco para o Mercado Pago.
      expect(Object.keys(payload)).not.toContain('issuer_id')
    }
  })

  it('preserva número como número', () => {
    const payload = montarFormDataCartao(entrada({ issuerId: 26 }))
    expect(payload.issuer_id).toBe(26)
  })

  it('preserva string como string — nunca converte de tipo', () => {
    const payload = montarFormDataCartao(entrada({ issuerId: '26' }))
    expect(payload.issuer_id).toBe('26')
    // `getPaymentMethods` devolve 26 e `getInstallments` devolve "26". Quem
    // converter aqui inventa um tipo que nenhuma das pontas combinou.
    expect(payload.issuer_id).not.toBe(26)
  })

  it('omite emissor numérico inutilizável', () => {
    for (const lixo of [Number.NaN, Number.POSITIVE_INFINITY]) {
      const payload = montarFormDataCartao(entrada({ issuerId: lixo }))
      expect(Object.keys(payload)).not.toContain('issuer_id')
    }
  })
})

describe('montarFormDataCartao — payer.last_name', () => {
  it('manda o resto do nome depois do primeiro espaço', () => {
    expect(
      montarFormDataCartao(entrada({ nomeCompleto: 'Maria Silva Santos' })).payer
    ).toEqual({ last_name: 'Silva Santos' })
  })

  it('omite payer inteiro quando não há sobrenome', () => {
    for (const semSobrenome of ['Maria', '  Maria  ', '', '   ', null, undefined]) {
      const payload = montarFormDataCartao(entrada({ nomeCompleto: semSobrenome }))
      expect(Object.keys(payload)).not.toContain('payer')
    }
  })

  it('não deixa espaço colado no sobrenome', () => {
    expect(
      montarFormDataCartao(entrada({ nomeCompleto: '  Maria   Silva  ' })).payer
    ).toEqual({ last_name: 'Silva' })
  })
})

describe('sobrenomeDe', () => {
  it('devolve tudo depois do primeiro nome', () => {
    expect(sobrenomeDe('Ana Paula de Souza')).toBe('Paula de Souza')
  })

  it('devolve vazio para nome único', () => {
    expect(sobrenomeDe('Ana')).toBe('')
    expect(sobrenomeDe('   Ana   ')).toBe('')
  })

  it('devolve vazio para entrada vazia', () => {
    expect(sobrenomeDe('')).toBe('')
    expect(sobrenomeDe('    ')).toBe('')
  })

  it('colapsa espaços repetidos', () => {
    expect(sobrenomeDe('Ana    Paula')).toBe('Paula')
    expect(sobrenomeDe('Ana\tPaula\nSouza')).toBe('Paula Souza')
  })
})
