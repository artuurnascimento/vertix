import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion, useReducedMotion } from 'framer-motion'
import { CircleSlash, Hourglass, Loader2 } from 'lucide-react'

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
  formatarCentavos,
  resolverTotal,
} from '../../components/checkout/checkoutTotal'
import {
  CLIENTE_VAZIO,
  clienteParaEnvio,
  validarCliente,
  type CampoCliente,
  type ErrosCliente,
} from '../../components/checkout/clienteForm'
import { usarFormularioNovo } from '../../components/checkout/flagFormularioNovo'
import {
  buscarPrefill,
  tokenValido,
} from '../../components/checkout/prefillCliente'
import { mensagemDeErro } from '../../components/checkout/errosPagamento'
import AvisoCheckout from '../../components/checkout/AvisoCheckout'
import BannerTopo from '../../components/checkout/BannerTopo'
import CabecalhoCheckout from '../../components/checkout/CabecalhoCheckout'
import CheckoutShell from '../../components/checkout/CheckoutShell'
import Cronometro from '../../components/checkout/Cronometro'
import CupomField from '../../components/checkout/CupomField'
import DadosCliente from '../../components/checkout/DadosCliente'
import Depoimentos from '../../components/checkout/Depoimentos'
import GarantiaCard from '../../components/checkout/GarantiaCard'
import OrderBump from '../../components/checkout/OrderBump'
import PixModal from '../../components/checkout/PixModal'
import ResumoPedido from '../../components/checkout/ResumoPedido'
import SecaoPagamento from '../../components/checkout/SecaoPagamento'
import SelosGrid from '../../components/checkout/SelosGrid'
import type { MetodoPagamento } from '../../components/checkout/MetodoPagamento'

/**
 * Checkout público `/c/:slug`.
 *
 * A mecânica de pagamento é a mesma da página de cobrança que já roda em
 * produção (SDK do Mercado Pago + Payment Brick + Pix com QR e copia-e-cola);
 * o que muda aqui é a oferta: bump, cupom, cronômetro e prova social.
 *
 * O desenho é de duas colunas: à esquerda o fluxo (bump → cupom → dados →
 * pagamento → confiança), à direita o resumo grudado no alto e, logo abaixo
 * dele, as avaliações — que no desktop ocupam o vazio que sobrava sob o
 * resumo. No celular vira uma coluna só, com o resumo ABRINDO a página — é lá
 * que quase todo mundo paga, e ninguém preenche cartão sem saber quanto vai
 * custar — e as avaliações voltam para o fim do fluxo, depois do pagamento e
 * da garantia, para não empurrarem o formulário para fora da primeira tela.
 *
 * Acima de tudo pode existir um BANNER configurado pelo lojista, com uma arte
 * para desktop e outra para celular. Sem banner, a página começa direto no
 * título: não há espaço reservado esperando imagem.
 *
 * Uma regra atravessa o arquivo inteiro: o total mostrado é PRÉVIA. Quem soma
 * produto, bump, cupom e desconto do método para valer é o servidor, com os
 * preços do banco. O navegador só antecipa o número para a pessoa não pagar às
 * cegas.
 *
 * O MÉTODO de pagamento entrou na conta: quando o checkout tem desconto no Pix
 * configurado, escolher Pix abate o percentual e o novo total aparece ao mesmo
 * tempo no resumo e dentro do botão de pagar — os dois leem o mesmo
 * `total.totalCentavos`, então não existe estado em que um mostre um número e
 * outro mostre outro.
 */

const SECAO_PAGAMENTO_ID = 'pagamento'

/**
 * `'pix'` saiu daqui de propósito: o Pix passou a abrir POR CIMA do checkout,
 * em `PixModal`, e não como tela própria. Deixar o valor no tipo convidaria
 * alguém a reintroduzir a troca de página, que era o que apagava o contexto de
 * quem tinha acabado de preencher o formulário.
 */
type EstadoPagina = 'form' | 'analise'

interface CupomAplicado {
  codigo: string
  /** Última resposta do servidor para este código, no bump atual. */
  resposta: RespostaCupom
  /** Bump vigente quando o servidor calculou. Diferente = número velho. */
  bumpNaValidacao: boolean
  /**
   * Método vigente quando o servidor calculou. O total do servidor já vem com
   * o desconto do método aplicado, então trocar de método envelhece a resposta
   * exatamente como marcar o bump envelhece.
   */
  metodoNaValidacao: MetodoPagamento
}

export default function CheckoutPage() {
  const { slug } = useParams<{ slug: string }>()
  const [parametrosDaUrl] = useSearchParams()
  // O funil do Scan manda a pessoa para /c/<slug>?a=<analysis_id>. É esse
  // valor que amarra o pedido ao Raio-X da loja: sem ele o worker não sabe
  // de qual loja é o Plano de Correção e a entrega não tem o que gerar.
  // Quem compra por link direto não tem análise, e isso é normal.
  const analysisId = parametrosDaUrl.get('a')?.trim() || null
  const origem = parametrosDaUrl.get('origem')?.trim() || (analysisId ? 'scan' : null)
  // `?t=` é o payment_token da cobrança aberta pela `scan-comprar`. Com ele o
  // formulário volta preenchido com o que a pessoa já digitou no portão da
  // análise. Link sem `t` (compra direta, link antigo) abre vazio, como antes.
  const tokenPrefill = parametrosDaUrl.get('t')?.trim() || null
  const navegar = useNavigate()
  const semMovimento = useReducedMotion()

  const [bumpMarcado, setBumpMarcado] = useState(false)
  const [cupom, setCupom] = useState<CupomAplicado | null>(null)
  const [cliente, setCliente] = useState<ClienteCheckout>(CLIENTE_VAZIO)
  const [erros, setErros] = useState<ErrosCliente>({})
  const [estado, setEstado] = useState<EstadoPagina>('form')
  const [metodo, setMetodo] = useState<MetodoPagamento>('cartao')
  const [pix, setPix] = useState<PixCheckout | null>(null)
  const [pixAberto, setPixAberto] = useState(false)
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

  /**
   * Dados do comprador, para o formulário não pedir de novo o que ele já deu.
   *
   * Não trava nada: `retry: false` e a busca devolve `null` em qualquer falha.
   * Enquanto ela não responde, os campos ficam vazios e editáveis — ninguém
   * espera por um preenchimento que é conveniência.
   */
  const { data: prefill } = useQuery({
    queryKey: ['checkout-prefill', tokenPrefill],
    enabled: tokenValido(tokenPrefill),
    retry: false,
    staleTime: Infinity,
    queryFn: () => buscarPrefill(tokenPrefill ?? ''),
  })

  /**
   * Aplica o preenchimento UMA vez, e só onde ainda não há nada digitado.
   *
   * As duas condições importam. Sem a primeira, o refetch do react-query (voltar
   * para a aba, reconectar) reescreveria o formulário por cima; sem a segunda,
   * uma resposta lenta chegaria depois de a pessoa já ter corrigido o telefone
   * e desfaria a correção sem aviso — o campo volta ao valor antigo e ela paga
   * sem perceber.
   */
  const prefillAplicado = useRef(false)
  useEffect(() => {
    if (!prefill || prefillAplicado.current) return
    prefillAplicado.current = true
    setCliente((atual) => ({
      ...atual,
      nome: atual.nome || prefill.nome,
      email: atual.email || prefill.email,
      whatsapp: atual.whatsapp || prefill.whatsapp,
    }))
  }, [prefill])

  // Desconto por método só existe no Pix; no cartão a taxa não deixa espaço.
  const descontoPixPercentual = info?.checkout.descontoPixPercentual ?? null
  const percentualDoMetodo = metodo === 'pix' ? descontoPixPercentual : null

  /**
   * O documento deixa de ser opcional quando se paga com cartão.
   *
   * Não é preferência de formulário: o `createCardToken` dos Secure Fields
   * exige `identificationType` + `identificationNumber` para emitir o token, e
   * sem token não existe cobrança. Quem deixasse em branco bateria no erro
   * `214` do Mercado Pago, em inglês, depois de já ter digitado o cartão
   * inteiro. Melhor pedir antes, com o rótulo dizendo que é obrigatório.
   *
   * Preso à flag de propósito. Este é o único ponto da migração que muda o
   * PRODUTO — um campo obrigatório a mais na tela — e enquanto o Brick estiver
   * servindo o tráfego ele continua coletando a identificação por conta
   * própria. Com a flag desligada este booleano é, byte a byte, o
   * `checkout.exigeDocumento` de hoje.
   */
  const exigeDocumento =
    (info?.checkout.exigeDocumento ?? false) ||
    (usarFormularioNovo() && metodo === 'cartao')

  const total = useMemo(() => {
    const previa = calcularTotal({
      produtoCentavos: info?.produto.precoCentavos ?? 0,
      bumpCentavos: info?.bump?.precoCentavos ?? null,
      bumpMarcado,
      // O `descontoCentavos` da resposta é a SOMA (cupom + método): usá-lo
      // aqui e ainda aplicar o percentual abaixo descontaria o Pix duas vezes.
      // Por isso a prévia local usa o abatimento SÓ do cupom, e só cai na soma
      // com servidor antigo — onde ela é o cupom e nada mais.
      descontoCentavos:
        cupom?.resposta.descontoCupomCentavos ??
        cupom?.resposta.descontoCentavos ??
        0,
      percentualMetodo: percentualDoMetodo,
    })

    // Os números do servidor só valem enquanto o bump E o método forem os
    // mesmos que ele considerou. Marcou o bump (ou trocou para Pix) depois de
    // aplicar um cupom percentual? O total volta a ser prévia local até a
    // revalidação (logo abaixo) responder.
    const servidorAtual =
      cupom !== null &&
      cupom.bumpNaValidacao === bumpMarcado &&
      cupom.metodoNaValidacao === metodo
        ? cupom.resposta
        : null
    return resolverTotal(previa, servidorAtual)
  }, [info, bumpMarcado, cupom, metodo, percentualDoMetodo])

  /**
   * Revalida o cupom quando o bump OU o método mudam. Sem isto, um cupom de
   * 10% aplicado antes de marcar o bump mostraria o desconto do valor antigo —
   * e a pessoa veria um número na tela e outro na fatura. Com o desconto do
   * Pix na conta, trocar de método tem o mesmo efeito sobre o total.
   *
   * Falha aqui não desfaz o cupom nem trava nada: fica valendo a prévia local,
   * e o servidor aplica o desconto certo na hora de cobrar de qualquer forma.
   */
  useEffect(() => {
    if (
      !slug ||
      cupom === null ||
      (cupom.bumpNaValidacao === bumpMarcado &&
        cupom.metodoNaValidacao === metodo)
    ) {
      return
    }

    let cancelado = false
    const codigo = cupom.codigo
    validarCupom(slug, codigo, bumpMarcado, metodo)
      .then((resposta) => {
        if (cancelado || !resposta.valido) return
        setCupom((atual) =>
          atual?.codigo === codigo
            ? {
                codigo,
                resposta,
                bumpNaValidacao: bumpMarcado,
                metodoNaValidacao: metodo,
              }
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
  }, [slug, bumpMarcado, metodo, cupom])

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

    const errosCliente = validarCliente(cliente, exigeDocumento)
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
        analysisId,
        tokenCompra: tokenPrefill,
        origem,
      })

      if (resposta.pedidoId) setPedidoId(resposta.pedidoId)
      // O total que vale é o do servidor; a prévia era só para a pessoa não
      // pagar às cegas.
      if (resposta.totalCentavos !== null) {
        setTotalCobrado(resposta.totalCentavos)
      }

      if (resposta.pix) {
        // Sem `setEstado`: o Pix abre POR CIMA do checkout. Trocar a página
        // inteira apagava o contexto — a pessoa sumia do formulário que acabou
        // de preencher e, se fechasse sem pagar, não tinha para onde voltar.
        setPix(resposta.pix)
        setPixAberto(true)
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


  // --------------------------------------------------------------- página --
  const { checkout, produto, bump, prova, garantia } = info

  /**
   * As avaliações aparecem em UM lugar por vez: na coluna da direita no
   * desktop (sob o resumo) e no fim do fluxo no celular. O mesmo elemento é
   * colocado nos dois pontos e o CSS esconde o que não vale para a largura
   * atual — `hidden` tira o outro também da árvore de acessibilidade, então
   * ninguém ouve o depoimento duas vezes. Sem depoimento cadastrado, nada
   * disso existe: nem moldura, nem espaço.
   */
  const avaliacoes =
    prova && prova.depoimentos.length > 0 ? (
      <Depoimentos depoimentos={prova.depoimentos} />
    ) : null

  return (
    <CheckoutShell cabecalho={false}>
      <motion.div
        initial={semMovimento ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
        // Respiro no pé só quando há um Pix esperando: é a única barra fixa
        // que sobrou, e ela cobriria o fim da página em qualquer largura.
        className={pix ? 'pb-28' : undefined}
      >
        {info.banner && (
          <div className="mb-7 sm:mb-9">
            <BannerTopo banner={info.banner} />
          </div>
        )}

        <CabecalhoCheckout
          titulo={checkout.titulo}
          subtitulo={checkout.subtitulo}
        />

        <div className="mx-auto mt-6 max-w-md">
          <Cronometro ate={info.cronometroAte} />
        </div>

        <div className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,62fr)_minmax(0,38fr)] lg:items-start lg:gap-6">
          {/* Resumo primeiro no DOM = primeiro na tela do celular, que é onde
              quase todo mundo paga. No desktop ele vai para a direita. */}
          {/* SEM `sticky` e SEM rolagem própria, de propósito. Esta coluna já
              foi `lg:sticky lg:top-8 lg:max-h-[calc(100vh-4rem)]
              lg:overflow-y-auto` e escondia conteúdo: com o resumo aberto mais
              as avaliações embaixo, ela passa da altura da tela (medido em
              1440×900: teto de 836px para um conteúdo maior), e o excedente ia
              parar numa barra de rolagem INTERNA que ninguém percebe — o fim
              da coluna simplesmente não era lido.
              Tirar só o `max-h`/`overflow` não resolveria: um elemento grudado
              mais alto que a viewport encosta no topo e nunca mostra o próprio
              fim. E grudar "só enquanto couber" exigiria medir altura em
              JavaScript a cada mudança do resumo, do cupom e do bump.
              Rolando junto com a página, o comportamento é o mesmo do celular,
              é previsível, e tudo aparece. */}
          <div className="flex flex-col gap-5 lg:order-2">
            <ResumoPedido
              produto={produto}
              bump={bump}
              bumpMarcado={bumpMarcado}
              cupomCodigo={cupom?.codigo ?? null}
              metodo={metodo}
              descontoPixPercentual={descontoPixPercentual}
              total={total}
              padraoAberto={checkout.resumoAberto}
            />
            {avaliacoes && <div className="hidden lg:block">{avaliacoes}</div>}
          </div>

          <div className="flex flex-col gap-5 lg:order-1">
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
              metodo={metodo}
              descontoCentavos={total.descontoCentavos}
              onAplicar={(codigo, resposta) =>
                setCupom({
                  codigo,
                  resposta,
                  bumpNaValidacao: bumpMarcado,
                  metodoNaValidacao: metodo,
                })
              }
              onRemover={() => setCupom(null)}
            />

            <div ref={formRef}>
              <DadosCliente
                cliente={cliente}
                erros={erros}
                exigeDocumento={exigeDocumento}
                preenchido={prefill !== null && prefill !== undefined}
                onChange={alterarCampo}
              />
            </div>

            <SecaoPagamento
              id={SECAO_PAGAMENTO_ID}
              totalCentavos={total.totalCentavos}
              metodo={metodo}
              onMetodo={setMetodo}
              descontoPixPercentual={descontoPixPercentual}
              emailInicial={cliente.email}
              documento={cliente.documento}
              processando={processando}
              erro={erroPagamento}
              onSubmit={enviarPagamento}
              onErroCarregamento={setErroPagamento}
            />

            <GarantiaCard garantia={garantia} />
            {avaliacoes && <div className="lg:hidden">{avaliacoes}</div>}
            <SelosGrid selos={prova?.selos ?? []} />
          </div>
        </div>
      </motion.div>

      {/*
        Aqui havia uma barra fixa no rodapé, no celular, com o total e um botão
        "Ir para pagamento". Ela saiu.

        O que ela resolvia — total fora da tela no celular — já está resolvido:
        o resumo ABRE a página no celular, e o próprio botão de pagar carrega o
        valor. O que ela criava era pior: ficava por cima do conteúdo até o fim
        da página (a garantia lia-se atrás dela) e continuava dizendo "Ir para
        pagamento" com o cartão preenchido e a cobrança em PROCESSANDO dois
        dedos abaixo — convite para voltar a um formulário que a pessoa acabou
        de enviar.
      */}
      {/* Fechou o painel sem pagar? O código continua valendo, e este é o
          caminho de volta. Sem ele, fechar significaria perder de vista um Pix
          que já existe no Mercado Pago — e a pessoa não teria como concluir
          nem como saber que ainda dá. */}
      {pix && !pixAberto && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-surface-1/95 px-4 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
            <p className="text-xs font-light leading-snug text-muted">
              Seu Pix de{' '}
              <span className="font-medium text-ink">
                {formatarCentavos(totalCobrado ?? total.totalCentavos)}
              </span>{' '}
              está esperando o pagamento.
            </p>
            <button
              type="button"
              onClick={() => setPixAberto(true)}
              className="shrink-0 rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-white transition-opacity duration-150 hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Ver código Pix
            </button>
          </div>
        </div>
      )}

      {pix && (
        <PixModal
          aberto={pixAberto}
          pix={pix}
          totalCentavos={totalCobrado ?? total.totalCentavos}
          linkPedido={pedidoId ? `/c/${slug}/obrigado/${pedidoId}` : null}
          onFechar={() => setPixAberto(false)}
        />
      )}
    </CheckoutShell>
  )
}
