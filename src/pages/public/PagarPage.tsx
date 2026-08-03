import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  CircleSlash,
  Copy,
  Hourglass,
  Loader2,
  Lock,
  ShieldCheck,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import LogoMark from '../../components/ui/LogoMark'

/**
 * Página de pagamento própria (alta conversão): resumo da cobrança à esquerda,
 * Payment Brick do Mercado Pago à direita. O MP só processa — a experiência
 * inteira acontece no nosso domínio. O valor cobrado é resolvido no servidor
 * pelo token; nada que o navegador envie altera o preço.
 */

// Public Key do MP: pública por definição (identifica a conta no SDK do
// navegador). O segredo de verdade (Access Token) vive só nas edge functions.
const MP_PUBLIC_KEY = 'APP_USR-53c10a53-70e6-4c45-90eb-cc3472aa51dd'
const MP_SDK_URL = 'https://sdk.mercadopago.com/js/v2'
const BRICK_CONTAINER_ID = 'payment-brick'
const PIX_POLL_MS = 4000

interface PaymentInfo {
  descricao: string
  valor: number
  vencimento: string
  status: 'pendente' | 'atrasado' | 'pago'
  projeto_nome: string
  cliente_nome: string
  cliente_email: string
}

interface PixData {
  qr_code: string | null
  qr_code_base64: string | null
  ticket_url: string | null
}

interface ProcessResponse {
  ok?: boolean
  status?: string
  status_detail?: string
  error?: string
  pix?: PixData
}

type PageState =
  | 'form'
  | 'pix_waiting'
  | 'in_process'
  | 'success'

/** Mapeia recusas comuns do MP para mensagens acionáveis em pt-BR. */
const REJECTION_MESSAGES: Record<string, string> = {
  cc_rejected_bad_filled_card_number: 'Confira o número do cartão.',
  cc_rejected_bad_filled_date: 'Confira a validade do cartão.',
  cc_rejected_bad_filled_security_code: 'Confira o código de segurança.',
  cc_rejected_bad_filled_other: 'Confira os dados digitados.',
  cc_rejected_insufficient_amount: 'Saldo ou limite insuficiente.',
  cc_rejected_call_for_authorize:
    'O banco pediu autorização — ligue para o emissor e tente de novo.',
  cc_rejected_duplicated_payment: 'Este pagamento já foi feito.',
  cc_rejected_high_risk:
    'Recusado pela análise de risco. Tente Pix ou outro cartão.',
}

const BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function firstName(nome: string): string {
  return nome.trim().split(/\s+/)[0] ?? nome
}

// Tipagem mínima do SDK carregado via <script>.
interface BrickController {
  unmount: () => void
}
interface MercadoPagoSdk {
  bricks: () => {
    create: (
      brick: string,
      containerId: string,
      settings: Record<string, unknown>
    ) => Promise<BrickController>
  }
}
declare global {
  interface Window {
    MercadoPago?: new (key: string, opts: { locale: string }) => MercadoPagoSdk
  }
}

let sdkPromise: Promise<void> | null = null
function loadMpSdk(): Promise<void> {
  if (window.MercadoPago) return Promise.resolve()
  if (!sdkPromise) {
    sdkPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = MP_SDK_URL
      script.onload = () => resolve()
      script.onerror = () => {
        sdkPromise = null
        reject(new Error('sdk_load_failed'))
      }
      document.head.appendChild(script)
    })
  }
  return sdkPromise
}

export default function PagarPage() {
  const { token } = useParams<{ token: string }>()
  const [pageState, setPageState] = useState<PageState>('form')
  const [pix, setPix] = useState<PixData | null>(null)
  const [payError, setPayError] = useState<string | null>(null)
  const [brickReady, setBrickReady] = useState(false)
  const [copied, setCopied] = useState(false)
  const brickRef = useRef<BrickController | null>(null)

  const {
    data: info,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['payment-info', token],
    enabled: Boolean(token),
    retry: false,
    // Enquanto espera o Pix, consulta o status — o webhook vira a parcela
    // para "pago" e a página confirma sozinha, sem o cliente recarregar.
    refetchInterval: pageState === 'pix_waiting' ? PIX_POLL_MS : false,
    queryFn: async (): Promise<PaymentInfo> => {
      if (!token) throw new Error('token_ausente')
      const { data, error } = await supabase.rpc('get_payment_info', {
        p_token: token,
      })
      if (error) throw new Error(error.message)
      return data as unknown as PaymentInfo
    },
  })

  const paid = info?.status === 'pago'

  useEffect(() => {
    if (paid && pageState === 'pix_waiting') setPageState('success')
  }, [paid, pageState])

  // Monta o Payment Brick quando os dados chegam.
  useEffect(() => {
    if (!info || paid || pageState !== 'form' || !token) return
    let cancelled = false

    loadMpSdk()
      .then(() => {
        if (cancelled || !window.MercadoPago) return
        const mp = new window.MercadoPago(MP_PUBLIC_KEY, { locale: 'pt-BR' })
        return mp.bricks().create('payment', BRICK_CONTAINER_ID, {
          initialization: {
            amount: info.valor,
            payer: { email: info.cliente_email },
          },
          customization: {
            // Sem debitCard de propósito: a única opção que o MP oferece aí é
            // o "Cartão de Débito Virtual CAIXA", que mais confunde que ajuda.
            paymentMethods: {
              creditCard: 'all',
              bankTransfer: 'all',
            },
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
              if (!cancelled) setBrickReady(true)
            },
            onError: (error: { message?: string }) => {
              console.error('[pagar] Brick error:', error)
              if (!cancelled) {
                setPayError(
                  'Não foi possível carregar o formulário. Recarregue a página.'
                )
              }
            },
            onSubmit: async ({ formData }: { formData: unknown }) => {
              setPayError(null)
              const { data, error } = await supabase.functions.invoke(
                'process-payment',
                { body: { token, formData } }
              )
              const res = (data ?? {}) as ProcessResponse

              if (error || res.error) {
                const message =
                  res.error === 'ja_pago'
                    ? 'Esta cobrança já foi paga.'
                    : 'Não foi possível processar. Tente novamente.'
                setPayError(message)
                throw new Error(res.error ?? 'process_failed')
              }

              if (res.pix) {
                setPix(res.pix)
                setPageState('pix_waiting')
                return
              }
              if (res.status === 'approved') {
                setPageState('success')
                return
              }
              if (res.status === 'in_process' || res.status === 'pending') {
                setPageState('in_process')
                return
              }
              // Recusado: mensagem específica e o Brick continua utilizável.
              setPayError(
                REJECTION_MESSAGES[res.status_detail ?? ''] ??
                  'Pagamento recusado. Tente outro cartão ou Pix.'
              )
              throw new Error(res.status_detail ?? 'rejected')
            },
          },
        })
      })
      .then((controller) => {
        if (!controller) return
        if (cancelled) {
          controller.unmount()
        } else {
          brickRef.current = controller
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPayError(
            'Não foi possível carregar o formulário. Recarregue a página.'
          )
        }
      })

    return () => {
      cancelled = true
      brickRef.current?.unmount()
      brickRef.current = null
      setBrickReady(false)
    }
  }, [info, paid, pageState, token])

  const handleCopyPix = async () => {
    if (!pix?.qr_code) return
    await navigator.clipboard.writeText(pix.qr_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // ---------------------------------------------------------------- shells --
  if (isLoading) {
    return (
      <Shell>
        <div className="mt-16 flex flex-col items-center gap-3 text-muted">
          <Loader2 className="h-6 w-6 animate-spin text-accent" />
          <p className="text-sm font-light">Carregando cobrança…</p>
        </div>
      </Shell>
    )
  }

  if (isError || !info) {
    return (
      <StatusCard
        icon={<CircleSlash className="h-10 w-10 text-muted" />}
        title="Link inválido"
        message="Esta cobrança não existe ou o link está incompleto. Confira o endereço ou peça um novo link."
      />
    )
  }

  if (pageState === 'success' || (paid && pageState === 'form')) {
    return (
      <StatusCard
        icon={<CheckCircle2 className="h-12 w-12 text-emerald-400" />}
        title="Pagamento confirmado!"
        message={`A parcela "${info.descricao}" do projeto ${info.projeto_nome} está quitada. Você já pode fechar esta página.`}
      />
    )
  }

  if (pageState === 'in_process') {
    return (
      <StatusCard
        icon={<Hourglass className="h-10 w-10 text-amber-300" />}
        title="Pagamento em análise"
        message="O banco está revisando a transação. Você recebe a confirmação em instantes — não é preciso pagar de novo."
      />
    )
  }

  // ------------------------------------------------------------------ page --
  return (
    <Shell wide>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
        className="mt-10 grid gap-6 md:grid-cols-[5fr_6fr] md:gap-8"
      >
        {/* ---------------------------------------------------- resumo ---- */}
        <section aria-label="Resumo da cobrança">
          <p className="text-xs font-medium uppercase tracking-[0.3em] text-accent">
            Cobrança · Vertix Studio
          </p>
          <h1 className="hero-heading mt-3 text-3xl font-bold leading-tight sm:text-4xl">
            {info.projeto_nome}
          </h1>
          <p className="mt-2 text-sm font-light text-muted">
            Olá, {firstName(info.cliente_nome)}! Finalize abaixo em segundos —
            Pix cai na hora.
          </p>

          <div className="mt-6 rounded-2xl border border-white/5 bg-surface-1 p-6">
            <p className="text-sm text-ink">{info.descricao}</p>
            <p className="mt-4 text-4xl font-bold tabular-nums text-ink">
              {BRL.format(info.valor)}
            </p>
            <p className="mt-2 flex items-center gap-1.5 text-xs font-light text-muted">
              <CalendarDays className="h-3.5 w-3.5" />
              Vencimento {formatDate(info.vencimento)}
              {info.status === 'atrasado' && (
                <span className="ml-1 rounded-full border border-amber-400/25 bg-amber-400/10 px-2 py-0.5 text-[11px] font-medium text-amber-300">
                  em atraso
                </span>
              )}
            </p>
          </div>

          <ul className="mt-6 flex flex-col gap-3 text-sm font-light text-muted">
            <li className="flex items-start gap-2.5">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
              Processado pelo Mercado Pago, líder em pagamentos na América
              Latina.
            </li>
            <li className="flex items-start gap-2.5">
              <Lock className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
              Dados do cartão criptografados — não passam pelos nossos
              servidores.
            </li>
            <li className="flex items-start gap-2.5">
              <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
              Confirmação automática: seu projeto segue sem burocracia.
            </li>
          </ul>

          <div className="mt-6">
            <p className="text-[11px] font-medium uppercase tracking-widest text-muted">
              Formas de pagamento aceitas
            </p>
            <ul className="mt-2.5 flex flex-wrap items-center gap-2">
              {['Pix', 'Visa', 'Mastercard', 'Elo', 'Amex', 'Hipercard'].map(
                (bandeira) => (
                  <li
                    key={bandeira}
                    className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-ink"
                  >
                    {bandeira}
                  </li>
                )
              )}
            </ul>
            <p className="mt-2 text-xs font-light text-muted">
              Crédito em até 12x.
            </p>
          </div>
        </section>

        {/* ------------------------------------------------- pagamento ---- */}
        <section
          aria-label="Formulário de pagamento"
          className="rounded-2xl border border-white/5 bg-surface-1 p-4 sm:p-6"
        >
          {pageState === 'pix_waiting' && pix ? (
            <div className="flex flex-col items-center text-center">
              <h2 className="text-lg font-semibold text-ink">
                Pague com Pix para confirmar
              </h2>
              <p className="mt-1 text-xs font-light text-muted">
                Escaneie o QR code ou copie o código. Confirmação automática.
              </p>
              {pix.qr_code_base64 && (
                <img
                  src={`data:image/png;base64,${pix.qr_code_base64}`}
                  alt="QR code Pix"
                  width={220}
                  height={220}
                  className="mt-5 rounded-xl bg-white p-3"
                />
              )}
              {pix.qr_code && (
                <button
                  type="button"
                  onClick={() => void handleCopyPix()}
                  className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-ink transition-colors duration-150 hover:border-accent/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                >
                  {copied ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      Código copiado!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      Copiar código Pix
                    </>
                  )}
                </button>
              )}
              <p className="mt-5 flex items-center gap-2 text-xs font-light text-muted">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" />
                Aguardando pagamento…
              </p>
            </div>
          ) : (
            <>
              {!brickReady && (
                <div className="flex flex-col gap-3 py-6">
                  <div className="h-10 animate-pulse rounded-lg bg-surface-2" />
                  <div className="h-10 animate-pulse rounded-lg bg-surface-2" />
                  <div className="h-24 animate-pulse rounded-lg bg-surface-2" />
                </div>
              )}
              <div id={BRICK_CONTAINER_ID} />
            </>
          )}

          {payError && (
            <p
              role="alert"
              className="mt-3 rounded-lg border border-red-400/25 bg-red-500/10 px-3 py-2 text-center text-sm text-red-300"
            >
              {payError}
            </p>
          )}
        </section>
      </motion.div>

      <p className="mt-10 text-center text-xs font-light text-muted">
        Dúvidas sobre esta cobrança? Fale com a gente —{' '}
        <a
          href="mailto:contato@vertix.studio"
          className="text-accent underline-offset-2 hover:underline"
        >
          contato@vertix.studio
        </a>
      </p>
    </Shell>
  )
}

// ------------------------------------------------------------- componentes --

function Shell({
  children,
  wide = false,
}: {
  children: React.ReactNode
  wide?: boolean
}) {
  return (
    <div className="min-h-screen bg-bg px-4 py-10 font-kanit sm:px-6 sm:py-14">
      <div aria-hidden className="app-ambient pointer-events-none fixed inset-0" />
      <div
        className={`relative mx-auto w-full ${wide ? 'max-w-4xl' : 'max-w-xl'}`}
      >
        <header className="flex items-center gap-2.5">
          <LogoMark className="h-7 w-7" />
          <span className="text-sm font-semibold tracking-[0.35em] text-ink">
            VERTIX
          </span>
        </header>
        {children}
      </div>
    </div>
  )
}

function StatusCard({
  icon,
  title,
  message,
}: {
  icon: React.ReactNode
  title: string
  message: string
}) {
  return (
    <Shell>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
        className="mt-14 flex flex-col items-center rounded-2xl border border-white/5 bg-surface-1 px-6 py-16 text-center sm:mt-20"
      >
        {icon}
        <h1 className="hero-heading mt-6 text-2xl font-bold sm:text-3xl">
          {title}
        </h1>
        <p className="mt-3 max-w-sm text-sm font-light leading-relaxed text-muted">
          {message}
        </p>
      </motion.div>
    </Shell>
  )
}
