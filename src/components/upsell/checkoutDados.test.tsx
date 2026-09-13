import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'

/**
 * O caminho real de quem acabou de pagar: a tela de checkout deixou a SUA
 * configuração no cache e a tela de upsell pede a dela. Os dois defeitos que
 * fizeram o upsell nunca aparecer em produção estão reproduzidos aqui.
 */

const { cliente, CRU } = vi.hoisted(() => {
  const CRU = {
    checkout: {
      slug: 'plano-correcao',
      upsell_produto_id: 'up-1',
      upsell_titulo: 'Quer que a gente aplique por você?',
      downsell_produto_id: 'down-1',
    },
    produto: { id: 'p-1', nome: 'Plano de Correção', preco_centavos: 19700 },
    bump: null,
    upsell_produto: { id: 'up-1', nome: 'Correção Aplicada', preco_centavos: 149700 },
    downsell_produto: { id: 'down-1', nome: 'Só os 3 críticos', preco_centavos: 69700 },
  }
  // O cliente real implementa `rpc` como método que lê `this.rest`. Chamado
  // solto — como a versão antiga fazia — ele estoura antes de qualquer
  // requisição; o dublê reproduz exatamente isso.
  const cliente = {
    rest: { rpc: vi.fn(async () => ({ data: CRU, error: null })) },
    rpc(this: { rest: { rpc: () => Promise<unknown> } } | undefined, _nome: string, _args: unknown) {
      if (!this) throw new TypeError("Cannot read properties of undefined (reading 'rest')")
      return this.rest.rpc()
    },
  }
  return { cliente, CRU }
})

vi.mock('../../lib/supabase', () => ({ supabase: cliente }))

import { useCheckoutInfo } from './checkoutDados'
import { resolverOferta } from './upsellFluxo'

/** O que a tela de checkout grava em `checkout-info`: normalizado, sem os ids das ofertas. */
const NORMALIZADO = {
  checkout: { slug: 'plano-correcao', titulo: 'O plano', temUpsell: true },
  produto: { id: 'p-1', nome: 'Plano de Correção', preco_centavos: 19700 },
  bump: null,
}

function montar(client = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  return { client, ...renderHook(() => useCheckoutInfo('plano-correcao'), { wrapper }) }
}

describe('useCheckoutInfo', () => {
  beforeEach(() => cliente.rest.rpc.mockClear())

  test('chama a RPC pelo cliente, com o this no lugar, e devolve a forma crua', async () => {
    const { result } = montar()

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(cliente.rest.rpc).toHaveBeenCalledTimes(1)
    expect(result.current.data?.checkout.upsell_produto_id).toBe('up-1')
    expect(result.current.data).toEqual(CRU)
  })

  test('não reaproveita o cache normalizado da tela de checkout', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    client.setQueryData(['checkout-info', 'plano-correcao'], NORMALIZADO)

    const { result } = montar(client)
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    // Sem isto a oferta não se resolvia e a tela mandava direto para o obrigado.
    const oferta = resolverOferta(result.current.data, 'upsell')
    expect(oferta?.produtoId).toBe('up-1')
    expect(oferta?.precoCentavos).toBe(149700)
    // E o cache da tela de checkout continua como ela deixou.
    expect(client.getQueryData(['checkout-info', 'plano-correcao'])).toBe(NORMALIZADO)
  })
})
