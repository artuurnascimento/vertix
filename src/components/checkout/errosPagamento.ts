/**
 * Tradução dos códigos de erro da `checkout-pagar` para o que o comprador lê.
 *
 * Fora do componente porque é dado, não interface — e porque assim dá para
 * conferir a lista inteira num lugar só quando o backend acrescentar um código.
 */

const ERROS_PAGAMENTO: Record<string, string> = {
  gateway_recusou:
    'Pagamento recusado pelo emissor. Tente outro cartão ou pague no Pix.',
  cupom_invalido: 'O cupom não vale mais. Remova-o e tente de novo.',
  dados_pagamento_incompletos:
    'Faltou algum dado do cartão. Confira e envie de novo.',
  email_invalido: 'Confira o e-mail informado.',
  nome_obrigatorio: 'Informe seu nome completo.',
  checkout_nao_encontrado:
    'Esta oferta saiu do ar. Peça um link novo a quem te enviou.',
  valor_invalido:
    'O valor do pedido mudou. Recarregue a página e tente de novo.',
  falha_ao_criar_pedido:
    'Não conseguimos registrar seu pedido. Tente de novo em instantes.',
}

const GENERICA =
  'Não foi possível concluir o pagamento. Tente outro cartão ou pague no Pix.'

/**
 * Nunca devolve código cru: "gateway_recusou" não diz nada a quem só quer
 * comprar. A mensagem do backend entra quando existe (é ela que explica o
 * cupom); no resto, o texto genérico, que ao menos aponta uma saída.
 */
export function mensagemDeErro(
  erro: string | null,
  mensagem: string | null
): string {
  if (erro !== null && ERROS_PAGAMENTO[erro]) return ERROS_PAGAMENTO[erro]
  if (mensagem !== null) return mensagem
  return GENERICA
}
