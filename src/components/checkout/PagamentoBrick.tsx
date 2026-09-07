import { useEffect, useRef, useState } from 'react'
import { Loader2, Lock } from 'lucide-react'
import { MP_PUBLIC_KEY } from './checkoutApi'
import {
  carregarMpSdk,
  gerarTokenParaSalvar,
  mpGlobal,
  type BrickController,
} from './mpSdk'

interface Props {
  /** Total previsto — o Brick precisa dele em reais para montar as parcelas. */
  totalCentavos: number
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
 * Detalhe que só aparece no checkout: o valor MUDA (bump, cupom). O Brick não
 * aceita troca de `amount` depois de criado, então remontamos quando o total
 * muda. Por isso bump e cupom ficam ACIMA do pagamento na página — o normal é
 * a pessoa resolvê-los antes de encostar no cartão. Se mexer depois, o
 * formulário do cartão é recriado; é o preço de mostrar o valor certo, e
 * mostrar valor errado no botão de pagar é muito pior.
 */
const CONTAINER_ID = 'payment-brick'

export default function PagamentoBrick({
  totalCentavos,
  emailInicial,
  processando,
  onSubmit,
  onErroCarregamento,
}: Props) {
  const [pronto, setPronto] = useState(false)
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
            // Sem debitCard: no Brasil o MP só oferece ali o cartão virtual
            // CAIXA, que confunde mais do que ajuda. Pix entra por bankTransfer.
            paymentMethods: { creditCard: 'all', bankTransfer: 'all' },
            visual: {
              style: {
                theme: 'dark',
                customVariables: {
                  baseColor: '#6C5BF2',
                  formBackgroundColor: '#151515',
                },
              },
            },
          },
          callbacks: {
            onReady: () => {
              if (!cancelado) setPronto(true)
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
  }, [totalCentavos, gratuito])

  if (gratuito) {
    // Cupom cobriu o pedido inteiro: não há o que cobrar, e o Brick não aceita
    // valor zero. Quem decide se o pedido gratuito vale é o servidor.
    return (
      <div className="text-center">
        <p className="text-sm text-ink">
          Seu cupom cobre o pedido inteiro — nada a pagar.
        </p>
        <button
          type="button"
          disabled={processando}
          onClick={() => void onSubmitRef.current(null, null)}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-accent-2 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {processando && <Loader2 aria-hidden className="h-4 w-4 animate-spin" />}
          Finalizar pedido
        </button>
      </div>
    )
  }

  return (
    <>
      {!pronto && (
        <div className="flex flex-col gap-3 py-6" aria-hidden>
          <div className="h-10 animate-pulse rounded-lg bg-surface-2" />
          <div className="h-10 animate-pulse rounded-lg bg-surface-2" />
          <div className="h-24 animate-pulse rounded-lg bg-surface-2" />
        </div>
      )}
      <div
        id={CONTAINER_ID}
        className={processando ? 'vtx-processing' : undefined}
      />
      {pronto && (
        <p className="mt-4 flex items-center justify-center gap-1.5 text-[11px] font-light text-muted">
          <Lock aria-hidden className="h-3 w-3" />
          Pagamento processado pelo Mercado Pago. Não guardamos seu cartão.
        </p>
      )}
    </>
  )
}
