import type { BannerCheckout } from './checkoutTypes'

interface Props {
  banner: BannerCheckout | null
}

/**
 * Arte que abre a página, acima do título. Sem banner configurado, o
 * componente não desenha NADA — nem moldura, nem espaço reservado: buraco
 * vazio no topo do checkout parece página quebrada.
 *
 * A troca desktop/celular é feita por `<picture><source media>`, no HTML. O
 * navegador escolhe a arte antes de baixar qualquer coisa; fazer isso por
 * JavaScript pintaria a arte errada primeiro e depois trocaria, empurrando a
 * página inteira para baixo bem quando a pessoa vai clicar em pagar.
 *
 * A arte do CELULAR é a que fica no `<img>`, e o `<source>` é a exceção para
 * telas largas. É a ordem certa: o `<img>` é o que carrega quando o
 * `<picture>` não é entendido, e é do celular que vem a maior parte das
 * compras.
 */
export default function BannerTopo({ banner }: Props) {
  if (banner === null) return null

  const { desktop, mobile } = banner
  // Só uma arte cadastrada? Ela serve nos dois tamanhos — banner torto é
  // melhor que topo vazio, e o painel já avisa o lojista disso.
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
        alt={banner.alt}
        // width/height são o que reserva o espaço antes de a imagem chegar.
        // Com `h-auto w-full` o CSS manda no tamanho final, mas a PROPORÇÃO
        // vinda daqui já segura o layout — sem isso o título e o formulário
        // saltam quando a arte carrega.
        width={padrao.largura ?? undefined}
        height={padrao.altura ?? undefined}
        // É o elemento mais alto da página: nada de `lazy` aqui, ou o próprio
        // LCP entra na fila atrás de si mesmo.
        loading="eager"
        fetchPriority="high"
        decoding="async"
        className="h-auto w-full rounded-2xl border border-white/[0.07] object-cover"
      />
    </picture>
  )
}
