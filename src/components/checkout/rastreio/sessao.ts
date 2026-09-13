/**
 * Identidade da visita. Duas chaves, com vidas diferentes:
 *
 *   sessionStorage `vx-rastreio:<slug>`  A SESSÃO: uma por aba, morre com a
 *                                        aba. Sobrevive ao upsell e ao
 *                                        obrigado (mesma aba) e ao F5.
 *   localStorage   `vx-visitante`        O NAVEGADOR: repete entre visitas.
 *                                        É o que permite dizer "voltou pela
 *                                        terceira vez".
 *
 * Storage pode não existir (Safari em modo privado antigo, iframe com
 * cookies bloqueados): tudo aqui aceita `null` e segue sem guardar — a
 * sessão vira "só desta carga de página", o que ainda é rastreio útil.
 */

export const PREFIXO_SESSAO = 'vx-rastreio:'
export const CHAVE_VISITANTE = 'vx-visitante'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function gerarId(): string {
  const c = globalThis.crypto
  if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  // Fallback para ambientes sem randomUUID: v4 a partir de getRandomValues.
  const bytes = new Uint8Array(16)
  if (c && typeof c.getRandomValues === 'function') c.getRandomValues(bytes)
  else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256)
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

function ler(armazem: Storage | null, chave: string): string | null {
  try {
    const valor = armazem?.getItem(chave) ?? null
    return valor && UUID.test(valor) ? valor : null
  } catch {
    return null
  }
}

function gravar(armazem: Storage | null, chave: string, valor: string): void {
  try {
    armazem?.setItem(chave, valor)
  } catch {
    // Sem storage não há o que fazer; a sessão vale só nesta página.
  }
}

/** A sessão desta aba para este checkout — reaproveitada se já existir. */
export function sessaoDaVisita(
  slug: string,
  armazem: Storage | null,
  gerar: () => string = gerarId
): { id: string; nova: boolean } {
  const chave = PREFIXO_SESSAO + slug
  const existente = ler(armazem, chave)
  if (existente) return { id: existente, nova: false }
  const id = gerar()
  gravar(armazem, chave, id)
  return { id, nova: true }
}

/** Só devolve a sessão se ela já existir: upsell/obrigado abertos por link
 *  direto (e-mail, outra aba) não são uma visita ao checkout. */
export function sessaoExistente(slug: string, armazem: Storage | null): string | null {
  return ler(armazem, PREFIXO_SESSAO + slug)
}

export function visitanteDaMaquina(
  armazem: Storage | null,
  gerar: () => string = gerarId
): string {
  const existente = ler(armazem, CHAVE_VISITANTE)
  if (existente) return existente
  const id = gerar()
  gravar(armazem, CHAVE_VISITANTE, id)
  return id
}
