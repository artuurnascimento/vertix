import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { carregarPagina } from './carregarPagina'

/**
 * O defeito que este teste guarda: uma aba aberta antes de um deploy pede um
 * chunk que não existe mais, a Vercel responde o index.html da SPA, o
 * `import()` recebe HTML no lugar de JavaScript — e a tela fica PRETA (foi
 * assim no upsell do checkout em 13/09/2026). Testa-se a recuperação e, com
 * o mesmo peso, o LIMITE dela: recarregar em laço seria trocar tela preta por
 * tela piscando.
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

const recarregar = vi.fn()

beforeEach(() => {
  recarregar.mockClear()
  Object.defineProperty(window, 'sessionStorage', { value: armazenamentoEmMemoria(), configurable: true })
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...window.location, reload: recarregar },
  })
})

afterEach(() => window.sessionStorage.clear())

/** Erro do navegador quando o módulo pedido volta como HTML. */
function chunkSumido(): Error {
  return new TypeError(
    'Failed to fetch dynamically imported module: https://pay.vertix.studio/assets/UpsellPage-velho.js'
  )
}

describe('carregarPagina', () => {
  test('caminho normal: devolve o módulo e não recarrega nada', async () => {
    const modulo = { default: 'UpsellPage' }
    await expect(carregarPagina(async () => modulo)).resolves.toBe(modulo)
    expect(recarregar).not.toHaveBeenCalled()
  })

  test('chunk que sumiu depois de um deploy: recarrega a aba e a promessa fica pendente', async () => {
    let resolveu = false
    void carregarPagina(async () => {
      throw chunkSumido()
    }).then(() => {
      resolveu = true
    })
    // Duas voltas de microtask: o catch roda e chama o reload.
    await Promise.resolve()
    await Promise.resolve()
    expect(recarregar).toHaveBeenCalledTimes(1)
    expect(window.sessionStorage.getItem('vx-chunk-recarregado')).toBe('1')
    // Não resolve nem rejeita: o Suspense segue no "carregando" até a recarga.
    expect(resolveu).toBe(false)
  })

  test('recarrega uma vez só — a segunda falha sobe para a fronteira', async () => {
    void carregarPagina(async () => {
      throw chunkSumido()
    })
    await Promise.resolve()
    await Promise.resolve()
    expect(recarregar).toHaveBeenCalledTimes(1)

    await expect(
      carregarPagina(async () => {
        throw chunkSumido()
      })
    ).rejects.toThrow(/dynamically imported module/)
    expect(recarregar).toHaveBeenCalledTimes(1)
  })
})
