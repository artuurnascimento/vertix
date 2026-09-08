import { afterEach, describe, expect, it, vi } from 'vitest'
import { usarFormularioNovo } from './flagFormularioNovo'

/**
 * A regra que estes testes protegem é a única inegociável da migração: **com a
 * flag ausente, o checkout é o de hoje.** O Payment Brick está vendendo; um
 * default invertido aqui trocaria o formulário de pagamento de 100% do tráfego
 * sem ninguém pedir, e o sintoma chegaria como queda de conversão, não como
 * erro no console.
 */
describe('usarFormularioNovo', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('nasce DESLIGADA: sem query e sem env, é o Brick', () => {
    expect(usarFormularioNovo('')).toBe(false)
  })

  it('liga pela env quando o valor é exatamente "1"', () => {
    vi.stubEnv('VITE_CHECKOUT_SECURE_FIELDS', '1')
    expect(usarFormularioNovo('')).toBe(true)
  })

  it.each(['0', 'true', 'sim', 'on', ' 1', '', 'yes'])(
    'env com valor inesperado (%j) NÃO liga — na dúvida, o Brick',
    (valor) => {
      vi.stubEnv('VITE_CHECKOUT_SECURE_FIELDS', valor)
      expect(usarFormularioNovo('')).toBe(false)
    }
  )

  it('?sf=1 liga mesmo com a env desligada — é o QA em produção', () => {
    expect(usarFormularioNovo('?sf=1')).toBe(true)
  })

  it('?sf=0 desliga mesmo com a env ligada — é o kill-switch do suporte', () => {
    vi.stubEnv('VITE_CHECKOUT_SECURE_FIELDS', '1')
    expect(usarFormularioNovo('?sf=0')).toBe(false)
  })

  it('sobrevive aos parâmetros que já vêm no link de campanha', () => {
    expect(usarFormularioNovo('?utm_source=ig&sf=1&utm_medium=bio')).toBe(true)
  })

  it.each(['?sf=2', '?sf=', '?sf', '?SF=1', '?sfx=1'])(
    'valor de URL fora do contrato (%j) cai na env, não inventa decisão',
    (busca) => {
      expect(usarFormularioNovo(busca)).toBe(false)
      vi.stubEnv('VITE_CHECKOUT_SECURE_FIELDS', '1')
      expect(usarFormularioNovo(busca)).toBe(true)
    }
  )

  it('lê a query da própria página quando ninguém passa nada', () => {
    const original = window.location.href
    window.history.replaceState({}, '', '/c/qualquer-slug?sf=1')
    try {
      expect(usarFormularioNovo()).toBe(true)
    } finally {
      window.history.replaceState({}, '', original)
    }
  })
})
