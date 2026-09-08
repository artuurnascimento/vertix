import type { ReactNode } from 'react'
import './botaoPagar.css'

interface Props {
  /** Cobrança em curso: trava o clique e conta o que está acontecendo. */
  processando: boolean
  /** Trava por outro motivo (formulário incompleto, por exemplo). */
  desabilitado?: boolean
  /** Verbo do rótulo, antes do valor. */
  rotulo?: string
  /** `submit` quando o botão fecha um <form>; `button` usa o onClick. */
  type?: 'button' | 'submit'
  onClick?: () => void
  /** Marca do meio de pagamento à esquerda do rótulo. Decorativa. */
  icone?: ReactNode
}

/**
 * Botão de pagar do checkout — o CTA da página.
 *
 * Substitui o botão que o Payment Brick desenhava sozinho. Com Secure Fields
 * o submit é nosso, então o botão também precisa ser: é ele que mostra o
 * valor ao vivo (bump, cupom, troca de método) e o estado da cobrança.
 *
 * O estado de processamento aparece de três formas ao mesmo tempo, e as três
 * são necessárias: `disabled` impede a segunda cobrança, a onda no fundo
 * mostra que algo está acontecendo, e o texto — DOM de verdade, mais o
 * `role="status"` abaixo — diz o quê. Botão que só gira um spinner deixa
 * quem não enxerga sem nenhuma pista de que o clique pegou.
 */
export default function BotaoPagar({
  processando,
  desabilitado = false,
  rotulo = 'Pagar agora',
  type = 'button',
  onClick,
  icone,
}: Props) {
  /*
   * O rótulo NÃO carrega mais o valor. Ele aparece no resumo, na barra fixa do
   * celular e no total logo acima — repeti-lo dentro do botão engordava a
   * frase sem acrescentar informação, e um botão de ação lê melhor curto.
   * `totalCentavos` fica na assinatura porque a página ainda o usa para
   * decidir o caso de pedido sem valor a pagar.
   */
  const texto = rotulo

  return (
    <>
      <button
        type={type}
        className="vtx-btn-pagar"
        data-processando={processando ? 'sim' : undefined}
        disabled={processando || desabilitado}
        aria-busy={processando}
        onClick={onClick}
      >
        {icone}
        <span className="vtx-btn-pagar__rotulo">
          {processando ? 'Processando…' : texto}
        </span>
      </button>

      {/*
        O rótulo troca enquanto o botão está desabilitado, e leitor de tela
        não anuncia mudança dentro de um elemento que perdeu o foco. Esta
        região é quem conta — e fica vazia no repouso, para não repetir o
        texto do botão a cada render.
      */}
      <span role="status" className="sr-only">
        {processando ? 'Processando o pagamento. Aguarde.' : ''}
      </span>
    </>
  )
}
