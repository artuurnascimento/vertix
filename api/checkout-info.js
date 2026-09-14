/**
 * GET /api/checkout-info?slug=<slug> — a oferta do checkout, servida pela CDN
 * da Vercel (região gru1, ao lado do comprador) em vez de cada navegador ir
 * até o Postgres em us-east-1.
 *
 * Por que existe: a página fica em "Carregando checkout…" até a RPC
 * get_checkout_info responder. Medido de produção: 250 ms no melhor caso,
 * com picos de 1,8 s — e isso depois de o JS todo ter baixado e executado.
 * Aqui a resposta fica em cache por 30 s (`s-maxage`) e é servida velha por
 * até 5 min enquanto revalida em segundo plano: a segunda pessoa a abrir o
 * checkout recebe a oferta em ~30 ms. O index.html ainda dispara este GET
 * antes de o JS chegar (ver o script de prefetch lá).
 *
 * A oferta muda raramente (o painel edita copy/preço); o preço que VALE é
 * sempre o que a checkout-pagar lê do banco na hora de cobrar — o cache só
 * pode atrasar a prévia na tela por meio minuto.
 *
 * JS puro e sem imports, como api/geo.js: função ESM da Vercel.
 *
 * @param {{ url?: string, headers: Record<string, string | string[] | undefined> }} req
 * @param {{ setHeader: (n: string, v: string) => unknown, status: (c: number) => { send: (b: string) => unknown, json: (b: unknown) => unknown } }} res
 */
/**
 * Manda uma entrada para a trilha de logs do painel (RPC registrar_log,
 * anon). Espera no máximo 1,5 s e nunca lança: a resposta de erro ao
 * navegador não pode ficar presa atrás do log.
 * @param {string} url
 * @param {string} chave
 * @param {Record<string, unknown>} entrada
 */
async function registrarLog(url, chave, entrada) {
  try {
    await fetch(`${url.replace(/\/$/, '')}/rest/v1/rpc/registrar_log`, {
      method: 'POST',
      headers: { apikey: chave, Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_entradas: [{ origem: 'vercel', fonte: 'api/checkout-info', ...entrada }] }),
      signal: AbortSignal.timeout(1500),
    })
  } catch {
    // sem log, sem drama
  }
}

export default async function handler(req, res) {
  const slug =
    new URL(req.url ?? '/', 'http://x').searchParams.get('slug')?.trim().toLowerCase() ?? ''
  if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(slug)) {
    res.setHeader('Cache-Control', 'no-store')
    res.status(400).json({ error: 'slug_invalido' })
    return
  }

  const url = process.env.VITE_SUPABASE_URL
  const chave = process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !chave) {
    res.setHeader('Cache-Control', 'no-store')
    res.status(503).json({ error: 'config_ausente' })
    return
  }

  try {
    const resposta = await fetch(`${url.replace(/\/$/, '')}/rest/v1/rpc/get_checkout_info`, {
      method: 'POST',
      headers: {
        apikey: chave,
        Authorization: `Bearer ${chave}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_slug: slug }),
    })
    const corpo = await resposta.text()
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    if (!resposta.ok) {
      res.setHeader('Cache-Control', 'no-store')
      await registrarLog(url, chave, {
        nivel: 'erro', evento: 'rpc_falhou',
        mensagem: `get_checkout_info respondeu ${resposta.status} para ${slug}`,
        detalhes: { status: resposta.status, corpo: corpo.slice(0, 500) }, contexto: { slug },
      })
      res.status(502).send(corpo || '{"error":"rpc"}')
      return
    }
    res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=300')
    res.status(200).send(corpo)
  } catch (erro) {
    res.setHeader('Cache-Control', 'no-store')
    await registrarLog(url, chave, {
      nivel: 'erro', evento: 'rpc_indisponivel',
      mensagem: `get_checkout_info indisponível para ${slug}: ${erro instanceof Error ? erro.message : String(erro)}`,
      detalhes: { erro: String(erro) }, contexto: { slug },
    })
    res.status(502).json({ error: 'rpc_indisponivel' })
  }
}
