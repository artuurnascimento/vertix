/**
 * Feature flag do formulário de cartão com Secure Fields.
 *
 * ---------------------------------------------------------------------------
 * ESTADO ATUAL: **o formulário novo é o padrão.**
 * ---------------------------------------------------------------------------
 *
 * O Secure Fields passou na bateria de testes em produção (`?sf=1`, cartão de
 * verdade) e foi promovido: quem chega em `/c/<slug>` sem parâmetro nenhum
 * recebe ele. O Payment Brick continua no código, mas agora como caminho de
 * volta, não como padrão.
 *
 *   Voltar ao Brick só para uma pessoa ......  /c/<slug>?sf=0
 *   Voltar ao Brick para todo mundo .........  VITE_CHECKOUT_SECURE_FIELDS=0
 *                                              na Vercel + Redeploy (~2 min)
 *   Forçar o novo numa aba ..................  /c/<slug>?sf=1
 *
 * ---------------------------------------------------------------------------
 * POR QUE ASSIM
 * ---------------------------------------------------------------------------
 *
 * **O padrão mora no código, não numa env.** Enquanto o novo formulário era
 * candidato, o default seguro era o Brick e a env era o interruptor de subida.
 * Agora que ele é O checkout, deixar isso preso a `VITE_CHECKOUT_SECURE_FIELDS`
 * na Vercel significaria que apagar uma variável — ou criar um preview, ou um
 * projeto novo — voltaria silenciosamente ao formulário antigo, sem ninguém
 * pedir. O repositório passa a dizer a verdade sobre o que está vendendo.
 *
 * **Query string vence a env, deliberadamente.** Continuam sendo os dois
 * sentidos do rollout:
 *
 *   • `?sf=0` é o kill-switch individual: se alguém não conseguir pagar, o
 *     suporte manda o link com o parâmetro e a pessoa compra pelo Brick em
 *     segundos, sem esperar redeploy.
 *   • `?sf=1` força o caminho novo mesmo com a env de volta ligada, que é como
 *     se confere um bug reportado sem tirar o resto do mundo do Brick.
 *
 * **Sem `localStorage`.** Estado pegajoso e invisível transforma cada chamado
 * de suporte em investigação: a pessoa diz "não funciona" e ninguém consegue
 * reproduzir porque o navegador dela guardou uma escolha de três semanas atrás.
 * Aqui a verdade está sempre na barra de endereço ou na env — os dois
 * visíveis, os dois reversíveis fechando a aba ou trocando uma variável.
 *
 * **Só `'0'` desliga.** `'false'`, `'nao'`, `''` e qualquer outra coisa contam
 * como o padrão, que hoje é o formulário novo. A regra é a mesma de antes com
 * o sinal trocado: um valor inesperado nunca deve TROCAR o checkout que está
 * vendendo. Antes isso protegia o Brick; agora protege o Secure Fields.
 */

/** Nome do parâmetro na URL. Curto de propósito: vai em link de suporte. */
const PARAMETRO = 'sf'

/** Valor que força o formulário novo, na URL e na env. */
const LIGADO = '1'

/** Único valor que volta ao Brick, na URL e na env. Ver "Só `'0'` desliga". */
const DESLIGADO = '0'

/**
 * `true` quando esta visita deve usar o formulário novo (Secure Fields) em vez
 * do Payment Brick. Hoje é o padrão: só um `0` explícito devolve o Brick.
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
    (import.meta.env.VITE_CHECKOUT_SECURE_FIELDS as string | undefined) !==
    DESLIGADO
  )
}
