import { useEffect, useRef, useState } from 'react'
import { Loader2, Lock } from 'lucide-react'
import { MP_PUBLIC_KEY } from './checkoutApi'
import { formatarCentavos } from './checkoutTotal'
import type { MetodoPagamento } from './MetodoPagamento'
import {
  carregarMpSdk,
  gerarTokenParaSalvar,
  mpGlobal,
  type BrickController,
} from './mpSdk'

interface Props {
  /** Total previsto — o Brick precisa dele em reais para montar as parcelas. */
  totalCentavos: number
  /** Método escolhido na tela: o Brick monta só o formulário dele. */
  metodo: MetodoPagamento
  /** E-mail para pré-preencher o pagador; lido só na montagem. */
  emailInicial: string
  processando: boolean
  /**
   * Recebe o formData do Brick e, quando foi possível gerar, um segundo token
   * do cartão só para salvá-lo. Deve lançar erro para o Brick continuar
   * utilizável (é assim que o SDK entende "não deu certo, deixe a pessoa
   * tentar de novo").
   */
  onSubmit: (formData: unknown, cardTokenSalvar: string | null) => Promise<void>
  onErroCarregamento: (mensagem: string) => void
}

/**
 * Payment Brick do Mercado Pago — mesma mecânica da PagarPage, que já roda em
 * produção: SDK via <script>, container próprio, callbacks no onSubmit.
 *
 * Duas coisas remontam o Brick, e as duas são inevitáveis:
 *
 *   1. o VALOR muda (bump, cupom) e o Brick não aceita trocar `amount` depois
 *      de criado. Por isso bump e cupom ficam ACIMA do pagamento na página;
 *      mexer depois recria o formulário do cartão, e é o preço de mostrar o
 *      valor certo — mostrar valor errado no botão de pagar é muito pior;
 *   2. o MÉTODO muda. A lista interna do Mercado Pago fica desligada: quem
 *      escolhe é o seletor da página, e o Brick nasce já no formulário certo.
 *      Trocar de método zerava o formulário do cartão de qualquer jeito.
 *
 * O botão de pagar é o do próprio Brick — é ele que o SDK arma com o submit e
 * a validação do cartão. O rótulo recebe o total ao vivo (`formSubmit`), então
 * ele acompanha bump e cupom pelo mesmo caminho que já remonta o Brick.
 */
const CONTAINER_ID = 'payment-brick'

/**
 * Abre o formulário do único método montado.
 *
 * Com um método só, o Brick ainda desenha a lista de escolha com uma linha e a
 * deixa fechada — o que, com o seletor da página logo acima, viraria duas
 * listas e um clique inútil. Marcamos o rádio por ele.
 *
 * Devolve `false` a qualquer sinal de que o markup não é o esperado (nenhum
 * rádio, mais de um, o clique não pegou). Quem chama usa isso para NÃO
 * esconder a lista do Mercado Pago: melhor um clique sobrando que um
 * formulário que não abre.
 */
function abrirMetodoUnico(): boolean {
  const radios = document.querySelectorAll<HTMLInputElement>(
    `#${CONTAINER_ID} input[type="radio"]`
  )
  if (radios.length !== 1) return false

  const radio = radios[0]
  if (radio.checked) return true

  radio.click()
  return radio.checked
}

export default function PagamentoBrick({
  totalCentavos,
  metodo,
  emailInicial,
  processando,
  onSubmit,
  onErroCarregamento,
}: Props) {
  const [pronto, setPronto] = useState(false)
  /**
   * Conseguimos abrir sozinhos o único método do Brick? Só quando SIM a lista
   * interna dele é escondida — se um dia o markup do Mercado Pago mudar e o
   * clique não pegar, a lista continua na tela e a pessoa abre com um toque.
   * Degradar para "um clique a mais" é aceitável; para "formulário que não
   * abre", não.
   */
  const [metodoEmbutido, setMetodoEmbutido] = useState(false)
  const controllerRef = useRef<BrickController | null>(null)

  // Refs para os callbacks: o Brick guarda a closure da montagem, e sem isso
  // ele chamaria a versão antiga de onSubmit (com o cupom anterior, por ex).
  const onSubmitRef = useRef(onSubmit)
  const onErroRef = useRef(onErroCarregamento)
  const emailRef = useRef(emailInicial)
  useEffect(() => {
    onSubmitRef.current = onSubmit
    onErroRef.current = onErroCarregamento
    emailRef.current = emailInicial
  })

  const gratuito = totalCentavos <= 0

  useEffect(() => {
    if (gratuito) return
    let cancelado = false
    setPronto(false)
    setMetodoEmbutido(false)

    carregarMpSdk()
      .then(() => {
        const MercadoPago = mpGlobal()
        if (cancelado || !MercadoPago) return
        const mp = new MercadoPago(MP_PUBLIC_KEY, { locale: 'pt-BR' })
        return mp.bricks().create('payment', CONTAINER_ID, {
          initialization: {
            amount: totalCentavos / 100,
            payer: { email: emailRef.current },
          },
          customization: {
            // Um método por montagem — o seletor da página é quem manda. Sem
            // debitCard: no Brasil o MP só oferece ali o cartão virtual CAIXA,
            // que confunde mais do que ajuda. Pix entra por bankTransfer.
            paymentMethods:
              metodo === 'pix'
                ? { bankTransfer: 'all' }
                : { creditCard: 'all' },
            visual: {
              style: {
                theme: 'dark',
                customVariables: {
                  baseColor: '#6C5BF2',
                  formBackgroundColor: '#151515',
                },
              },
              texts: {
                // O valor no botão é o mesmo da prévia da página. Definitivo
                // continua sendo o do servidor, avisado no resumo.
                formSubmit: `Pagar ${formatarCentavos(totalCentavos)}`,
              },
            },
          },
          callbacks: {
            onReady: () => {
              if (cancelado) return
              setPronto(true)
              // Um quadro depois: o Brick acabou de anunciar que existe, mas
              // quem pinta a lista é o Svelte dele, no tick seguinte.
              setTimeout(() => {
                if (!cancelado) setMetodoEmbutido(abrirMetodoUnico())
              }, 0)
            },
            onError: (erro: { message?: string }) => {
              console.error('[checkout] Brick error:', erro)
              if (!cancelado) {
                onErroRef.current(
                  'Não foi possível carregar o formulário de pagamento. Recarregue a página.'
                )
              }
            },
            onSubmit: async ({ formData }: { formData: unknown }) => {
              // O segundo token sai ANTES da cobrança porque depende do
              // formulário ainda montado. Nunca bloqueia: devolve null se não
              // der, e a venda segue sem cartão salvo.
              const tokenSalvar = await gerarTokenParaSalvar(
                controllerRef.current,
                formData
              )
              await onSubmitRef.current(formData, tokenSalvar)
            },
          },
        })
      })
      .then((controller) => {
        if (!controller) return
        if (cancelado) controller.unmount()
        else controllerRef.current = controller
      })
      .catch(() => {
        if (!cancelado) {
          onErroRef.current(
            'Não foi possível carregar o formulário de pagamento. Recarregue a página.'
          )
        }
      })

    return () => {
      cancelado = true
      controllerRef.current?.unmount()
      controllerRef.current = null
    }
  }, [totalCentavos, metodo, gratuito])

  if (gratuito) {
    // Cupom cobriu o pedido inteiro: não há o que cobrar, e o Brick não aceita
    // valor zero. Quem decide se o pedido gratuito vale é o servidor.
    return (
      <div className="mt-5 text-center">
        <p className="text-sm text-ink">
          Seu cupom cobre o pedido inteiro — nada a pagar.
        </p>
        <button
          type="button"
          disabled={processando}
          onClick={() => void onSubmitRef.current(null, null)}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-accent px-4 py-4 text-sm font-bold uppercase tracking-[0.12em] text-white transition-colors hover:bg-accent-2 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {processando && (
            <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
          )}
          Finalizar pedido
        </button>
      </div>
    )
  }

  return (
    <div className="mt-5">
      {!pronto && (
        <div className="flex flex-col gap-3 py-6" aria-hidden>
          <div className="h-10 animate-pulse rounded-lg bg-surface-2" />
          <div className="h-10 animate-pulse rounded-lg bg-surface-2" />
          <div className="h-24 animate-pulse rounded-lg bg-surface-2" />
        </div>
      )}
      <div
        id={CONTAINER_ID}
        // O atributo liga o CSS que esconde o título e a lista de métodos do
        // Brick — só depois de termos aberto o formulário sozinhos.
        data-metodo-embutido={metodoEmbutido ? 'sim' : undefined}
        className={processando ? 'vtx-processing' : undefined}
      />
      {pronto && (
        <p className="mt-4 flex items-center justify-center gap-1.5 text-[11px] font-light text-muted">
          <Lock aria-hidden className="h-3 w-3" />
          Não guardamos os dados do seu cartão.
        </p>
      )}
    </div>
  )
}
