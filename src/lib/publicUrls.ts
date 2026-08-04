/**
 * Domínios públicos dos links enviados a clientes. O admin roda em
 * sistema.vertix.studio, mas o que o cliente recebe usa os domínios curtos —
 * os três apontam para o mesmo deploy, então qualquer rota funciona em
 * qualquer um; estes são os "oficiais" de cada contexto.
 */

export const PROPOSTA_PUBLIC_BASE = 'https://go.vertix.studio'
export const PAGAR_PUBLIC_BASE = 'https://pay.vertix.studio'

export function propostaPublicUrl(token: string): string {
  // O domínio já diz o contexto — o token vai direto na raiz.
  return `${PROPOSTA_PUBLIC_BASE}/${token}`
}

export function pagarPublicUrl(paymentToken: string): string {
  return `${PAGAR_PUBLIC_BASE}/${paymentToken}`
}
