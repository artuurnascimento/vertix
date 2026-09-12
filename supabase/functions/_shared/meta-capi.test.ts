/**
 * Purchase pelo servidor: o que vai para a Meta, sem rede.
 *
 *   deno test supabase/functions/_shared/meta-capi.test.ts
 */
import { assertEquals, assertMatch } from 'jsr:@std/assert@1'
import { enviarPurchaseMeta, hashesDeContato, montarEventoPurchase } from './meta-capi.ts'

Deno.test('e-mail e telefone vão em SHA-256, normalizados como a Meta exige', async () => {
  const a = await hashesDeContato('  Maria@Loja.com.br ', '+55 (62) 99999-0000')
  const b = await hashesDeContato('maria@loja.com.br', '5562999990000')
  assertEquals(a, b)
  assertMatch(a.em[0], /^[0-9a-f]{64}$/)
  assertMatch(a.ph[0], /^[0-9a-f]{64}$/)
  // Nada em claro.
  assertEquals(a.em[0].includes('maria'), false)
})

Deno.test('sem telefone o campo vai vazio, não quebra', async () => {
  const h = await hashesDeContato('x@y.com', null)
  assertEquals(h.ph, [])
  assertEquals(h.em.length, 1)
})

Deno.test('o evento leva event_id = pedido (dedup), valor em reais e BRL', async () => {
  const evento = await montarEventoPurchase(
    {
      eventId: 'ped-1',
      valorCentavos: 19_700,
      email: 'x@y.com',
      telefone: null,
      contentName: 'Plano de Correção',
    },
    1_700_000_000
  )
  assertEquals(evento.event_name, 'Purchase')
  assertEquals(evento.event_id, 'ped-1')
  assertEquals(evento.event_time, 1_700_000_000)
  assertEquals(evento.action_source, 'website')
  assertEquals((evento.custom_data as Record<string, unknown>).value, 197)
  assertEquals((evento.custom_data as Record<string, unknown>).currency, 'BRL')
})

Deno.test('sem META_PIXEL_ID/META_CAPI_TOKEN, não sai nada e não lança', async () => {
  Deno.env.delete('META_PIXEL_ID')
  Deno.env.delete('META_CAPI_TOKEN')
  const ok = await enviarPurchaseMeta(
    { eventId: 'ped-1', valorCentavos: 100, email: 'x@y.com', telefone: null, contentName: 'x' },
    'teste'
  )
  assertEquals(ok, false)
})
