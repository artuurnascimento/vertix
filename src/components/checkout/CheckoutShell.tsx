import { Lock } from 'lucide-react'
import LogoMark from '../ui/LogoMark'

/** Escada da marca, impressa de lado no canto do desktop. Puro enfeite. */
const PALAVRAS_VERTICAIS = 'ANALISAR / CORRIGIR / EVOLUIR / VENDER MAIS'

interface Props {
  children: React.ReactNode
  /** Telas auxiliares (carregando, aviso, Pix) usam a coluna estreita. */
  estreito?: boolean
  /**
   * Cabeçalho mínimo da moldura. A página principal desliga porque tem o
   * cabeçalho grande dela — duas marcas empilhadas viram ruído.
   */
  cabecalho?: boolean
}

/**
 * Moldura das telas públicas de checkout: fundo da marca, brilhos roxos nos
 * cantos de cima e rodapé. Mesma linguagem visual da página de cobrança que já
 * roda em produção, para o comprador não sentir que trocou de empresa no meio.
 */
export default function CheckoutShell({
  children,
  estreito = false,
  cabecalho = true,
}: Props) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-bg px-4 py-8 font-kanit sm:px-6 sm:py-12">
      <div
        aria-hidden
        className="app-ambient pointer-events-none fixed inset-0"
      />
      {/* Atmosfera dos dois cantos de cima: difusa e de baixa opacidade — é
          profundidade, não protagonismo. */}
      <div
        aria-hidden
        className="pointer-events-none fixed -right-40 -top-56 h-[32rem] w-[32rem] rounded-full bg-accent/[0.13] blur-[130px]"
      />
      <div
        aria-hidden
        className="pointer-events-none fixed -left-48 -top-64 h-[28rem] w-[28rem] rounded-full bg-accent-2/[0.10] blur-[130px]"
      />

      <span
        aria-hidden
        className="pointer-events-none fixed right-3 top-1/2 hidden -translate-y-1/2 select-none text-[10px] font-light uppercase tracking-[0.45em] text-ink/[0.06] [writing-mode:vertical-rl] xl:block"
      >
        {PALAVRAS_VERTICAIS}
      </span>

      <div
        className={`relative mx-auto w-full ${
          estreito ? 'max-w-xl' : 'max-w-6xl'
        }`}
      >
        {cabecalho && (
          <header className="flex items-center justify-center gap-2.5">
            <LogoMark className="h-6 w-6" />
            <span className="text-xs font-semibold tracking-[0.35em] text-ink">
              VERTIX
            </span>
          </header>
        )}

        {children}

        <footer className="mt-12 border-t border-white/[0.06] pt-6 text-[11px] font-light text-muted/80">
          <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:justify-between sm:text-left">
            <span className="flex items-center gap-2">
              <LogoMark className="h-4 w-4" />
              <span className="text-[10px] font-semibold tracking-[0.3em] text-muted">
                VERTIX
              </span>
            </span>
            <span className="flex items-center gap-1.5">
              <Lock aria-hidden className="h-3 w-3 text-accent" />
              Ambiente seguro · dados criptografados
            </span>
            <span>
              Dúvidas?{' '}
              <a
                href="mailto:contato@vertix.studio"
                className="text-accent underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
              >
                contato@vertix.studio
              </a>
            </span>
          </div>
          {/* Aceite dos termos — exigência da LGPD e do Código de Defesa do
              Consumidor: quem compra precisa saber com quem está contratando,
              quem processa o pagamento e onde ler as regras. Fica só aqui, e
              não repetido junto do botão: uma declaração, um lugar. */}
          <p className="mt-5 text-center text-xs leading-relaxed text-muted">
            Ao prosseguir, você concorda com os{' '}
            <a
              href="/termos"
              target="_blank"
              rel="noopener noreferrer"
              className="text-ink underline decoration-white/25 underline-offset-2 transition-colors hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
            >
              Termos de uso
            </a>{' '}
            e a{' '}
            <a
              href="/privacidade"
              target="_blank"
              rel="noopener noreferrer"
              className="text-ink underline decoration-white/25 underline-offset-2 transition-colors hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
            >
              Política de Privacidade
            </a>{' '}
            da Vertix Studio.
          </p>
          <p className="mt-1.5 text-center text-[11px] text-muted/80">
            Pagamento processado pelo Mercado Pago · Vertix Studio · CNPJ
            54.203.421/0001-49
          </p>
        </footer>
      </div>
    </div>
  )
}
