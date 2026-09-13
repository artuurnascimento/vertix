import { describe, expect, test } from 'vitest'
import {
  campoEmFoco,
  dispositivoDoAgente,
  distanciaAoCentro,
  navegadorDoAgente,
  secaoDominante,
  sistemaDoAgente,
  utmDaBusca,
} from './visita'

/** Testes das leituras puras da visita (visita.ts). Arquivo de teste, Vitest. */

const IPHONE_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
const IPHONE_INSTAGRAM =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 334.0.0.0 (iPhone15,3; iOS 17_5; pt_BR)'
const ANDROID_CHROME =
  'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36'
const ANDROID_TABLET =
  'Mozilla/5.0 (Linux; Android 13; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
const MAC_CHROME =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
const WINDOWS_EDGE =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0'

describe('dispositivo, navegador e sistema', () => {
  test('celular, tablet e computador', () => {
    expect(dispositivoDoAgente(IPHONE_SAFARI)).toBe('celular')
    expect(dispositivoDoAgente(ANDROID_CHROME)).toBe('celular')
    expect(dispositivoDoAgente(ANDROID_TABLET)).toBe('tablet')
    expect(dispositivoDoAgente(MAC_CHROME)).toBe('computador')
    expect(dispositivoDoAgente('')).toBe('computador')
  })

  test('navegador embutido do Instagram vem antes do Safari', () => {
    expect(navegadorDoAgente(IPHONE_INSTAGRAM)).toBe('Instagram')
    expect(navegadorDoAgente(IPHONE_SAFARI)).toBe('Safari')
    expect(navegadorDoAgente(ANDROID_CHROME)).toBe('Chrome')
    expect(navegadorDoAgente(WINDOWS_EDGE)).toBe('Edge')
    expect(navegadorDoAgente('curl/8.0')).toBe('Outro')
  })

  test('sistema operacional', () => {
    expect(sistemaDoAgente(IPHONE_SAFARI)).toBe('iOS')
    expect(sistemaDoAgente(ANDROID_CHROME)).toBe('Android')
    expect(sistemaDoAgente(MAC_CHROME)).toBe('macOS')
    expect(sistemaDoAgente(WINDOWS_EDGE)).toBe('Windows')
  })
})

describe('utmDaBusca', () => {
  test('só utm_* conhecidos, podados, mais o marcador do click id', () => {
    expect(
      utmDaBusca('?utm_source=ig&utm_campaign=%20bf%20&utm_x=1&a=123&fbclid=abc')
    ).toEqual({ utm_source: 'ig', utm_campaign: 'bf', clid: 'facebook' })
    expect(utmDaBusca('?gclid=1')).toEqual({ clid: 'google' })
    expect(utmDaBusca('')).toEqual({})
  })
})

describe('secaoDominante', () => {
  test('quem cobre o centro da tela ganha, mesmo menos visível', () => {
    expect(
      secaoDominante([
        { secao: 'cupom', proporcao: 1, distanciaAoCentro: 300 },
        { secao: 'dados', proporcao: 0.4, distanciaAoCentro: 0 },
      ])
    ).toBe('dados')
  })

  test('sem ninguém no centro, a visível mais próxima; fora da tela não conta', () => {
    expect(
      secaoDominante([
        { secao: 'resumo', proporcao: 0, distanciaAoCentro: 10 },
        { secao: 'garantia', proporcao: 0.2, distanciaAoCentro: 120 },
        { secao: 'pagamento', proporcao: 0.9, distanciaAoCentro: 40 },
      ])
    ).toBe('pagamento')
    expect(secaoDominante([])).toBeNull()
  })

  test('distância ao centro é zero quando o retângulo o atravessa', () => {
    expect(distanciaAoCentro(100, 500, 800)).toBe(0)
    expect(distanciaAoCentro(500, 700, 800)).toBe(100)
    expect(distanciaAoCentro(-300, 100, 800)).toBe(300)
  })
})

describe('campoEmFoco', () => {
  test('campos de contato pelo id; tudo dentro de #pagamento é cartão', () => {
    document.body.innerHTML = `
      <input id="cliente-email" />
      <input id="outro" />
      <section id="pagamento"><iframe id="mp"></iframe><select id="parcelas"></select><button id="pagar"></button></section>
    `
    expect(campoEmFoco(document.getElementById('cliente-email'))).toBe('email')
    expect(campoEmFoco(document.getElementById('outro'))).toBeNull()
    expect(campoEmFoco(document.getElementById('mp'))).toBe('cartao')
    expect(campoEmFoco(document.getElementById('parcelas'))).toBe('cartao')
    expect(campoEmFoco(document.getElementById('pagar'))).toBeNull()
    expect(campoEmFoco(null)).toBeNull()
  })
})
