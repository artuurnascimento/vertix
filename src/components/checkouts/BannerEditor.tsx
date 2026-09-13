import { Bloco } from '../produtos/formUi'
import ImagensResponsivas from './ImagensResponsivas'
import type { Banner, VarianteBanner } from './bannerUpload'

interface Props {
  banner: Banner
  /** Função de atualização, pelo motivo explicado em ImagensResponsivas. */
  onChange: (atualizar: (atual: Banner) => Banner) => void
}

/** Medidas sugeridas — dica de arte, nunca validação. */
const DICAS: Record<VarianteBanner, string> = {
  desktop: '1600 × 400',
  mobile: '780 × 600',
}

/**
 * Banner do topo da página pública: uma arte para desktop, outra para celular.
 * O miolo (upload, prévia, alt) é o mesmo da imagem do order bump — ver
 * ImagensResponsivas; aqui só mora o que é do topo: o bloco e as medidas.
 */
export default function BannerEditor({ banner, onChange }: Props) {
  return (
    <Bloco
      titulo="Banner do topo"
      ajuda="Arte que abre a página, acima do título. Uma versão para desktop e outra para celular — sem banner, a página começa direto no título."
    >
      <ImagensResponsivas
        valor={banner}
        onChange={onChange}
        dicas={DICAS}
        larguras={{ desktop: 1600, mobile: 780 }}
        placeholderAlt="Plano de correção da loja em 7 dias"
      />
    </Bloco>
  )
}
