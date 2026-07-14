/**
 * Utilitário de link do WhatsApp — normalização de telefone BR + wa.me.
 * Usado por AReceberTab (cobrança de parcela) e ClientDetail (contato geral).
 */

const MIN_DDD_DIGITS = 10
const MAX_DDD_DIGITS = 11
const BR_COUNTRY_CODE = '55'
const MIN_WITH_COUNTRY_DIGITS = 12
const MAX_WITH_COUNTRY_DIGITS = 13

/**
 * Normaliza um telefone BR para o formato E.164 sem "+" (ddi+ddd+numero).
 * - Remove tudo que não for dígito.
 * - 10-11 dígitos (DDD + número, sem DDI) → prefixa "55".
 * - 12-13 dígitos já com "55" → mantém como está.
 * - Qualquer outra contagem de dígitos → inválido (null).
 */
export function normalizePhoneBR(
  telefone: string | null | undefined
): string | null {
  if (!telefone) return null
  const digits = telefone.replace(/\D/g, '')

  if (digits.length >= MIN_DDD_DIGITS && digits.length <= MAX_DDD_DIGITS) {
    return `${BR_COUNTRY_CODE}${digits}`
  }

  if (
    digits.length >= MIN_WITH_COUNTRY_DIGITS &&
    digits.length <= MAX_WITH_COUNTRY_DIGITS &&
    digits.startsWith(BR_COUNTRY_CODE)
  ) {
    return digits
  }

  return null
}

/**
 * Monta o link wa.me com mensagem pré-preenchida. Retorna null quando o
 * telefone é ausente ou inválido — chamador deve ocultar a ação, nunca
 * desabilitá-la.
 */
export function buildWhatsAppLink(
  telefone: string | null | undefined,
  mensagem: string
): string | null {
  const normalized = normalizePhoneBR(telefone)
  if (!normalized) return null
  return `https://wa.me/${normalized}?text=${encodeURIComponent(mensagem)}`
}

/** Primeiro nome a partir do nome completo — "" ou nulo vira null. */
export function firstNameOf(fullName: string | null | undefined): string | null {
  if (!fullName) return null
  const trimmed = fullName.trim()
  if (trimmed === '') return null
  return trimmed.split(/\s+/)[0]
}
