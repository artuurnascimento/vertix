import { useState } from 'react'
import { Bloco, inputClass, labelClass } from '../produtos/formUi'
import BannerCampoImagem from './BannerCampoImagem'
import {
  bannerVazio,
  enviarBanner,
  mensagemDeUpload,
  validarArquivoBanner,
  type Banner,
  type VarianteBanner,
} from './bannerUpload'

interface Props {
  banner: Banner
  /**
   * Recebe uma FUNÇÃO de atualização, e não o banner pronto.
   *
   * O upload é assíncrono: quando o de desktop termina, o `banner` que este
   * componente tinha em mãos ao começar já pode estar velho (a pessoa mexeu no
   * de celular no meio). Aplicando a mudança sobre o valor mais recente do
   * formulário, nenhuma das duas imagens some por causa da outra.
   */
  onChange: (atualizar: (atual: Banner) => Banner) => void
}

/** Medidas sugeridas — dica de arte, nunca validação. */
const DICAS: Record<VarianteBanner, string> = {
  desktop: '1600 × 400',
  mobile: '780 × 600',
}

/**
 * Banner do topo da página pública: uma arte para desktop, outra para celular.
 *
 * Duas e não uma porque a mesma imagem não serve nos dois lugares — o banner
 * largo, reduzido para a largura de um telefone, vira uma tarja ilegível, e é
 * no telefone que a maior parte das compras acontece.
 */
export default function BannerEditor({ banner, onChange }: Props) {
  const [enviando, setEnviando] = useState<VarianteBanner | null>(null)
  const [erros, setErros] = useState<Partial<Record<VarianteBanner, string>>>({})

  const definirErro = (variante: VarianteBanner, mensagem?: string) =>
    setErros((atuais) => ({ ...atuais, [variante]: mensagem }))

  const enviar = async (variante: VarianteBanner, arquivo: File) => {
    definirErro(variante, undefined)

    // Barra tipo e tamanho ANTES de gastar o upload: a mensagem chega na hora
    // e o servidor não precisa recusar um arquivo que já sabíamos ser grande.
    const problema = validarArquivoBanner(arquivo)
    if (problema !== null) {
      definirErro(variante, problema)
      return
    }

    setEnviando(variante)
    try {
      const imagem = await enviarBanner(variante, arquivo)
      onChange((atual) => ({ ...atual, [variante]: imagem }))
    } catch (erro) {
      definirErro(
        variante,
        erro instanceof Error ? erro.message : mensagemDeUpload(erro)
      )
    } finally {
      setEnviando(null)
    }
  }

  const remover = (variante: VarianteBanner) => {
    definirErro(variante, undefined)
    // Só solta a referência. O arquivo continua no bucket de propósito: o
    // checkout que está no ar ainda aponta para ele até este formulário ser
    // salvo, e fechar o modal sem salvar não pode deixar a página com um
    // banner quebrado.
    onChange((atual) => ({ ...atual, [variante]: null }))
  }

  const temImagem = !bannerVazio(banner)

  return (
    <Bloco
      titulo="Banner do topo"
      ajuda="Arte que abre a página, acima do título. Uma versão para desktop e outra para celular — sem banner, a página começa direto no título."
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {(['desktop', 'mobile'] as const).map((variante) => (
          <BannerCampoImagem
            key={variante}
            variante={variante}
            imagem={banner[variante]}
            dica={DICAS[variante]}
            enviando={enviando === variante}
            erro={erros[variante] ?? null}
            onArquivo={(arquivo) => void enviar(variante, arquivo)}
            onRemover={() => remover(variante)}
          />
        ))}
      </div>

      {temImagem && (
        <label className="flex flex-col gap-1.5">
          <span className={labelClass}>Texto alternativo</span>
          <input
            type="text"
            value={banner.alt}
            onChange={(event) => {
              const alt = event.target.value
              onChange((atual) => ({ ...atual, alt }))
            }}
            placeholder="Plano de correção da loja em 7 dias"
            className={inputClass}
          />
          <span className="text-xs font-light leading-relaxed text-muted">
            Lido por quem usa leitor de tela. Descreva o que a arte informa —
            ou deixe vazio se ela só repete o criativo do anúncio e não diz
            nada de novo.
          </span>
        </label>
      )}

      {banner.desktop !== null && banner.mobile === null && (
        <p className="text-xs font-light text-amber-300">
          Sem a versão de celular, a arte de desktop será usada também no
          telefone — e costuma ficar pequena demais para ler.
        </p>
      )}
      {banner.mobile !== null && banner.desktop === null && (
        <p className="text-xs font-light text-amber-300">
          Sem a versão de desktop, a arte de celular será esticada no
          computador.
        </p>
      )}
    </Bloco>
  )
}
