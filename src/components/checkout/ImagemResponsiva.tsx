import type { BannerCheckout } from './checkoutTypes'

interface Props {
  imagem: BannerCheckout
  className: string
  /**
   * `alta` para a arte mais alta da página (o banner do topo): carrega antes
   * de tudo, porque é o próprio LCP. `normal` para o resto.
   */
  prioridade?: 'alta' | 'normal'
}

/**
 * Uma arte em duas versões — celular e desktop — escolhida pelo navegador no
 * HTML, com `<picture><source media>`. Fazer a troca por JavaScript pintaria a
 * arte errada primeiro e depois trocaria, empurrando a página para baixo bem
 * quando a pessoa vai clicar em pagar.
 *
 * A arte do CELULAR é a que fica no `<img>`, e o `<source>` é a exceção para
 * telas largas: o `<img>` é o que carrega quando o `<picture>` não é
 * entendido, e é do celular que vem a maior parte das compras. Só uma arte
 * cadastrada? Ela serve nos dois tamanhos — arte torta é melhor que buraco, e
 * o painel já avisa o lojista disso.
 *
 * width/height são o que reserva o espaço antes de a imagem chegar. Com
 * `h-auto w-full` no className o CSS manda no tamanho final, mas a PROPORÇÃO
 * vinda daqui já segura o layout — sem isso o que está embaixo salta quando a
 * arte carrega.
 */
export default function ImagemResponsiva({ imagem, className, prioridade = 'normal' }: Props) {
  const { desktop, mobile } = imagem
  const padrao = mobile ?? desktop
  if (padrao === null) return null

  const trocaNoDesktop = desktop !== null && mobile !== null

  return (
    <picture>
      {trocaNoDesktop && (
        // `md` (768px) é o mesmo ponto em que o resto da página deixa de ser
        // uma coluna só.
        <source
          media="(min-width: 768px)"
          srcSet={desktop.url}
          width={desktop.largura ?? undefined}
          height={desktop.altura ?? undefined}
        />
      )}
      <img
        src={padrao.url}
        // `alt` vazio (e não ausente) quando o lojista não descreveu a arte:
        // é a forma de dizer ao leitor de tela que a imagem é decorativa, em
        // vez de fazê-lo soletrar o nome do arquivo.
        alt={imagem.alt}
        width={padrao.largura ?? undefined}
        height={padrao.altura ?? undefined}
        // Nada de `lazy` em nenhum dos dois casos: as duas artes ficam acima
        // da dobra, e o LCP não pode entrar na fila atrás de si mesmo.
        loading="eager"
        fetchPriority={prioridade === 'alta' ? 'high' : 'auto'}
        decoding="async"
        className={className}
      />
    </picture>
  )
}
