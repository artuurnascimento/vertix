/**
 * Feature flag do formulário de cartão com Secure Fields.
 *
 * ---------------------------------------------------------------------------
 * COMO LIGAR E DESLIGAR
 * ---------------------------------------------------------------------------
 *
 *   QA em produção, sem deploy nenhum ......  /c/<slug>?sf=1
 *   Voltar ao Brick só para aquela aba .....  /c/<slug>?sf=0
 *   Ligar para todo mundo ..................  VITE_CHECKOUT_SECURE_FIELDS=1
 *                                             na Vercel + Redeploy
 *   Desligar para todo mundo ...............  apagar a env + Redeploy (~2 min)
 *
 * **Ausente = DESLIGADA.** Enquanto ninguém ligar, quem serve 100% do tráfego
 * é o Payment Brick, exatamente como hoje. Este arquivo é o único lugar do
 * código que decide isso.
 *
 * ---------------------------------------------------------------------------
 * POR QUE ASSIM
 * ---------------------------------------------------------------------------
 *
 * **Query string vence a env, deliberadamente.** São os dois sentidos do
 * rollout, e os dois precisam existir:
 *
 *   • `?sf=1` com a env desligada é como se testa o caminho novo em produção,
 *     com cartão de verdade, sem expor nenhum cliente. Sem isso a única forma
 *     de testar seria ligar para todo mundo — que é exatamente a decisão que a
 *     bateria de testes deveria informar.
 *   • `?sf=0` com a env ligada é o kill-switch individual: durante as 48h de
 *     acompanhamento, um cliente que não conseguir pagar recebe um link do
 *     suporte e compra pelo Brick em segundos, sem esperar redeploy.
 *
 * **Sem `localStorage`.** Estado pegajoso e invisível transforma cada chamado
 * de suporte em investigação: a pessoa diz "não funciona" e ninguém consegue
 * reproduzir porque o navegador dela guardou uma escolha de três semanas atrás.
 * Aqui a verdade está sempre na barra de endereço ou na env — os dois
 * visíveis, os dois reversíveis fechando a aba ou trocando uma variável.
 *
 * **Só `'1'` liga.** `'true'`, `'sim'`, `''` e qualquer outra coisa contam
 * como desligado. Uma env com valor inesperado nunca deve LIGAR um caminho
 * novo no checkout que está vendendo; na dúvida, o Brick.
 */

/** Nome do parâmetro na URL. Curto de propósito: vai em link de suporte. */
const PARAMETRO = 'sf'

/** Único valor que liga, na URL e na env. Ver "Só `'1'` liga" acima. */
const LIGADO = '1'

/** Único valor que desliga explicitamente na URL, vencendo a env. */
const DESLIGADO = '0'

/**
 * `true` quando esta visita deve usar o formulário novo (Secure Fields) em vez
 * do Payment Brick.
 *
 * @param busca Query string a considerar. O padrão é a da página; o parâmetro
 *   existe para o teste não precisar mexer no `history` do jsdom, e para deixar
 *   a função pura quando ele é passado.
 */
export function usarFormularioNovo(
  busca: string = typeof window === 'undefined' ? '' : window.location.search
): boolean {
  const escolha = new URLSearchParams(busca).get(PARAMETRO)
  if (escolha === LIGADO) return true
  if (escolha === DESLIGADO) return false

  return (
    (import.meta.env.VITE_CHECKOUT_SECURE_FIELDS as string | undefined) ===
    LIGADO
  )
}
