import { describe, expect, test } from 'vitest'
import html from '../../index.html?raw'
import vercelJson from '../../vercel.json?raw'

/**
 * O index.html tem UM script inline (o prefetch da oferta do checkout). No
 * host do painel a CSP só permite scripts próprios — o inline entra pelo
 * hash SHA-256 gravado no vercel.json. Este teste mantém os dois em sincronia:
 * mudou o script, o hash muda, e o teste avisa antes do deploy quebrar a
 * página com "Refused to execute inline script".
 *
 * As CSPs do checkout (pay.vertix.studio e /c/) usam 'unsafe-inline' por
 * causa do SDK do Mercado Pago. Um hash ali seria um tiro no pé: com hash
 * presente, o navegador IGNORA 'unsafe-inline' e bloqueia os scripts do MP.
 */

const vercel = JSON.parse(vercelJson) as {
  headers: Array<{ headers: Array<{ key: string; value: string }> }>
}

function scriptsInline(): string[] {
  return [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1])
}

async function hashDe(conteudo: string): Promise<string> {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(conteudo)))
  return `'sha256-${btoa(String.fromCharCode(...bytes))}'`
}

const csps = vercel.headers.flatMap((bloco) =>
  bloco.headers.filter((h) => h.key === 'Content-Security-Policy').map((h) => h.value)
)

/** Só a diretiva script-src — style-src também tem 'unsafe-inline' e não conta. */
const scriptSrcDe = (csp: string) => /script-src ([^;]+)/.exec(csp)?.[1] ?? ''

describe('script inline do index.html × CSP do vercel.json', () => {
  test('há exatamente um script inline, e ele só age em /c/', () => {
    const scripts = scriptsInline()
    expect(scripts).toHaveLength(1)
    expect(scripts[0]).toContain('/^\\/c\\/')
    expect(scripts[0]).toContain('/api/checkout-info?slug=')
    expect(scripts[0]).toContain('__vxCheckoutInfo')
  })

  test('a CSP estrita (painel) autoriza o script pelo hash', async () => {
    const hash = await hashDe(scriptsInline()[0])
    const estritas = csps.map(scriptSrcDe).filter((s) => !s.includes("'unsafe-inline'"))
    expect(estritas.length).toBeGreaterThan(0)
    for (const scriptSrc of estritas) expect(scriptSrc).toContain(hash)
  })

  test("as CSPs do checkout ('unsafe-inline') não carregam hash nenhum", () => {
    const abertas = csps.map(scriptSrcDe).filter((s) => s.includes("'unsafe-inline'"))
    expect(abertas.length).toBeGreaterThan(0)
    for (const scriptSrc of abertas) expect(scriptSrc).not.toMatch(/'sha256-|'nonce-/)
  })
})
