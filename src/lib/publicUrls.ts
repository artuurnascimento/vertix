/**
 * Domínios públicos dos links enviados a clientes. O admin roda em
 * sistema.vertix.studio, mas o que o cliente recebe usa os domínios curtos —
 * os três apontam para o mesmo deploy, então qualquer rota funciona em
 * qualquer um; estes são os "oficiais" de cada contexto.
 */

export const PROPOSTA_PUBLIC_BASE = 'https://go.vertix.studio'
export const PAGAR_PUBLIC_BASE = 'https://pay.vertix.studio'

export const ADMIN_BASE = 'https://sistema.vertix.studio'

/** Hosts de link público têm CSP mais permissiva — o painel não roda neles. */
export const PUBLIC_LINK_HOSTS = ['pay.vertix.studio', 'go.vertix.studio']

export function isPublicLinkHost(): boolean {
  return PUBLIC_LINK_HOSTS.includes(window.location.hostname)
}

export function propostaPublicUrl(token: string): string {
  // O domínio já diz o contexto — o token vai direto na raiz.
  return `${PROPOSTA_PUBLIC_BASE}/${token}`
}

export function pagarPublicUrl(paymentToken: string): string {
  return `${PAGAR_PUBLIC_BASE}/${paymentToken}`
}
