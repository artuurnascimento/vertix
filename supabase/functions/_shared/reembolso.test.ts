/**
 * Testes da mecânica de reembolso. `deno test supabase/functions/_shared/`.
 *
 * O que se protege aqui é a etapa que só existe por causa das vendas antigas:
 * DESCOBRIR qual pagamento estornar quando o id nunca foi gravado. Errar essa
 * escolha não dá erro de tela — dá dinheiro saindo da cobrança errada. Por
 * isso os casos de RECUSA valem tanto quanto o caso feliz.
 *
 * `fetch` é trocado por um dublê; nenhuma chamada sai para o Mercado Pago.
 */

import { assertEquals } from 'jsr:@std/assert@1'
import { buscarPagamentoPorReferencia, reaisParaCentavos } from './reembolso.ts'

const REF = '48f8b0ae-6d7a-466c-9020-1309dcca7415'

/** Um pagamento como o MP devolve em /v1/payments/search. */
function pagamento(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 111222333,
    status: 'approved',
    transaction_amount: 197,
    external_reference: REF,
    ...over,
  }
}

/**
 * Roda a busca contra uma resposta fixa do MP. Devolve também a URL chamada,
 * porque o filtro por external_reference tem de ir NA URL — mandar a busca sem
 * ele traria a conta inteira.
 */
async function buscar(
  resposta: unknown,
  status = 200,
  valorCentavos = 19700
) {
  const original = globalThis.fetch
  let url = ''
  globalThis.fetch = ((entrada: string | URL | Request) => {
    url = String(entrada)
    return Promise.resolve(
      new Response(JSON.stringify(resposta), {
        status,
        headers: { 'Content-Type': 'application/json' },
      })
    )
  }) as typeof fetch
  try {
    const r = await buscarPagamentoPorReferencia('teste', 'tok', REF, valorCentavos)
    return { ...r, url } as ReturnType<typeof Object.assign> & { url: string }
  } finally {
    globalThis.fetch = original
  }
}

// ---------------------------------------------------------------------------
// Aritmética
// ---------------------------------------------------------------------------

Deno.test('reais → centavos arredonda, não trunca', () => {
  // 238.14 * 100 dá 23813.999... em ponto flutuante. Truncar registraria um
  // centavo A MENOS do que voltou para o cliente.
  assertEquals(reaisParaCentavos(238.14), 23814)
  assertEquals(reaisParaCentavos(197), 19700)
  assertEquals(reaisParaCentavos(0.1 + 0.2), 30)
  assertEquals(reaisParaCentavos('197.00'), 19700)
})

Deno.test('valor ilegível vira null, e não zero', () => {
  // Zero seria "o MP devolveu R$ 0,00", que é uma afirmação. Null é a dúvida,
  // e quem grava usa o valor da própria venda no lugar.
  assertEquals(reaisParaCentavos(undefined), null)
  assertEquals(reaisParaCentavos(null), null)
  assertEquals(reaisParaCentavos('não é número'), null)
  assertEquals(reaisParaCentavos(''), null)
  assertEquals(reaisParaCentavos({}), null)
})

// ---------------------------------------------------------------------------
// Descoberta do pagamento
// ---------------------------------------------------------------------------

Deno.test('acha o pagamento aprovado do valor certo', async () => {
  const r = await buscar({ paging: { total: 1 }, results: [pagamento()] })
  assertEquals(r.resultado, 'encontrado')
  assertEquals(r.pagamento.id, '111222333')
  assertEquals(r.pagamento.valor_centavos, 19700)
  assertEquals(r.url.includes(`external_reference=${REF}`), true)
})

Deno.test('o pagamento já estornado ainda é O pagamento da venda', async () => {
  // Achá-lo é o que permite reconciliar o estado em vez de dizer "não existe
  // pagamento" sobre uma venda que cobrou de verdade.
  const r = await buscar({
    results: [pagamento({ status: 'refunded' })],
  })
  assertEquals(r.resultado, 'encontrado')
  assertEquals(r.pagamento.status, 'refunded')
})

Deno.test('tentativa que nunca cobrou não conta como pagamento', async () => {
  // Pix que expirou e o cliente pagou de novo: as duas tentativas dividem a
  // mesma referência, e só uma tirou dinheiro.
  const r = await buscar({
    results: [
      pagamento({ id: 1, status: 'cancelled' }),
      pagamento({ id: 2, status: 'rejected' }),
      pagamento({ id: 3, status: 'pending' }),
      pagamento({ id: 4, status: 'in_process' }),
      pagamento({ id: 5, status: 'approved' }),
    ],
  })
  assertEquals(r.resultado, 'encontrado')
  assertEquals(r.pagamento.id, '5')
})

Deno.test('pagamento de outro valor é recusado, não escolhido', async () => {
  // Estornar um pagamento de valor diferente do que a venda cobrou é devolver
  // o que não foi cobrado — ou devolver de menos.
  const r = await buscar({ results: [pagamento({ transaction_amount: 297 })] })
  assertEquals(r.resultado, 'nao_encontrado')
})

Deno.test('um centavo de diferença já não é o mesmo pagamento', async () => {
  const r = await buscar({ results: [pagamento({ transaction_amount: 196.99 })] })
  assertEquals(r.resultado, 'nao_encontrado')
})

Deno.test('resultado de outra referência é descartado', async () => {
  // Cinto de segurança: se o servidor um dia ignorasse o filtro, a busca
  // traria a conta inteira e o primeiro resultado seria de outro cliente.
  const r = await buscar({
    results: [pagamento({ external_reference: 'outra-cobranca' })],
  })
  assertEquals(r.resultado, 'nao_encontrado')
})

Deno.test('dois pagamentos do mesmo valor NÃO são desempatados por data', async () => {
  // O cliente foi cobrado duas vezes. Escolher um por conta própria é decidir
  // de qual cobrança o dinheiro sai — julgamento de gente.
  const r = await buscar({
    results: [
      pagamento({ id: 900, date_created: '2026-09-08T12:00:00Z' }),
      pagamento({ id: 901, date_created: '2026-09-07T12:00:00Z' }),
    ],
  })
  assertEquals(r.resultado, 'ambiguo')
  assertEquals(r.candidatos.map((c: { id: string }) => c.id), ['900', '901'])
})

Deno.test('referência sem pagamento nenhum', async () => {
  const r = await buscar({ paging: { total: 0 }, results: [] })
  assertEquals(r.resultado, 'nao_encontrado')
})

Deno.test('MP fora do ar é DÚVIDA, nunca "não existe pagamento"', async () => {
  // A diferença decide se a reserva é solta: "não achei" libera, "não sei"
  // segura. Colapsar os dois convidaria um segundo clique ao gateway.
  const r = await buscar({ message: 'internal error' }, 500)
  assertEquals(r.resultado, 'indisponivel')
})

Deno.test('corpo inesperado do MP também é dúvida', async () => {
  const r = await buscar({ results: 'isto não é uma lista' })
  assertEquals(r.resultado, 'indisponivel')
})

Deno.test('pagamento sem id não vira candidato', async () => {
  const r = await buscar({ results: [pagamento({ id: null })] })
  assertEquals(r.resultado, 'nao_encontrado')
})
