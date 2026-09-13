import { afterEach, beforeAll, describe, expect, test } from 'vitest'
import { inicioDoVisitante } from './useCronometro'

/**
 * O cronômetro por visitante só faz sentido se recarregar a página não zerar
 * a contagem — e se duas ofertas no mesmo navegador não dividirem o relógio.
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

  test('primeira abertura grava o instante; as seguintes devolvem o mesmo', () => {
    const agora = 1_800_000_000_000
    expect(inicioDoVisitante('plano-correcao', agora)).toBe(agora)
    expect(inicioDoVisitante('plano-correcao', agora + 5 * 60_000)).toBe(agora)
  })

  test('cada checkout tem o próprio início', () => {
    const agora = 1_800_000_000_000
    inicioDoVisitante('oferta-a', agora)
    expect(inicioDoVisitante('oferta-b', agora + 60_000)).toBe(agora + 60_000)
  })

  test('valor guardado no futuro (relógio mexido) é substituído por agora', () => {
    const agora = 1_800_000_000_000
    window.localStorage.setItem('checkout-cronometro:oferta', String(agora + 999_999))
    expect(inicioDoVisitante('oferta', agora)).toBe(agora)
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
