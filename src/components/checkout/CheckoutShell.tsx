import LogoMark from '../ui/LogoMark'
import RodapeCheckout from './RodapeCheckout'

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

        <RodapeCheckout comAceite />
      </div>
    </div>
  )
}
