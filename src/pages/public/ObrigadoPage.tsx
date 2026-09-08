import { useLocation, useParams } from "react-router-dom";
import { CheckCircle2, Clock, Loader2, XCircle } from "lucide-react";
import {
  CheckoutShell,
  Entrada,
  RodapeVertix,
} from "../../components/upsell/CheckoutShell";
import { ResumoPedido } from "../../components/upsell/ResumoPedido";
import { ProximosPassos } from "../../components/upsell/ProximosPassos";
import {
  useCheckoutInfo,
  useStatusPedido,
} from "../../components/upsell/checkoutDados";
import {
  ehPlanoDeCorrecao,
  montarResumo,
  planoScanUrl,
  situacaoDoPedido,
} from "../../components/upsell/pedidoResumo";
import { lerEstadoObrigado } from "../../components/upsell/estadoObrigado";

/**
 * O que a tela afirma em cada situação.
 *
 * Só `pago` fala em compra confirmada. `desconhecido` — quando o servidor não
 * respondeu — recebe um texto que registra o pedido sem prometer pagamento:
 * na dúvida, a tela não pode dizer à pessoa que ela terminou.
 */
const CABECALHO = {
  pago: {
    Icone: CheckCircle2,
    cor: "text-emerald-400",
    caixa: "border-emerald-400/25 bg-emerald-400/[0.07]",
    titulo: "Compra confirmada",
    texto:
      "Obrigado! Está tudo certo com o seu pedido — não é preciso fazer mais nada nesta página.",
  },
  aguardando: {
    Icone: Clock,
    cor: "text-amber-400",
    caixa: "border-amber-400/25 bg-amber-400/[0.07]",
    titulo: "Aguardando pagamento",
    texto:
      "Ainda não recebemos a confirmação do seu pagamento. Se você pagou agora, pode levar alguns instantes — esta página se atualiza sozinha. Se ainda não pagou, é só voltar e concluir.",
  },
  recusado: {
    Icone: XCircle,
    cor: "text-red-400",
    caixa: "border-red-400/25 bg-red-400/[0.07]",
    titulo: "Pagamento não aprovado",
    texto:
      "O pagamento não foi aprovado e nada foi cobrado. Você pode tentar de novo com outro cartão ou pagar no Pix.",
  },
  reembolsado: {
    Icone: XCircle,
    cor: "text-muted",
    caixa: "border-white/10 bg-surface-1",
    titulo: "Pedido reembolsado",
    texto:
      "O valor deste pedido foi devolvido. Se você acha que houve um engano, fale com a gente.",
  },
  desconhecido: {
    Icone: Clock,
    cor: "text-muted",
    caixa: "border-white/10 bg-surface-1",
    titulo: "Pedido recebido",
    texto:
      "Não conseguimos confirmar a situação do pagamento agora. Atualize a página em instantes — e, se tiver qualquer dúvida, fale com a gente.",
  },
} as const;

/**
 * Confirmação final: /c/:slug/obrigado/:pedidoId
 *
 * Página de fechamento — nenhuma oferta aqui, por decisão. Ela responde a três
 * perguntas: o que eu comprei, quanto paguei, e o que acontece agora.
 *
 * Os dados vêm de duas fontes que se completam: o status do pedido (edge
 * function `checkout-info`) e o que esta sessão sabe — a configuração do
 * checkout e o upsell que a tela anterior acabou de cobrar. Se o status não
 * responder, a tela ainda mostra o essencial em vez de virar erro.
 */
export default function ObrigadoPage() {
  const { slug, pedidoId } = useParams<{ slug: string; pedidoId: string }>();
  const { state } = useLocation();

  const { data: info, isLoading: carregandoInfo } = useCheckoutInfo(slug);
  const { data: pedido, isLoading: carregandoPedido } =
    useStatusPedido(pedidoId, true);

  const { upsellAceito, totalCentavos } = lerEstadoObrigado(state);

  const resumo = montarResumo({
    info,
    pedido,
    upsellAceito,
    totalDaCobranca: totalCentavos,
  });

  const linkPlano = ehPlanoDeCorrecao(resumo.itens)
    ? planoScanUrl(pedido?.plano_code)
    : null;

  const situacao = situacaoDoPedido(pedido?.status);
  const cabecalho = CABECALHO[situacao];
  const pago = situacao === "pago";

  if (carregandoInfo || carregandoPedido) {
    return (
      <CheckoutShell>
        <div
          role="status"
          className="mt-16 flex flex-col items-center gap-3 text-muted"
        >
          <Loader2
            aria-hidden
            className="h-6 w-6 motion-safe:animate-spin text-accent"
          />
          <p className="text-sm font-light">Carregando seu pedido…</p>
        </div>
      </CheckoutShell>
    );
  }

  return (
    <CheckoutShell>
      <Entrada>
        <section
          aria-label={cabecalho.titulo}
          className={`mt-8 flex flex-col items-center rounded-2xl border px-5 py-8 text-center sm:px-6 ${cabecalho.caixa}`}
        >
          <cabecalho.Icone
            aria-hidden
            className={`h-11 w-11 ${cabecalho.cor}`}
          />
          <h1 className="hero-heading mt-4 text-2xl font-bold sm:text-3xl">
            {cabecalho.titulo}
          </h1>
          <p className="mt-2 max-w-sm text-sm font-light leading-relaxed text-muted">
            {cabecalho.texto}
          </p>
        </section>
      </Entrada>

      <Entrada delay={0.06}>
        <ResumoPedido resumo={resumo} />
      </Entrada>

      {/* "Em até 5 minutos chega o e-mail com o acesso" só é verdade depois do
          pagamento. Mostrar isso num Pix pendente é prometer entrega de algo
          que ainda não foi cobrado. */}
      {pago && (
        <Entrada delay={0.12}>
          <ProximosPassos email={resumo.email} linkPlano={linkPlano} />
        </Entrada>
      )}

      <RodapeVertix />
    </CheckoutShell>
  );
}
