import { useState } from "react";
import { CreditCard, Lock } from "lucide-react";
import CartaoSecao from "./CartaoSecao";
import PagamentoBrick from "./PagamentoBrick";
import PagamentoCartao from "./PagamentoCartao";
import PagamentoPix from "./PagamentoPix";
import SeletorMetodo, { type MetodoPagamento } from "./MetodoPagamento";
import { usarFormularioNovo } from "./flagFormularioNovo";

interface Props {
  id: string;
  totalCentavos: number;
  metodo: MetodoPagamento;
  onMetodo: (metodo: MetodoPagamento) => void;
  /** Percentual do desconto no Pix; `null` = método não muda o preço. */
  descontoPixPercentual: number | null;
  emailInicial: string;
  /**
   * CPF/CNPJ digitado em "Seus dados". Só o formulário novo usa: o
   * `createCardToken` do Secure Fields exige a identificação de quem paga, e
   * sem ela não existe token nem venda. O Brick coleta o dele por conta
   * própria e ignora este valor.
   */
  documento: string;
  processando: boolean;
  erro: string | null;
  onSubmit: (
    formData: unknown,
    cardTokenSalvar: string | null,
  ) => Promise<void>;
  onErroCarregamento: (mensagem: string) => void;
}

/**
 * Seção de pagamento: escolha do método, formulário do Mercado Pago e o erro
 * da última tentativa.
 *
 * É AQUI que a migração para Secure Fields é ligada ou desligada, e em nenhum
 * outro lugar. Com `usarFormularioNovo()` falso — o estado de hoje, e o padrão
 * quando ninguém configurou nada — esta seção renderiza exatamente o que
 * renderizava antes: o Payment Brick dentro do wrapper `.vtx-checkout`, com as
 * mesmas props, na mesma posição da árvore. O caminho novo não é montado, o
 * SDK não é tocado, nenhum iframe é criado.
 *
 * Com a flag ligada, o Brick sai e entram dois componentes nossos, um por
 * método. Eles conversam com a página pelo MESMO `onSubmit(formData, token)` do
 * Brick, então a `CheckoutPage` continua sem saber qual dos dois está na tela.
 *
 * `onErroCarregamento` e `emailInicial` só existem para o Brick: o formulário
 * novo mostra a falha de montagem ao lado dos próprios campos (onde a pessoa
 * está olhando) e não pré-preenche pagador nenhum.
 */
export default function SecaoPagamento({
  id,
  totalCentavos,
  metodo,
  onMetodo,
  descontoPixPercentual,
  emailInicial,
  documento,
  processando,
  erro,
  onSubmit,
  onErroCarregamento,
}: Props) {
  /*
   * Lido a cada render, de propósito: a fonte é a URL mais a env do build, e
   * as duas são constantes durante uma compra. Congelar num `useState` daria a
   * ilusão de estabilidade e deixaria esta seção discordar da `CheckoutPage`,
   * que lê a mesma função para decidir se o documento é obrigatório.
   */
  const formularioNovo = usarFormularioNovo();

  /*
   * A tela abre SEM método escolhido, e o formulário só nasce depois da
   * escolha. Nada de cartão pré-marcado: o padrão faz a pessoa passar direto
   * sem ler as opções, e passar direto pelo Pix é passar direto pelo desconto
   * — que é o método mais barato para a loja.
   *
   * Escolhido um, a lista encolhe para ele mais um link de troca. Trocar volta
   * ao estado inicial, com os dois à mostra.
   *
   * Só no formulário novo: o Brick continua com o seletor de sempre, marcado
   * desde a abertura, porque ele precisa de um método para montar.
   */
  const [escolheu, setEscolheu] = useState(false);

  const seletor = (
    <SeletorMetodo
      metodo={metodo}
      onChange={(novoMetodo) => {
        setEscolheu(true);
        onMetodo(novoMetodo);
      }}
      desabilitado={processando}
      descontoPixPercentual={descontoPixPercentual}
      colapsado={formularioNovo && escolheu}
      onTrocar={() => {
        setEscolheu(false);
        // Volta ao preço cheio junto com a lista: sem método escolhido, exibir
        // o total com desconto do Pix prometeria um abatimento que ninguém
        // pediu ainda.
        onMetodo("cartao");
      }}
      semSelecao={formularioNovo && !escolheu}
    />
  );

  return (
    <CartaoSecao
      id={id}
      icone={<CreditCard className="h-3.5 w-3.5" />}
      titulo="Pagamento"
      aside={
        <span className="flex items-center gap-1.5 text-xs font-light text-muted/80">
          <Lock aria-hidden className="h-3 w-3" />
          Pagamento processado pelo Mercado Pago
        </span>
      }
    >
      {formularioNovo ? (
        !escolheu ? (
          /* Antes da escolha só existem as duas opções. Montar o formulário de
             cartão aqui criaria os iframes do Mercado Pago para quem talvez vá
             de Pix, e encheria a tela de campos que a pessoa ainda não sabe se
             vai preencher. */
          seletor
        ) : metodo === "pix" ? (
          <PagamentoPix
            totalCentavos={totalCentavos}
            processando={processando}
            onSubmit={onSubmit}
            seletor={seletor}
          />
        ) : (
          <PagamentoCartao
            totalCentavos={totalCentavos}
            documento={documento}
            processando={processando}
            onSubmit={onSubmit}
            seletor={seletor}
          />
        )
      ) : (
        /* .vtx-checkout escopa o desenho do botão do Brick a esta página: a
           PagarPage usa o mesmo container id e não pode ser arrastada junto.
           O wrapper fica com o Brick — o botão novo tem pele própria, em
           botaoPagar.css, e não depende deste escopo. */
        <>
          {seletor}
          <div className="vtx-checkout">
            <PagamentoBrick
              totalCentavos={totalCentavos}
              metodo={metodo}
              emailInicial={emailInicial}
              processando={processando}
              onSubmit={onSubmit}
              onErroCarregamento={onErroCarregamento}
            />
          </div>
        </>
      )}

      {erro && (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-red-400/25 bg-red-500/10 px-3 py-2 text-center text-sm text-red-300"
        >
          {erro}
        </p>
      )}

      {/* O aceite dos termos vive no rodapé (CheckoutShell), não aqui: ter a
          mesma declaração em dois lugares da mesma tela só polui a área do
          botão, que é onde a pessoa precisa de foco para concluir. */}
    </CartaoSecao>
  );
}
