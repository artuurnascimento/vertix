import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion, useReducedMotion } from 'framer-motion'
import { CircleSlash, Hourglass, Loader2, ShieldCheck } from 'lucide-react'

import {
  buscarCheckout,
  pagarCheckout,
  validarCupom,
  type ClienteCheckout,
  type PixCheckout,
  type RespostaCupom,
} from '../../components/checkout/checkoutApi'
import {
  calcularTotal,
  resolverTotal,
} from '../../components/checkout/checkoutTotal'
import {
  CLIENTE_VAZIO,
  clienteParaEnvio,
  validarCliente,
  type CampoCliente,
  type ErrosCliente,
} from '../../components/checkout/clienteForm'
import { mensagemDeErro } from '../../components/checkout/errosPagamento'
import AvisoCheckout from '../../components/checkout/AvisoCheckout'
import BarraTotalMobile from '../../components/checkout/BarraTotalMobile'
import CheckoutShell from '../../components/checkout/CheckoutShell'
import Cronometro from '../../components/checkout/Cronometro'
import CupomField from '../../components/checkout/CupomField'
import DadosCliente from '../../components/checkout/DadosCliente'
import OrderBump from '../../components/checkout/OrderBump'
import PagamentoBrick from '../../components/checkout/PagamentoBrick'
import PixPanel from '../../components/checkout/PixPanel'
import ProvaGarantia from '../../components/checkout/ProvaGarantia'
import ResumoPedido from '../../components/checkout/ResumoPedido'

/**
 * Checkout público `/c/:slug`.
 *
 * A mecânica de pagamento é a mesma da página de cobrança que já roda em
 * produção (SDK do Mercado Pago + Payment Brick + Pix com QR e copia-e-cola);
 * o que muda aqui é a oferta: bump, cupom, cronômetro e prova social.
 *
 * Uma regra atravessa o arquivo inteiro: o total mostrado é PRÉVIA. Quem soma
 * produto, bump e cupom para valer é o servidor, com os preços do banco. O
 * navegador só antecipa o número para a pessoa não pagar às cegas.
 */

const SECAO_PAGAMENTO_ID = 'pagamento'

type EstadoPagina = 'form' | 'pix' | 'analise'

interface CupomAplicado {
  codigo: string
  /** Última resposta do servidor para este código, no bump atual. */
  resposta: RespostaCupom
  /** Bump vigente quando o servidor calculou. Diferente = número velho. */
  bumpNaValidacao: boolean
}

export default function CheckoutPage() {
  const { slug } = useParams<{ slug: string }>()
  const navegar = useNavigate()
  const semMovimento = useReducedMotion()

  const [bumpMarcado, setBumpMarcado] = useState(false)
  const [cupom, setCupom] = useState<CupomAplicado | null>(null)
  const [cliente, setCliente] = useState<ClienteCheckout>(CLIENTE_VAZIO)
  const [erros, setErros] = useState<ErrosCliente>({})
  const [estado, setEstado] = useState<EstadoPagina>('form')
  const [pix, setPix] = useState<PixCheckout | null>(null)
  const [pedidoId, setPedidoId] = useState<string | null>(null)
  const [erroPagamento, setErroPagamento] = useState<string | null>(null)
  const [processando, setProcessando] = useState(false)
  /** Total que o servidor efetivamente cobrou (usado no painel do Pix). */
  const [totalCobrado, setTotalCobrado] = useState<number | null>(null)
  const formRef = useRef<HTMLDivElement>(null)

  const {
    data: info,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['checkout-info', slug],
    enabled: Boolean(slug),
    retry: false,
    staleTime: 60_000,
    queryFn: () => buscarCheckout(slug ?? ''),
  })

  const total = useMemo(() => {
    const previa = calcularTotal({
      produtoCentavos: info?.produto.precoCentavos ?? 0,
      bumpCentavos: info?.bump?.precoCentavos ?? null,
      bumpMarcado,
      descontoCentavos: cupom?.resposta.descontoCentavos ?? 0,
    })

    // Os números do servidor só valem enquanto o bump for o mesmo que ele
    // considerou. Marcou o bump depois de aplicar um cupom percentual? O total
    // volta a ser prévia local até a revalidação (logo abaixo) responder.
    const servidorAtual =
      cupom !== null && cupom.bumpNaValidacao === bumpMarcado
        ? cupom.resposta
        : null
    return resolverTotal(previa, servidorAtual)
  }, [info, bumpMarcado, cupom])

  /**
   * Revalida o cupom quando o bump muda. Sem isto, um cupom de 10% aplicado
   * antes de marcar o bump mostraria o desconto do valor antigo — e a pessoa
   * veria um número na tela e outro na fatura.
   *
   * Falha aqui não desfaz o cupom nem trava nada: fica valendo a prévia local,
   * e o servidor aplica o desconto certo na hora de cobrar de qualquer forma.
   */
  useEffect(() => {
    if (!slug || cupom === null || cupom.bumpNaValidacao === bumpMarcado) return

    let cancelado = false
    const codigo = cupom.codigo
    validarCupom(slug, codigo, bumpMarcado)
      .then((resposta) => {
        if (cancelado || !resposta.valido) return
        setCupom((atual) =>
          atual?.codigo === codigo
            ? { codigo, resposta, bumpNaValidacao: bumpMarcado }
            : atual
        )
      })
      .catch(() => {
        // Silêncio proposital: o cupom continua aplicado e o total exibido
        // volta a ser a prévia local até a próxima tentativa.
      })

    return () => {
      cancelado = true
    }
  }, [slug, bumpMarcado, cupom])

  const alterarCampo = (campo: CampoCliente, valor: string) => {
    setCliente((atual) => ({ ...atual, [campo]: valor }))
    // Erro some assim que a pessoa mexe no campo — corrigir e continuar vendo
    // "inválido" em vermelho é o tipo de atrito que faz abandonar carrinho.
    setErros((atuais) =>
      atuais[campo] === undefined ? atuais : { ...atuais, [campo]: undefined }
    )
  }

  const destinoPos = (id: string): string =>
    info?.checkout.temUpsell
      ? `/c/${slug}/upsell/${id}`
      : `/c/${slug}/obrigado/${id}`

  /**
   * Chamado pelo Brick. Lança erro de propósito quando algo dá errado: é o
   * contrato do SDK para manter o formulário utilizável e destravar o botão.
   */
  const enviarPagamento = async (
    formData: unknown,
    cardTokenSalvar: string | null
  ) => {
    if (!info || !slug) return

    const errosCliente = validarCliente(cliente, info.checkout.exigeDocumento)
    if (Object.keys(errosCliente).length > 0) {
      setErros(errosCliente)
      setErroPagamento('Confira seus dados acima antes de pagar.')
      formRef.current?.scrollIntoView({ block: 'center' })
      const primeiro = Object.keys(errosCliente)[0]
      document.getElementById(`cliente-${primeiro}`)?.focus({
        preventScroll: true,
      })
      throw new Error('dados_invalidos')
    }

    setErroPagamento(null)
    setProcessando(true)
    // Flag local, e não o estado: `erroPagamento` no closure ainda é o valor do
    // render anterior, então checá-lo no catch apagaria a mensagem específica
    // que acabamos de mostrar.
    let mensagemExibida = false
    try {
      const resposta = await pagarCheckout({
        slug,
        cliente: clienteParaEnvio(cliente),
        formData,
        bump: bumpMarcado,
        cupom: cupom?.codigo ?? null,
        cardTokenSalvar,
      })

      if (resposta.pedidoId) setPedidoId(resposta.pedidoId)
      // O total que vale é o do servidor; a prévia era só para a pessoa não
      // pagar às cegas.
      if (resposta.totalCentavos !== null) {
        setTotalCobrado(resposta.totalCentavos)
      }

      if (resposta.pix) {
        setPix(resposta.pix)
        setEstado('pix')
        return
      }
      if (resposta.status === 'aprovado' && resposta.pedidoId) {
        navegar(destinoPos(resposta.pedidoId), { replace: true })
        return
      }
      if (resposta.status === 'pendente') {
        setEstado('analise')
        return
      }

      setErroPagamento(mensagemDeErro(resposta.erro, resposta.mensagem))
      mensagemExibida = true
      throw new Error(resposta.erro ?? 'pagamento_recusado')
    } catch (erro) {
      if (erro instanceof Error && erro.message === 'dados_invalidos') throw erro
      if (!mensagemExibida) {
        setErroPagamento(
          'Não conseguimos falar com o servidor de pagamento. Tente de novo em instantes.'
        )
      }
      throw erro
    } finally {
      setProcessando(false)
    }
  }

  // ------------------------------------------------------------- estados --
  if (isLoading) {
    return (
      <CheckoutShell estreito>
        <div className="mt-20 flex flex-col items-center gap-3 text-muted">
          <Loader2 aria-hidden className="h-6 w-6 animate-spin text-accent" />
          <p className="text-sm font-light">Carregando checkout…</p>
        </div>
      </CheckoutShell>
    )
  }

  if (isError || !info) {
    return (
      <CheckoutShell estreito>
        <AvisoCheckout
          icone={<CircleSlash aria-hidden className="h-10 w-10 text-muted" />}
          titulo="Checkout indisponível"
          texto="Este link não existe mais ou está incompleto. Confira o endereço ou peça um novo link a quem te enviou."
        />
      </CheckoutShell>
    )
  }

  if (estado === 'analise') {
    return (
      <CheckoutShell estreito>
        <AvisoCheckout
          icone={<Hourglass aria-hidden className="h-10 w-10 text-amber-300" />}
          titulo="Pagamento em análise"
          texto="O banco está revisando a transação. A confirmação chega em instantes por e-mail — não é preciso pagar de novo."
        />
      </CheckoutShell>
    )
  }

  if (estado === 'pix' && pix) {
    return (
      <CheckoutShell estreito>
        <div className="mt-8 rounded-2xl border border-white/5 bg-surface-1 p-5 sm:p-7">
          <PixPanel
            pix={pix}
            totalCentavos={totalCobrado ?? total.totalCentavos}
            linkPedido={pedidoId ? `/c/${slug}/obrigado/${pedidoId}` : null}
          />
        </div>
      </CheckoutShell>
    )
  }

  // --------------------------------------------------------------- página --
  const { checkout, produto, bump, prova, garantia } = info

  return (
    <CheckoutShell>
      <motion.div
        initial={semMovimento ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
        // pb no celular: a barra fixa do total não pode cobrir o rodapé.
        className="pb-28 md:pb-0"
      >
        <div className="mx-auto mt-8 max-w-xl md:max-w-none">
          {checkout.titulo && (
            <h1 className="hero-heading text-center text-2xl font-bold leading-tight sm:text-3xl">
              {checkout.titulo}
            </h1>
          )}
          {checkout.subtitulo && (
            <p className="mt-2 text-center text-sm font-light text-muted">
              {checkout.subtitulo}
            </p>
          )}
          <div className="mx-auto mt-5 max-w-md">
            <Cronometro ate={info.cronometroAte} />
          </div>
        </div>

        <div className="mt-6 grid gap-5 md:grid-cols-[minmax(0,1fr)_360px] md:items-start">
          {/* Resumo primeiro no DOM = primeiro na tela do celular, que é onde
              quase todo mundo paga. No desktop ele vai para a direita e gruda. */}
          <div className="md:order-2 md:sticky md:top-8">
            <ResumoPedido
              produto={produto}
              bump={bump}
              bumpMarcado={bumpMarcado}
              cupomCodigo={cupom?.codigo ?? null}
              total={total}
            />
          </div>

          <div className="flex flex-col gap-5 md:order-1">
            {bump && (
              <OrderBump
                bump={bump}
                marcado={bumpMarcado}
                onChange={setBumpMarcado}
              />
            )}

            <CupomField
              slug={checkout.slug}
              aplicado={cupom?.codigo ?? null}
              bumpMarcado={bumpMarcado}
              descontoCentavos={total.descontoCentavos}
              onAplicar={(codigo, resposta) =>
                setCupom({ codigo, resposta, bumpNaValidacao: bumpMarcado })
              }
              onRemover={() => setCupom(null)}
            />

            <div ref={formRef}>
              <DadosCliente
                cliente={cliente}
                erros={erros}
                exigeDocumento={checkout.exigeDocumento}
                onChange={alterarCampo}
              />
            </div>

            <section
              id={SECAO_PAGAMENTO_ID}
              tabIndex={-1}
              aria-label="Pagamento"
              className="scroll-mt-6 rounded-2xl border border-white/5 bg-surface-1 p-4 focus:outline-none sm:p-6"
            >
              <h2 className="text-[11px] font-medium uppercase tracking-[0.25em] text-muted">
                Pagamento
              </h2>
              <div className="mt-4">
                <PagamentoBrick
                  totalCentavos={total.totalCentavos}
                  emailInicial={cliente.email}
                  processando={processando}
                  onSubmit={enviarPagamento}
                  onErroCarregamento={setErroPagamento}
                />
              </div>
              {erroPagamento && (
                <p
                  role="alert"
                  className="mt-4 rounded-lg border border-red-400/25 bg-red-500/10 px-3 py-2 text-center text-sm text-red-300"
                >
                  {erroPagamento}
                </p>
              )}
            </section>

            <ProvaGarantia prova={prova} garantia={garantia} />

            <p className="flex items-center justify-center gap-1.5 text-center text-[11px] font-light text-muted/80">
              <ShieldCheck aria-hidden className="h-3.5 w-3.5 text-accent" />
              Ambiente seguro · dados criptografados
            </p>
          </div>
        </div>
      </motion.div>

      <BarraTotalMobile
        totalCentavos={total.totalCentavos}
        alvoId={SECAO_PAGAMENTO_ID}
      />
    </CheckoutShell>
  )
}
