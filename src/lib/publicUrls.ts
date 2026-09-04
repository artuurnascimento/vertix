/**
 * Domínios públicos dos links enviados a clientes. O admin roda em
 * sistema.vertix.studio, mas o que o cliente recebe usa os domínios curtos —
 * os três apontam para o mesmo deploy, então qualquer rota funciona em
 * qualquer um; estes são os "oficiais" de cada contexto.
 */

export const PROPOSTA_PUBLIC_BASE = 'https://go.vertix.studio'
export const PAGAR_PUBLIC_BASE = 'https://pay.vertix.studio'
export const BIO_PUBLIC_BASE = 'https://vertix.bio'

export const ADMIN_BASE = 'https://sistema.vertix.studio'

/** O bio responde no domínio raiz e no www (a Vercel pode redirecionar um
 *  para o outro; aceitar os dois evita depender disso). */
export const BIO_HOSTS = ['vertix.bio', 'www.vertix.bio'] as const

/**
 * Hosts públicos: o painel não roda neles e a abertura animada da marca não
 * aparece. O de pagamento tem CSP própria (MercadoPago); os outros herdam a
 * CSP estrita, que já libera o que precisam.
 */
export const PUBLIC_LINK_HOSTS: readonly string[] = [
  'pay.vertix.studio',
  'go.vertix.studio',
  ...BIO_HOSTS,
]

export function isPublicLinkHost(): boolean {
  return PUBLIC_LINK_HOSTS.includes(window.location.hostname)
}

/**
 * Host do link de bio. Recebe o nome por argumento em vez de ler o navegador
 * por dentro, para ser testável sem simular ambiente.
 */
export function ehHostBio(hostname: string): boolean {
  return (BIO_HOSTS as readonly string[]).includes(hostname)
}

export function propostaPublicUrl(token: string): string {
  // O domínio já diz o contexto — o token vai direto na raiz.
  return `${PROPOSTA_PUBLIC_BASE}/${token}`
}

export function pagarPublicUrl(paymentToken: string): string {
  return `${PAGAR_PUBLIC_BASE}/${paymentToken}`
}
