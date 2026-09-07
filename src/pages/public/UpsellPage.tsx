import { useRef, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import {
  CheckoutShell,
  Entrada,
  RodapeVertix,
} from '../../components/upsell/CheckoutShell'
import { ConfirmacaoPagamento } from '../../components/upsell/ConfirmacaoPagamento'
import { OfertaCard } from '../../components/upsell/OfertaCard'
import {
  cobrarUpsell,
  useCheckoutInfo,
  useStatusPedido,
} from '../../components/upsell/checkoutDados'
import { useCampoCvv } from '../../components/upsell/useCampoCvv'
import { temCartaoSalvo } from '../../components/upsell/pedidoResumo'
import {
  ehBugDeContrato,
  mensagemErroUpsell,
  precisaCvv,
  proximaEtapaAoRecusar,
  resolverOferta,
} from '../../components/upsell/upsellFluxo'
import type { EtapaOferta } from '../../components/upsell/upsellFluxo'
import type { EstadoObrigado } from '../../components/upsell/estadoObrigado'

/**
 * Tela pós-compra: /c/:slug/upsell/:pedidoId
 *
 * A pessoa ACABOU de pagar. A ordem da página segue essa realidade: primeiro a
 * confirmação do que ela já comprou (com saída visível para o pedido), só
 * depois a oferta. Quem só queria conferir o pedido sai daqui sem ler nada.
 *
 * Como a cobrança acontece: no cartão salvo do primeiro pagamento. A pessoa
 * reconfirma apenas o código de segurança, num campo que é um iframe do
 * Mercado Pago; o SDK troca esse código por um token de uso único e é o TOKEN
 * que vai para a nossa edge function. O CVV nunca passa pelo nosso código nem
 * pelo nosso servidor — o backend, aliás, recusa qualquer corpo que o contenha.
 *
 * Sem cartão salvo (pagou por Pix, ou o cartão não foi guardado) não existe
 * cobrança de um toque: a oferta é OMITIDA e a pessoa segue direto para a
 * confirmação. A alternativa seria empurrá-la para um formulário de cartão
 * completo segundos depois de ter comprado, o que é justamente o tipo de
 * emboscada que esta tela não pode ser.
 *
 * Fluxo de recusa: upsell → (downsell, se houver, uma vez só) → /obrigado.
 */
export default function UpsellPage() {
  const { slug, pedidoId } = useParams<{ slug: string; pedidoId: string }>()
  const navigate = useNavigate()

  const { data: info, isLoading: carregandoInfo, isError } = useCheckoutInfo(slug)
  const { data: status, isLoading: carregandoStatus } = useStatusPedido(pedidoId)

  const [etapa, setEtapa] = useState<EtapaOferta>('upsell')
  const [processando, setProcessando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  /**
   * Trava síncrona contra clique duplo. `processando` desabilita o botão, mas
   * o estado do React só chega no próximo render: dois cliques rápidos (ou um
   * duplo toque no celular) passariam os dois pela mesma janela e gerariam
   * duas cobranças. O ref fecha essa janela no mesmo tick.
   */
  const emVooRef = useRef(false)

  const carregando = carregandoInfo || carregandoStatus
  const linkPedido = `/c/${slug}/obrigado/${pedidoId}`
  const comCartao = temCartaoSalvo(status)
  const oferta = comCartao ? resolverOferta(info, etapa) : null

  // O campo seguro só é montado quando existe oferta na tela para recebê-lo.
  const { pronto, erroSdk, gerarToken } = useCampoCvv(
    Boolean(oferta),
    oferta?.etapa ?? 'nenhuma'
  )

  function irParaObrigado(estado?: EstadoObrigado) {
    void navigate(linkPedido, { replace: true, state: estado })
  }

  async function aceitar() {
    if (emVooRef.current || !oferta || !pedidoId || !comCartao) return

    emVooRef.current = true
    setProcessando(true)
    setErro(null)

    try {
      // 1. O SDK do MP lê o CVV do próprio iframe e devolve um token de uso
      //    único. Falhou aqui, nada foi cobrado — nem chegamos ao servidor.
      const token = await gerarToken(status.card_id)
      if (!token.ok) {
        setErro(
          token.erro === 'cvv_invalido'
            ? 'Confira o código de segurança do cartão e tente de novo.'
            : mensagemErroUpsell({ erro: token.erro })
        )
        return
      }

      // 2. A cobrança em si. O corpo leva ids e o token; nunca o código.
      const resposta = await cobrarUpsell({
        pedidoId,
        produtoId: oferta.produtoId,
        cardToken: token.token,
      })

      if (resposta.ok) {
        irParaObrigado({
          upsellAceito: {
            produtoId: oferta.produtoId,
            nome: oferta.nomeProduto ?? oferta.titulo,
            precoCentavos: oferta.precoCentavos,
          },
          totalCentavos: resposta.total_centavos ?? null,
        })
        return
      }

      // `cvv_nao_aceito` é bug NOSSO (corpo com CVV), não pedido à pessoa: ela
      // vê a mensagem genérica e o console guarda o rastro de quem depura.
      if (ehBugDeContrato(resposta)) {
        console.error(
          '[upsell] backend recusou o corpo com cvv_nao_aceito — o envio deve levar card_token, nunca cvv'
        )
      } else if (precisaCvv(resposta)) {
        setErro('Confira o código de segurança do cartão e tente de novo.')
        return
      }

      setErro(mensagemErroUpsell(resposta))
    } catch {
      setErro(mensagemErroUpsell({ erro: 'falha_rede' }))
    } finally {
      emVooRef.current = false
      setProcessando(false)
    }
  }

  function recusar() {
    if (emVooRef.current) return
    const proxima = proximaEtapaAoRecusar(etapa, info)
    if (proxima === 'fim') {
      irParaObrigado()
      return
    }
    // Downsell aparece uma vez só; a tela reinicia limpa.
    setEtapa(proxima)
    setErro(null)
  }

  if (carregando) {
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
          <p className="text-sm font-light">Confirmando seu pedido…</p>
        </div>
      </CheckoutShell>
    )
  }

  // Sem oferta configurada, sem conseguir ler a configuração, ou sem cartão
  // salvo para cobrar: a pessoa não fica presa numa tela que não leva a nada —
  // vai direto para a confirmação do pedido.
  if (isError || !oferta) {
    return <Navigate to={linkPedido} replace />
  }

  return (
    <CheckoutShell>
      <Entrada>
        <ConfirmacaoPagamento
          linkPedido={linkPedido}
          nomeProduto={info?.produto?.nome ?? null}
        />
      </Entrada>

      <Entrada delay={0.08}>
        <OfertaCard
          // Remonta o card ao trocar de etapa: zera foco, animação e o campo
          // seguro, deixando claro que a oferta é outra.
          key={oferta.etapa}
          oferta={oferta}
          processando={processando}
          erro={erro}
          campoPronto={pronto}
          erroSdk={erroSdk}
          ultimosDigitos={status?.ultimos_digitos ?? null}
          onAceitar={() => void aceitar()}
          onRecusar={recusar}
        />
      </Entrada>

      <RodapeVertix />
    </CheckoutShell>
  )
}
