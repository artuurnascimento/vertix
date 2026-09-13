import { afterEach, beforeAll, describe, expect, test } from 'vitest'
import { inicioDoVisitante } from './useCronometro'

/**
 * O cronômetro por visitante parte do tempo cheio a cada abertura: nada fica
 * guardado no navegador, então quem viu o 00:00 e voltou encontra os minutos
 * inteiros de novo. A versão anterior gravava a primeira abertura no
 * localStorage — a chave que ela deixou tem que ser apagada, não lida.
 *
 * O jsdom deste projeto não expõe `localStorage` (a origem do ambiente é
 * opaca), então o teste instala um armazenamento em memória com a mesma
 * interface. Sem armazenamento nenhum, o código real segue com "agora" — é o
 * último caso abaixo.
 */
function armazenamentoEmMemoria(): Storage {
  const dados = new Map<string, string>()
  return {
    get length() {
      return dados.size
    },
    clear: () => dados.clear(),
    getItem: (chave) => dados.get(chave) ?? null,
    key: (indice) => Array.from(dados.keys())[indice] ?? null,
    removeItem: (chave) => void dados.delete(chave),
    setItem: (chave, valor) => void dados.set(chave, String(valor)),
  }
}

describe('inicioDoVisitante', () => {
  beforeAll(() => {
    Object.defineProperty(window, 'localStorage', {
      value: armazenamentoEmMemoria(),
      configurable: true,
    })
  })
  afterEach(() => window.localStorage.clear())

  test('cada abertura começa agora — voltar depois de zerar dá o tempo cheio de novo', () => {
    const agora = 1_800_000_000_000
    expect(inicioDoVisitante('plano-correcao', agora)).toBe(agora)
    expect(inicioDoVisitante('plano-correcao', agora + 20 * 60_000)).toBe(agora + 20 * 60_000)
    expect(window.localStorage.length).toBe(0)
  })

  test('a chave que a versão antiga deixou é apagada, não lida', () => {
    const agora = 1_800_000_000_000
    window.localStorage.setItem('checkout-cronometro:oferta', String(agora - 30 * 60_000))
    expect(inicioDoVisitante('oferta', agora)).toBe(agora)
    expect(window.localStorage.getItem('checkout-cronometro:oferta')).toBeNull()
  })

  test('sem armazenamento, a contagem começa agora e não quebra a página', () => {
    const original = window.localStorage
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new Error('SecurityError: acesso negado')
      },
      configurable: true,
    })
    try {
      expect(inicioDoVisitante('oferta', 123)).toBe(123)
    } finally {
      Object.defineProperty(window, 'localStorage', { value: original, configurable: true })
    }
  })
})
