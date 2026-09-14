import VertixCheckoutLogo from './VertixCheckoutLogo'
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
  /**
   * Faixa colada no topo da página, de ponta a ponta e fora do respiro da
   * coluna — o cronômetro. Fica presa ao rolar, para a urgência não sumir.
   */
  topo?: React.ReactNode
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
  topo,
}: Props) {
  return (
    <div className="min-h-screen bg-bg font-kanit">
      {/* Fora da caixa com overflow-hidden de propósito: dentro dela o
          `sticky` não prende. */}
      {topo && <div className="sticky top-0 z-40">{topo}</div>}
      <div className="relative overflow-hidden px-4 py-8 sm:px-6 sm:py-12">
        <div
          aria-hidden
          className="app-ambient pointer-events-none fixed inset-0"
        />
        {/* Atmosfera dos dois cantos de cima: difusa e de baixa opacidade — é
            profundidade, não protagonismo. Gradiente radial, e não `filter:
            blur(130px)` como antes: o blur de 130 px em duas camadas fixas
            era rasterizado de novo pelo Safari do iPhone a cada mudança de
            viewport (teclado abrindo, rolagem), e o formulário travava. */}
        <div
          aria-hidden
          className="pointer-events-none fixed -right-72 -top-80 h-[56rem] w-[56rem] bg-[radial-gradient(circle_closest-side,rgba(108,91,242,0.14),rgba(108,91,242,0.05)_45%,transparent_72%)]"
        />
        <div
          aria-hidden
          className="pointer-events-none fixed -left-80 -top-96 h-[52rem] w-[52rem] bg-[radial-gradient(circle_closest-side,rgba(85,70,224,0.11),rgba(85,70,224,0.04)_45%,transparent_72%)]"
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
          {/*
            Mesmo lockup do cabeçalho grande da página principal. Estas telas
            (carregando, aviso, Pix) mostravam só o símbolo com a palavra VERTIX —
            a marca trocava de forma no meio do próprio checkout.
          */}
          {cabecalho && (
            <header className="flex items-center justify-center">
              <VertixCheckoutLogo symbolSize="clamp(22px, 5.5vw, 28px)" />
            </header>
          )}

          {children}

          <RodapeCheckout comAceite />
        </div>
      </div>
    </div>
  )
}
