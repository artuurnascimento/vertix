import { useLocation, useParams } from 'react-router-dom'
import { CheckCircle2, Loader2 } from 'lucide-react'
import {
  CheckoutShell,
  Entrada,
  RodapeVertix,
} from '../../components/upsell/CheckoutShell'
import { ResumoPedido } from '../../components/upsell/ResumoPedido'
import { ProximosPassos } from '../../components/upsell/ProximosPassos'
import {
  useCheckoutInfo,
  useStatusPedido,
} from '../../components/upsell/checkoutDados'
import {
  ehPlanoDeCorrecao,
  montarResumo,
  planoScanUrl,
} from '../../components/upsell/pedidoResumo'
import { lerEstadoObrigado } from '../../components/upsell/estadoObrigado'

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
  const { slug, pedidoId } = useParams<{ slug: string; pedidoId: string }>()
  const { state } = useLocation()

  const { data: info, isLoading: carregandoInfo } = useCheckoutInfo(slug)
  const { data: pedido, isLoading: carregandoPedido } =
    useStatusPedido(pedidoId)

  const { upsellAceito, totalCentavos } = lerEstadoObrigado(state)

  const resumo = montarResumo({
    info,
    pedido,
    upsellAceito,
    totalDaCobranca: totalCentavos,
  })

  const linkPlano = ehPlanoDeCorrecao(resumo.itens)
    ? planoScanUrl(pedido?.plano_code)
    : null

  if (carregandoInfo || carregandoPedido) {
    return (
      <CheckoutShell>
        <div
          role="status"
          className="mt-16 flex flex-col items-center gap-3 text-muted"
        >
          <Loader2 aria-hidden className="h-6 w-6 motion-safe:animate-spin text-accent" />
          <p className="text-sm font-light">Carregando seu pedido…</p>
        </div>
      </CheckoutShell>
    )
  }

  return (
    <CheckoutShell>
      <Entrada>
        <section
          aria-label="Compra confirmada"
          className="mt-8 flex flex-col items-center rounded-2xl border border-emerald-400/25 bg-emerald-400/[0.07] px-5 py-8 text-center sm:px-6"
        >
          <CheckCircle2 aria-hidden className="h-11 w-11 text-emerald-400" />
          <h1 className="hero-heading mt-4 text-2xl font-bold sm:text-3xl">
            Compra confirmada
          </h1>
          <p className="mt-2 max-w-sm text-sm font-light leading-relaxed text-muted">
            Obrigado! Está tudo certo com o seu pedido — não é preciso fazer
            mais nada nesta página.
          </p>
        </section>
      </Entrada>

      <Entrada delay={0.06}>
        <ResumoPedido resumo={resumo} />
      </Entrada>

      <Entrada delay={0.12}>
        <ProximosPassos email={resumo.email} linkPlano={linkPlano} />
      </Entrada>

      <RodapeVertix />
    </CheckoutShell>
  )
}
