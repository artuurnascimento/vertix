/**
 * Testes do gravador de log das edge functions.
 * `deno test supabase/functions/_shared/`.
 *
 * O que se protege: (1) as duas formas de chamada viram a mesma entrada;
 * (2) dentro de uma requisição, tudo o que for logado leva o MESMO id e sai
 * num lote só, depois da resposta; (3) exceção não tratada vira 500 + fatal
 * em vez de derrubar a function; (4) 4xx/5xx são registrados sem duplicar o
 * erro que o handler já registrou; (5) nada disso lança quando o transporte
 * falha.
 */

import { assert, assertEquals, assertMatch } from 'jsr:@std/assert@1'
import {
  comLog,
  configurarTransporte,
  criarLog,
  eventoDaMensagem,
  interpretar,
  serializar,
  type Entrada,
} from './log.ts'

/** Dublê de transporte: guarda os lotes recebidos. */
function transporteDeTeste(): { lotes: Entrada[][]; esperar: () => Promise<void> } {
  const lotes: Entrada[][] = []
  configurarTransporte((entradas) => {
    lotes.push(entradas)
    return Promise.resolve()
  })
  return { lotes, esperar: () => new Promise((r) => setTimeout(r, 5)) }
}

Deno.test('eventoDaMensagem: tira o prefixo, corta no dois-pontos e vira slug', () => {
  assertEquals(eventoDaMensagem('[checkout-pagar] Falha ao criar customer: 500'), 'falha_ao_criar_customer')
  assertEquals(eventoDaMensagem('Env do Supabase ausente.'), 'env_do_supabase_ausente')
  assertEquals(eventoDaMensagem('Pagamento recusado (cartão)'), 'pagamento_recusado')
  assertEquals(eventoDaMensagem('   '), 'evento')
})

Deno.test('interpretar: forma explícita (evento, mensagem, detalhes)', () => {
  const r = interpretar(['mp_recusou', 'MP recusou o pagamento', { status: 402 }])
  assertEquals(r, { evento: 'mp_recusou', mensagem: 'MP recusou o pagamento', detalhes: { status: 402 } })
})

Deno.test('interpretar: estilo console — texto vira mensagem, Error e objetos viram detalhes', () => {
  const erro = new Error('boom')
  const r = interpretar(['[scan-comprar] Falha ao registrar compra:', 502, erro])
  assertEquals(r.evento, 'falha_ao_registrar_compra')
  assertEquals(r.mensagem, 'Falha ao registrar compra: 502 boom')
  assertEquals((r.detalhes as { nome: string }).nome, 'Error')
  assertMatch(String((r.detalhes as { stack: string }).stack), /boom/)
})

Deno.test('interpretar: uma string com espaços NÃO é tratada como evento', () => {
  const r = interpretar(['Falha ao buscar', 'detalhe'])
  assertEquals(r.evento, 'falha_ao_buscar')
  assertEquals(r.mensagem, 'Falha ao buscar detalhe')
})

Deno.test('serializar: Error com causa, Response e strings enormes', () => {
  const e = new Error('fora', { cause: new Error('dentro') })
  const s = serializar(e) as { mensagem: string; causa: { mensagem: string } }
  assertEquals(s.mensagem, 'fora')
  assertEquals(s.causa.mensagem, 'dentro')
  assertEquals(serializar(new Response('x', { status: 418 })), { resposta: { status: 418, url: '' } })
  assertEquals((serializar('a'.repeat(5000)) as string).length, 4001)
})

Deno.test('comLog: tudo o que for logado na requisição leva o mesmo id e sai num lote só, depois da resposta', async () => {
  const t = transporteDeTeste()
  const log = criarLog('shared:x')
  const handler = comLog('minha-fn', async (_req) => {
    log.info('passo_1', 'começou')
    await new Promise((r) => setTimeout(r, 2))
    log.erro('mp_falhou', 'MP caiu', { status: 500 })
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  })
  const res = await handler(
    new Request('https://x.supabase.co/functions/v1/minha-fn', {
      method: 'POST',
      headers: { 'x-vx-requisicao': 'abc123', 'x-vx-sessao': 'c3cbeaf4-1111-4111-8111-111111111111', 'user-agent': 'UA' },
    })
  )
  assertEquals(res.status, 200)
  assertEquals(res.headers.get('x-vx-requisicao'), 'abc123')
  await t.esperar()
  assertEquals(t.lotes.length, 1)
  const [a, b] = t.lotes[0]
  assertEquals(a.requisicao_id, 'abc123')
  assertEquals(b.requisicao_id, 'abc123')
  assertEquals(a.sessao_id, 'c3cbeaf4-1111-4111-8111-111111111111')
  assertEquals(a.fonte, 'shared:x')
  assertEquals(a.contexto.function, 'minha-fn')
  assertEquals(a.contexto.metodo, 'POST')
  assertEquals(b.nivel, 'erro')
  // 200 com erro registrado pelo handler: nada de 'resposta_5xx' a mais.
  assertEquals(t.lotes[0].length, 2)
})

Deno.test('comLog: sem cabeçalho, cria um id próprio e o devolve', async () => {
  const t = transporteDeTeste()
  const handler = comLog('fn', () => new Response('ok'))
  const res = await handler(new Request('https://x/fn'))
  assertMatch(res.headers.get('x-vx-requisicao') ?? '', /^[a-f0-9]{16}$/)
  await t.esperar()
  assertEquals(t.lotes.length, 0) // 200 sem nada logado: lote vazio não é enviado
})

Deno.test('comLog: exceção não tratada vira 500 JSON + fatal, com o id no corpo', async () => {
  const t = transporteDeTeste()
  const handler = comLog('fn', () => {
    throw new Error('explodiu')
  })
  const res = await handler(new Request('https://x/fn', { headers: { 'x-vx-requisicao': 'req9' } }))
  assertEquals(res.status, 500)
  assertEquals(await res.json(), { erro: 'interno', requisicao_id: 'req9' })
  await t.esperar()
  const fatal = t.lotes[0].find((e) => e.nivel === 'fatal')
  assert(fatal)
  assertEquals(fatal.evento, 'excecao_nao_tratada')
  assertEquals(fatal.mensagem, 'explodiu')
  // O 5xx genérico não duplica o fatal.
  assertEquals(t.lotes[0].filter((e) => e.evento === 'resposta_5xx').length, 0)
})

Deno.test('comLog: 5xx sem log do handler vira erro; 4xx vira aviso com o código do corpo', async () => {
  const t = transporteDeTeste()
  const h500 = comLog('fn', () => new Response(JSON.stringify({ erro: 'config_ausente' }), { status: 500, headers: { 'Content-Type': 'application/json' } }))
  const h400 = comLog('fn', () => new Response(JSON.stringify({ error: 'slug_invalido' }), { status: 400, headers: { 'Content-Type': 'application/json' } }))
  const r500 = await h500(new Request('https://x/fn'))
  const r400 = await h400(new Request('https://x/fn'))
  // O corpo continua legível para quem chamou (o clone não o consome).
  assertEquals(await r500.json(), { erro: 'config_ausente' })
  assertEquals(await r400.json(), { error: 'slug_invalido' })
  await t.esperar()
  const [e500] = t.lotes[0]
  const [e400] = t.lotes[1]
  assertEquals([e500.nivel, e500.evento, e500.detalhes.codigo], ['erro', 'resposta_5xx', 'config_ausente'])
  assertEquals([e400.nivel, e400.evento, e400.detalhes.codigo], ['aviso', 'resposta_4xx', 'slug_invalido'])
})

Deno.test('comLog: usuário do JWT vai no contexto; anon não', async () => {
  const t = transporteDeTeste()
  const carga = (o: Record<string, unknown>) => btoa(JSON.stringify(o)).replace(/=+$/, '')
  const jwt = (o: Record<string, unknown>) => `x.${carga(o)}.y`
  const handler = comLog('fn', () => new Response('x', { status: 500 }))
  await handler(new Request('https://x/fn', { headers: { authorization: `Bearer ${jwt({ sub: 'c3cbeaf4-1111-4111-8111-111111111111', role: 'authenticated' })}` } }))
  await handler(new Request('https://x/fn', { headers: { authorization: `Bearer ${jwt({ sub: 'c3cbeaf4-1111-4111-8111-111111111111', role: 'anon' })}` } }))
  await t.esperar()
  assertEquals(t.lotes[0][0].usuario_id, 'c3cbeaf4-1111-4111-8111-111111111111')
  assertEquals(t.lotes[1][0].usuario_id, null)
})

Deno.test('log.contexto acrescenta ao contexto da requisição', async () => {
  const t = transporteDeTeste()
  const log = criarLog('fn')
  const handler = comLog('fn', () => {
    log.contexto({ slug: 'plano-correcao', pedido_id: '1' })
    log.aviso('cupom_invalido', 'Cupom não existe')
    return new Response('ok')
  })
  await handler(new Request('https://x/fn'))
  await t.esperar()
  assertEquals(t.lotes[0][0].contexto.slug, 'plano-correcao')
})

Deno.test('fora de requisição, o log sai na hora, sem id', async () => {
  const t = transporteDeTeste()
  const log = criarLog('boot')
  log.aviso('env_faltando', 'Sem MP_ACCESS_TOKEN')
  await t.esperar()
  assertEquals(t.lotes[0][0].requisicao_id, null)
  assertEquals(t.lotes[0][0].evento, 'env_faltando')
})

Deno.test('transporte que rejeita não derruba ninguém', async () => {
  configurarTransporte(() => Promise.reject(new Error('rede caiu')))
  const log = criarLog('fn')
  log.erro('x', 'y')
  const handler = comLog('fn', () => {
    log.erro('z', 'w')
    return new Response('ok')
  })
  const res = await handler(new Request('https://x/fn'))
  assertEquals(res.status, 200)
  await new Promise((r) => setTimeout(r, 5))
  configurarTransporte(null)
})
