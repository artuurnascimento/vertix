import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { carregarMpSdk } from '../mpSdk'
import { esquecerInstanciaMp, obterInstanciaMp } from './mpInstancia'

// O <script> do SDK não sobe em jsdom: o que interessa testar é a memoização e
// o comportamento na falha, não a rede.
vi.mock('../mpSdk', () => ({ carregarMpSdk: vi.fn(async () => {}) }))

const carregar = vi.mocked(carregarMpSdk)

function instalarSdkGlobal(): ReturnType<typeof vi.fn> {
  const construtor = vi.fn(function () {
    return { fields: {}, getPaymentMethods: vi.fn(), getInstallments: vi.fn() }
  })
  ;(window as unknown as { MercadoPago?: unknown }).MercadoPago = construtor
  return construtor
}

beforeEach(() => {
  esquecerInstanciaMp()
  carregar.mockClear()
  carregar.mockResolvedValue(undefined)
})

afterEach(() => {
  delete (window as unknown as { MercadoPago?: unknown }).MercadoPago
})

describe('obterInstanciaMp', () => {
  test('constrói uma vez só, mesmo com duas chamadas no mesmo tick', async () => {
    const construtor = instalarSdkGlobal()

    const [a, b] = await Promise.all([obterInstanciaMp(), obterInstanciaMp()])

    // StrictMode do React 19 monta duas vezes: duas instâncias significariam
    // dois device fingerprints e uma tokenização fora da sessão das consultas.
    expect(construtor).toHaveBeenCalledOnce()
    expect(a).toBe(b)
  })

  test('reusa o carregador do Brick em vez de baixar o SDK de novo', async () => {
    instalarSdkGlobal()
    await obterInstanciaMp()
    await obterInstanciaMp()
    expect(carregar).toHaveBeenCalledOnce()
  })

  test('constrói com a locale pt-BR', async () => {
    const construtor = instalarSdkGlobal()
    await obterInstanciaMp()
    expect(construtor.mock.calls[0][1]).toEqual({ locale: 'pt-BR' })
  })

  test('falha do <script> não fica memorizada — a próxima tentativa refaz', async () => {
    carregar.mockRejectedValueOnce(new Error('sdk_load_failed'))

    await expect(obterInstanciaMp()).rejects.toThrow('sdk_load_failed')

    instalarSdkGlobal()
    await expect(obterInstanciaMp()).resolves.toBeDefined()
  })

  test('script carregado sem expor o global vira erro claro', async () => {
    await expect(obterInstanciaMp()).rejects.toThrow('sdk_indisponivel')
  })
})
