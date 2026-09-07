/**
 * Validação e máscaras do formulário do comprador. Fora do componente porque
 * é lógica pura — assim dá para testar sem montar React, e o componente fica
 * só com a interface.
 *
 * O mínimo de campos possível: nome, e-mail, WhatsApp e (quando o checkout
 * exige) CPF/CNPJ. Cada campo a mais é gente desistindo no meio.
 */

import type { ClienteCheckout } from './checkoutApi'

export type CampoCliente = keyof ClienteCheckout
export type ErrosCliente = Partial<Record<CampoCliente, string>>

export const CLIENTE_VAZIO: ClienteCheckout = {
  nome: '',
  email: '',
  whatsapp: '',
  documento: '',
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

function digitos(valor: string): string {
  return valor.replace(/\D/g, '')
}

/** (62) 99999-9999 enquanto digita; corta o que passa de 11 dígitos. */
export function mascararWhatsapp(valor: string): string {
  const numeros = digitos(valor).slice(0, 11)
  if (numeros.length <= 2) return numeros
  const ddd = numeros.slice(0, 2)
  const resto = numeros.slice(2)
  if (resto.length <= 4) return `(${ddd}) ${resto}`
  const corte = resto.length > 8 ? 5 : 4
  return `(${ddd}) ${resto.slice(0, corte)}-${resto.slice(corte)}`
}

/** 000.000.000-00 até 11 dígitos; 00.000.000/0000-00 daí para cima. */
export function mascararDocumento(valor: string): string {
  const numeros = digitos(valor).slice(0, 14)
  if (numeros.length <= 11) {
    return numeros
      .replace(/^(\d{3})(\d)/, '$1.$2')
      .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4')
  }
  return numeros
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3/$4')
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})(\d)/, '$1.$2.$3/$4-$5')
}

/** Dígitos verificadores do CPF — pega o erro de digitação antes do gateway. */
function cpfValido(numeros: string): boolean {
  if (numeros.length !== 11 || /^(\d)\1{10}$/.test(numeros)) return false
  for (const [inicio, posicao] of [
    [9, 10],
    [10, 11],
  ]) {
    let soma = 0
    for (let i = 0; i < inicio; i++) {
      soma += Number(numeros[i]) * (posicao - i)
    }
    const resto = (soma * 10) % 11
    const digito = resto === 10 ? 0 : resto
    if (digito !== Number(numeros[inicio])) return false
  }
  return true
}

function cnpjValido(numeros: string): boolean {
  if (numeros.length !== 14 || /^(\d)\1{13}$/.test(numeros)) return false
  const pesos = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  for (const tamanho of [12, 13]) {
    const inicio = pesos.length - tamanho
    let soma = 0
    for (let i = 0; i < tamanho; i++) {
      soma += Number(numeros[i]) * pesos[inicio + i]
    }
    const resto = soma % 11
    const digito = resto < 2 ? 0 : 11 - resto
    if (digito !== Number(numeros[tamanho])) return false
  }
  return true
}

export function documentoValido(valor: string): boolean {
  const numeros = digitos(valor)
  if (numeros.length === 11) return cpfValido(numeros)
  if (numeros.length === 14) return cnpjValido(numeros)
  return false
}

export function validarCliente(
  cliente: ClienteCheckout,
  exigeDocumento: boolean
): ErrosCliente {
  const erros: ErrosCliente = {}

  if (cliente.nome.trim().length < 3) {
    erros.nome = 'Informe seu nome completo.'
  }
  if (!EMAIL_RE.test(cliente.email.trim())) {
    erros.email = 'Informe um e-mail válido — o acesso vai para ele.'
  }
  const numerosWhats = digitos(cliente.whatsapp)
  if (numerosWhats.length < 10 || numerosWhats.length > 11) {
    erros.whatsapp = 'Informe o WhatsApp com DDD.'
  }
  // O documento é opcional no backend (vira `payer.identification` no Mercado
  // Pago só quando vem preenchido). Então: obrigatório apenas se o checkout
  // exigir; digitado errado, sempre barrado — deixar passar um CPF com dígito
  // trocado é trocar um aviso na tela por uma recusa do emissor.
  const documentoPreenchido = digitos(cliente.documento).length > 0
  if (
    (exigeDocumento || documentoPreenchido) &&
    !documentoValido(cliente.documento)
  ) {
    erros.documento = 'Informe um CPF ou CNPJ válido.'
  }

  return erros
}

/** Versão limpa para enviar ao servidor (só dígitos onde faz sentido). */
export function clienteParaEnvio(cliente: ClienteCheckout): ClienteCheckout {
  return {
    nome: cliente.nome.trim(),
    email: cliente.email.trim().toLowerCase(),
    whatsapp: digitos(cliente.whatsapp),
    documento: digitos(cliente.documento),
  }
}
