import ImagemResponsiva from './ImagemResponsiva'
import type { BannerCheckout } from './checkoutTypes'

interface Props {
  banner: BannerCheckout | null
}

/**
 * Arte que abre a página, acima do título. Sem banner configurado, o
 * componente não desenha NADA — nem moldura, nem espaço reservado: buraco
 * vazio no topo do checkout parece página quebrada.
 *
 * A troca desktop/celular e a reserva de espaço estão em ImagemResponsiva; o
 * que é só do topo é a prioridade alta — é o elemento mais alto da página, o
 * próprio LCP.
 */
export default function BannerTopo({ banner }: Props) {
  if (banner === null) return null
  return (
    <ImagemResponsiva
      imagem={banner}
      prioridade="alta"
      className="h-auto w-full rounded-2xl border border-white/[0.07] object-cover"
    />
  )
}
