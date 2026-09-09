/**
 * Preenchimento do formulário do comprador com o que ele já respondeu antes.
 *
 * Quem chega pelo Vertix Scan já digitou nome, e-mail e WhatsApp no portão da
 * análise profunda. A `scan-comprar` guardou esses três em `clients` na hora
 * de abrir a cobrança e mandou o comprador para
 * `/c/plano-correcao?a=<analise>&t=<payment_token>`. É o `t` que esta função
 * troca de volta pelos dados — pelo token da cobrança, nunca pelo id da
 * análise, que anda em link encaminhável (ver a migration da RPC).
 *
 * Nada aqui pode derrubar o checkout: qualquer falha vira `null`, o formulário
 * fica vazio e a venda segue como sempre seguiu.
 */

import { supabase } from '../../lib/supabase'
import { mascararWhatsapp } from './clienteForm'

export interface PrefillCliente {
  nome: string
  email: string
  /** Já mascarado — vai direto para o campo, sem passar pela máscara de novo. */
  whatsapp: string
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Filtro de forma antes de sair pela rede. `?t=` é escrito por nós, mas chega
 * pela URL: sem esta checagem, um valor colado torto vira uma chamada que o
 * Postgres recusa por tipo (`invalid input syntax for type uuid`) e um erro
 * vermelho no console de uma página de pagamento.
 */
export function tokenValido(valor: string | null | undefined): boolean {
  return typeof valor === 'string' && UUID_RE.test(valor.trim())
}

function texto(valor: unknown): string {
  return typeof valor === 'string' ? valor.trim() : ''
}

/**
 * `+5562999999999` → `(62) 99999-9999`.
 *
 * O Scan grava em E.164 e o campo da tela é brasileiro com máscara. O `55` só
 * cai fora quando o resto sobra com tamanho de número nacional (10 ou 11
 * dígitos) — senão um celular do DDD 55 (Santa Maria, RS) perderia o próprio
 * DDD e o comprador veria o número errado no campo.
 *
 * Depois disso a FORMA é conferida, não só o tamanho: DDD a partir de 11,
 * celular com nove dígitos começando em 9, fixo com oito começando entre 2 e
 * 5. Contar dígitos não bastava — um `+1 415 555 0000` também tem onze e
 * entrava no campo como `(14) 15555-0000`, um número plausível o bastante
 * para ninguém reler.
 *
 * O que não passa vira string vazia: campo em branco é melhor que campo com
 * número torto, que a pessoa não confere porque parece preenchido.
 */
export function telefoneParaCampo(valor: unknown): string {
  const bruto = texto(valor).replace(/\D/g, '')
  const numeros =
    bruto.startsWith('55') && (bruto.length === 12 || bruto.length === 13)
      ? bruto.slice(2)
      : bruto

  const ddd = numeros.slice(0, 2)
  const assinante = numeros.slice(2)
  if (Number(ddd) < 11) return ''
  const brasileiro =
    (assinante.length === 9 && assinante.startsWith('9')) ||
    (assinante.length === 8 && /^[2-5]/.test(assinante))
  return brasileiro ? mascararWhatsapp(numeros) : ''
}

/**
 * Busca os dados do comprador pela cobrança. `null` quando não há token
 * válido, quando a RPC falha ou quando a linha não tem nome nem e-mail —
 * nesse último caso não há o que preencher, e devolver um objeto de campos
 * vazios só faria a tela anunciar um preenchimento que não aconteceu.
 */
export async function buscarPrefill(
  token: string
): Promise<PrefillCliente | null> {
  if (!tokenValido(token)) return null

  const { data, error } = await supabase.rpc('get_checkout_prefill', {
    p_token: token.trim(),
  })
  if (error || data === null || typeof data !== 'object') return null

  const linha = data as Record<string, unknown>
  const prefill: PrefillCliente = {
    nome: texto(linha.nome),
    email: texto(linha.email).toLowerCase(),
    whatsapp: telefoneParaCampo(linha.whatsapp),
  }
  return prefill.nome !== '' || prefill.email !== '' ? prefill : null
}
