import { afterEach, describe, expect, it, vi } from 'vitest'
import { usarFormularioNovo } from './flagFormularioNovo'

/**
 * A regra que estes testes protegem é a mesma de sempre, com o sinal trocado
 * na promoção: **com a flag ausente, o checkout é o que está vendendo hoje** —
 * e hoje isso é o Secure Fields. Um default invertido aqui trocaria o
 * formulário de pagamento de 100% do tráfego sem ninguém pedir, e o sintoma
 * chegaria como queda de conversão, não como erro no console.
 *
 * O que mudou em relação à versão anterior deste arquivo: o padrão saiu do
 * Brick e foi para o formulário novo. O Brick continua alcançável, agora só de
 * propósito — `?sf=0` ou a env em `0`.
 */
describe('usarFormularioNovo', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('nasce LIGADA: sem query e sem env, é o formulário novo', () => {
    expect(usarFormularioNovo('')).toBe(true)
  })

  it('volta ao Brick pela env quando o valor é exatamente "0"', () => {
    vi.stubEnv('VITE_CHECKOUT_SECURE_FIELDS', '0')
    expect(usarFormularioNovo('')).toBe(false)
  })

  it.each(['1', 'false', 'nao', 'off', ' 0', '', 'no'])(
    'env com valor inesperado (%j) NÃO troca o checkout — fica o padrão',
    (valor) => {
      vi.stubEnv('VITE_CHECKOUT_SECURE_FIELDS', valor)
      expect(usarFormularioNovo('')).toBe(true)
    }
  )

  it('?sf=0 volta ao Brick mesmo com a env ausente — é o kill-switch do suporte', () => {
    expect(usarFormularioNovo('?sf=0')).toBe(false)
  })

  it('?sf=1 força o novo mesmo com a env em "0" — é conferir bug sem subir todo mundo', () => {
    vi.stubEnv('VITE_CHECKOUT_SECURE_FIELDS', '0')
    expect(usarFormularioNovo('?sf=1')).toBe(true)
  })

  it('sobrevive aos parâmetros que já vêm no link de campanha', () => {
    expect(usarFormularioNovo('?utm_source=ig&sf=0&utm_medium=bio')).toBe(false)
  })

  it('o link do Scan, que só carrega o id da análise, cai no padrão', () => {
    // `scan-comprar` monta `/c/plano-correcao?a=<id>` — sem `sf`. Se este
    // teste virar false, quem comprou o Plano de Correção voltou ao Brick.
    expect(usarFormularioNovo('?a=b0f1c2d3-0000-4000-8000-000000000000')).toBe(
      true
    )
  })

  it.each(['?sf=2', '?sf=', '?sf', '?SF=0', '?sfx=0'])(
    'valor de URL fora do contrato (%j) cai na env, não inventa decisão',
    (busca) => {
      expect(usarFormularioNovo(busca)).toBe(true)
      vi.stubEnv('VITE_CHECKOUT_SECURE_FIELDS', '0')
      expect(usarFormularioNovo(busca)).toBe(false)
    }
  )

  it('lê a query da própria página quando ninguém passa nada', () => {
    const original = window.location.href
    window.history.replaceState({}, '', '/c/qualquer-slug?sf=0')
    try {
      expect(usarFormularioNovo()).toBe(false)
    } finally {
      window.history.replaceState({}, '', original)
    }
  })
})
