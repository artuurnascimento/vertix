import VertixCheckoutLogo from './VertixCheckoutLogo'
import { destacarFinalDoTitulo } from './conteudoCheckout'

interface Props {
  titulo: string | null
  subtitulo: string | null
}

/**
 * Topo da página: marca, título e subtítulo, centralizados sobre as duas
 * colunas.
 *
 * A última expressão do título sai em roxo. É só recorte tipográfico — as
 * palavras são exatamente as configuradas, na mesma ordem (ver
 * `destacarFinalDoTitulo`). Sem título configurado, sobra a marca.
 */
export default function CabecalhoCheckout({ titulo, subtitulo }: Props) {
  const { inicio, destaque } = destacarFinalDoTitulo(titulo ?? '')

  return (
    <header className="flex flex-col items-center text-center">
      <VertixCheckoutLogo />

      {titulo && (
        <h1 className="mt-7 max-w-2xl text-balance text-[26px] font-bold leading-[1.15] tracking-tight text-ink sm:text-4xl">
          {/* Sem a `hero-heading` de propósito: o cromado metálico dela escurece
              o miolo das letras, e num checkout o título precisa ser o texto
              mais legível da tela. O contraste que importa aqui é o accent da
              expressão final. A classe segue intacta no resto do painel. */}
          {inicio && <span className="text-ink">{inicio} </span>}
          {destaque && <span className="text-accent">{destaque}</span>}
        </h1>
      )}

      {subtitulo && (
        <p className="mt-3 max-w-xl text-sm font-light leading-relaxed text-muted">
          {subtitulo}
        </p>
      )}
    </header>
  )
}
