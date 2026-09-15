/**
 * Chaves do site institucional.
 *
 * SITE_EM_CONSTRUCAO = true → o visitante só vê a página "Estamos em
 * construção" (o App real nem é carregado). Trocar para false quando o
 * site novo estiver pronto.
 */
export const SITE_EM_CONSTRUCAO = true

/** Progresso exibido na barra da página em construção (0–100). */
export const PROGRESSO_SITE = 68

export const WHATSAPP_VERTIX = '5562996076194'
export const EMAIL_VERTIX = 'contato@vertix.studio'

const MENSAGEM_WHATSAPP =
  'Oi, Vertix! Vi que o site está em construção e quero falar com vocês.'

export const LINK_WHATSAPP = `https://wa.me/${WHATSAPP_VERTIX}?text=${encodeURIComponent(
  MENSAGEM_WHATSAPP,
)}`
