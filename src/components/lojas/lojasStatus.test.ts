import { describe, expect, test } from 'vitest'
import { semaforoDoApp } from './lojasStatus'
import type { VertixShop } from './appsProxy'

/**
 * Testes do semáforo de saúde dos apps por loja (lojasStatus.ts), usado na
 * página Lojas para dizer se um app está saudável naquela loja. Arquivo de
 * teste: nenhum importador, roda no Vitest.
 *
 * Lojas sintéticas no formato VertixShop — shop (domínio myshopify),
 * onboardedAt (ISO UTC ou null), hasOwnResendKey, smsEnabled,
 * hasOwnTwilioCreds e enabled. A função é pura: sem rede e sem banco.
 */

function loja(over: Partial<VertixShop> = {}): VertixShop {
  return {
    shop: 'loja-exemplo.myshopify.com',
    onboardedAt: '2026-09-01T10:00:00Z',
    hasOwnResendKey: true,
    smsEnabled: false,
    hasOwnTwilioCreds: false,
    enabled: true,
    ...over,
  } as VertixShop
}

describe('semaforoDoApp — estado do backend', () => {
  test('consultando ainda não julga nada', () => {
    expect(semaforoDoApp('carregando', undefined).cor).toBe('cinza')
  })

  test('backend fora do ar é vermelho', () => {
    const r = semaforoDoApp('offline', loja())
    expect(r.cor).toBe('vermelho')
    expect(r.motivos[0]).toMatch(/não respondeu/i)
  })

  test('backend sem configuração é cinza, não vermelho', () => {
    expect(semaforoDoApp('nao_configurado', undefined).cor).toBe('cinza')
  })

  test('loja provisionada que o app não conhece fica cinza', () => {
    const r = semaforoDoApp('ok', undefined)
    expect(r.cor).toBe('cinza')
    expect(r.motivos[0]).toMatch(/provisionad/i)
  })
})

describe('semaforoDoApp — pendências da loja', () => {
  test('tudo em dia fica verde', () => {
    expect(semaforoDoApp('ok', loja()).cor).toBe('verde')
  })

  test('onboarding pendente vira amarelo com o motivo', () => {
    const r = semaforoDoApp('ok', loja({ onboardedAt: null }))
    expect(r.cor).toBe('amarelo')
    expect(r.motivos).toContain('Onboarding pendente.')
  })

  test('sem chave própria de e-mail vira amarelo', () => {
    const r = semaforoDoApp('ok', loja({ hasOwnResendKey: false }))
    expect(r.cor).toBe('amarelo')
    expect(r.motivos.join(' ')).toMatch(/Resend/)
  })

  test('SMS ligado sem credencial própria vira amarelo', () => {
    const r = semaforoDoApp(
      'ok',
      loja({ smsEnabled: true, hasOwnTwilioCreds: false })
    )
    expect(r.cor).toBe('amarelo')
    expect(r.motivos.join(' ')).toMatch(/Twilio/)
  })

  test('SMS ligado com credencial própria segue verde', () => {
    const r = semaforoDoApp(
      'ok',
      loja({ smsEnabled: true, hasOwnTwilioCreds: true })
    )
    expect(r.cor).toBe('verde')
  })

  test('app desativado aparece entre as pendências', () => {
    const r = semaforoDoApp('ok', loja({ enabled: false }))
    expect(r.cor).toBe('amarelo')
    expect(r.motivos).toContain('App desativado nas configurações.')
  })

  test('várias pendências juntas são todas listadas', () => {
    const r = semaforoDoApp(
      'ok',
      loja({ onboardedAt: null, hasOwnResendKey: false, enabled: false })
    )
    expect(r.cor).toBe('amarelo')
    expect(r.motivos).toHaveLength(3)
  })
})
