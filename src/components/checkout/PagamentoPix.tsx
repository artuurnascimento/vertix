import type { ReactNode } from "react";
import { Clock, Lock, QrCode, Zap } from "lucide-react";
import BotaoPagar from "./BotaoPagar";
import IconePix from "./IconePix";

interface Props {
  /** Total já com cupom e com o desconto do Pix aplicados. */
  totalCentavos: number;
  processando: boolean;
  /**
   * Mesmo contrato do Brick: recebe o formData e o segundo token do cartão.
   * No Pix não existe cartão, então o segundo argumento é sempre `null`.
   * Rejeita quando a cobrança falha — a página é quem mostra a mensagem.
   */
  onSubmit: (
    formData: unknown,
    cardTokenSalvar: string | null,
  ) => Promise<void>;
  /** Escolha do método, mostrada acima do painel. */
  seletor?: ReactNode;
}

/**
 * Único campo que o servidor lê para cobrar no Pix.
 *
 * É ele que dá o desconto do método (`checkout-pagar/index.ts:356-360`) E que
 * faz a cobrança ser Pix (`:362`). No ramo do Pix o servidor não envia
 * `token`, `installments` nem `issuer_id` (`:481-484`) — mandar qualquer um
 * deles daqui não ajuda em nada e arrisca cair no ramo do cartão, que recusa
 * sem token.
 *
 * Congelado porque é literal compartilhado entre submits: um consumidor que o
 * mutasse mudaria silenciosamente o método de pagamento da venda seguinte.
 */
const FORM_DATA_PIX = Object.freeze({ payment_method_id: "pix" });

/**
 * Painel do Pix sem o Payment Brick.
 *
 * O Pix nunca precisou de Secure Fields: não há dado de cartão para proteger,
 * e o Brick só servia para desenhar um botão. Aqui o clique manda o único
 * campo que o servidor lê e a página segue para o QR (`CheckoutPage` troca
 * para o estado `pix` quando a resposta traz o código).
 *
 * O que o painel promete é o que o servidor cumpre: o código nasce com uma
 * hora de validade (`date_of_expiration`) e quem confirma o pagamento é o
 * webhook — por isso nada aqui diz "aprovado na hora" como se a tela fosse
 * saber disso sozinha.
 */
export default function PagamentoPix({
  totalCentavos,
  processando,
  onSubmit,
  seletor,
}: Props) {
  /*
   * `onSubmit` rejeita de propósito quando a cobrança falha — era assim que o
   * Brick sabia manter o formulário utilizável. Aqui não há formulário para
   * destravar e a mensagem de erro já aparece na seção de pagamento, então a
   * rejeição é absorvida: deixá-la escapar só produziria um unhandled
   * rejection no console do cliente.
   */
  const pagar = (formData: unknown) => {
    void onSubmit(formData, null).catch(() => undefined);
  };

  if (totalCentavos <= 0) {
    /*
     * Cupom cobriu o pedido inteiro. Mesmo caminho do Brick hoje
     * (`PagamentoBrick.tsx:198-219`): manda `formData` nulo.
     *
     * AVISO, e é deliberado: este caminho JÁ ESTÁ QUEBRADO em produção. O
     * servidor responde 400 `dados_pagamento_incompletos` para `formData`
     * nulo (`checkout-pagar/index.ts:311-314`) e barraria de novo em
     * `VALOR_MINIMO_CENTAVOS = 50`. Reproduzimos o comportamento atual, sem
     * consertar: consertar aqui mudaria o produto no meio de uma migração
     * que não pode mudar nada. Tarefa separada.
     */
    return (
      <div className="mt-5 text-center">
        {seletor}
        <p className="text-sm text-ink">
          Seu cupom cobre o pedido inteiro — nada a pagar.
        </p>
        <div className="mt-4">
          <BotaoPagar
            rotulo="Finalizar pedido"
            processando={processando}
            onClick={() => pagar(null)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="mt-5">
      {/* No Pix o seletor fica ACIMA do painel: não há cartão 3D para servir de
          âncora, e o painel é a última coisa antes do botão. */}
      {seletor}

      <div className="relative mt-4 overflow-hidden rounded-2xl border border-white/10 bg-surface-1 p-5">
        {/* Atmosfera no turquesa do Pix: o painel não é mais um card cinza
            igual aos outros, e a cor faz o trabalho de dizer qual método
            está na tela sem precisar de mais um rótulo. */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-[#32BCAD]/10 blur-3xl"
        />

        <div className="relative flex items-center gap-3">
          <IconePix className="h-8 w-8 shrink-0 text-[#32BCAD]" />
          <div>
            <h3 className="text-base font-semibold text-ink">Pagar com Pix</h3>
            <p className="text-xs font-light text-muted">
              Sem cartão, sem parcelas, sem juros.
            </p>
          </div>
        </div>

        <ul className="relative mt-4 grid gap-2.5 text-sm font-light text-ink/90">
          <Passo icone={<QrCode aria-hidden className="h-4 w-4" />}>
            O QR code e o código copia e cola aparecem na próxima tela.
          </Passo>
          <Passo icone={<Zap aria-hidden className="h-4 w-4" />}>
            Assim que seu banco confirmar, o acesso libera sozinho.
          </Passo>
          <Passo icone={<Clock aria-hidden className="h-4 w-4" />}>
            O código vale por 1 hora.
          </Passo>
        </ul>
      </div>

      <div className="mt-5">
        <BotaoPagar
          processando={processando}
          icone={<IconePix className="h-5 w-5 text-white" />}
          onClick={() => pagar(FORM_DATA_PIX)}
        />
      </div>

      <p className="mt-4 flex items-center justify-center gap-1.5 text-[11px] font-light text-muted">
        <Lock aria-hidden className="h-3 w-3" />
        Você não informa nenhum dado bancário aqui.
      </p>
    </div>
  );
}

function Passo({ icone, children }: { icone: ReactNode; children: ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <span className="mt-0.5 text-[#32BCAD]">{icone}</span>
      <span>{children}</span>
    </li>
  );
}
