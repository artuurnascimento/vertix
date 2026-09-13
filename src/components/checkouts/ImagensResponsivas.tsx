import { useState } from 'react'
import { inputClass, labelClass } from '../produtos/formUi'
import BannerCampoImagem from './BannerCampoImagem'
import {
  BANNER_MAX_BYTES,
  bannerVazio,
  enviarBanner,
  mensagemDeUpload,
  validarTipoBanner,
  type Banner,
  type VarianteBanner,
} from './bannerUpload'
import { descreverOtimizacao, otimizarImagem } from './otimizarImagem'

/** Largura em que a página mostra cada arte — acima disso é peso sem ganho. */
export const LARGURAS_PADRAO: Record<VarianteBanner, number> = {
  desktop: 1600,
  mobile: 780,
}

interface Props {
  valor: Banner
  /**
   * Recebe uma FUNÇÃO de atualização, e não o valor pronto.
   *
   * O upload é assíncrono: quando o de desktop termina, o `valor` que este
   * componente tinha em mãos ao começar já pode estar velho (a pessoa mexeu no
   * de celular no meio). Aplicando a mudança sobre o valor mais recente do
   * formulário, nenhuma das duas imagens some por causa da outra.
   */
  onChange: (atualizar: (atual: Banner) => Banner) => void
  /** Medidas sugeridas por variante — dica de arte, nunca validação. */
  dicas: Record<VarianteBanner, string>
  /** Subpasta no bucket (`''` para o banner do topo, `bump` para o order bump). */
  pasta?: string
  /** Largura máxima por variante: a arte maior é reduzida antes de subir. */
  larguras?: Record<VarianteBanner, number>
  placeholderAlt: string
}

/**
 * Um par de artes — desktop e celular — com prévia, troca, remoção e o texto
 * alternativo. É o miolo do banner do topo e da imagem do order bump: a mesma
 * arte não serve nos dois tamanhos (a larga, reduzida para um telefone, vira
 * uma tarja ilegível, e é no telefone que a maior parte das compras acontece),
 * então cada lugar que mostra imagem no checkout pede as duas.
 */
export default function ImagensResponsivas({
  valor,
  onChange,
  dicas,
  pasta = '',
  larguras = LARGURAS_PADRAO,
  placeholderAlt,
}: Props) {
  const [enviando, setEnviando] = useState<VarianteBanner | null>(null)
  const [erros, setErros] = useState<Partial<Record<VarianteBanner, string>>>({})
  const [avisos, setAvisos] = useState<Partial<Record<VarianteBanner, string>>>({})

  const definirErro = (variante: VarianteBanner, mensagem?: string) =>
    setErros((atuais) => ({ ...atuais, [variante]: mensagem }))
  const definirAviso = (variante: VarianteBanner, mensagem?: string) =>
    setAvisos((atuais) => ({ ...atuais, [variante]: mensagem }))

  const enviar = async (variante: VarianteBanner, arquivo: File) => {
    definirErro(variante, undefined)
    definirAviso(variante, undefined)

    // Só o formato barra na hora. Peso e largura não são problema da pessoa:
    // a otimização reduz, converte para WebP e comprime até caber no limite.
    const problema = validarTipoBanner(arquivo)
    if (problema !== null) {
      definirErro(variante, problema)
      return
    }

    setEnviando(variante)
    try {
      const { arquivo: pronto, relatorio } = await otimizarImagem(arquivo, {
        larguraMaxima: larguras[variante],
        maxBytes: BANNER_MAX_BYTES,
      })
      const imagem = await enviarBanner(variante, pronto, pasta)
      onChange((atual) => ({ ...atual, [variante]: imagem }))
      definirAviso(variante, descreverOtimizacao(relatorio) ?? undefined)
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
    definirAviso(variante, undefined)
    // Só solta a referência. O arquivo continua no bucket de propósito: o
    // checkout que está no ar ainda aponta para ele até este formulário ser
    // salvo, e fechar o modal sem salvar não pode deixar a página com uma
    // imagem quebrada.
    onChange((atual) => ({ ...atual, [variante]: null }))
  }

  const temImagem = !bannerVazio(valor)

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {(['desktop', 'mobile'] as const).map((variante) => (
          <BannerCampoImagem
            key={variante}
            variante={variante}
            imagem={valor[variante]}
            dica={dicas[variante]}
            enviando={enviando === variante}
            erro={erros[variante] ?? null}
            aviso={avisos[variante] ?? null}
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
            value={valor.alt}
            onChange={(event) => {
              const alt = event.target.value
              onChange((atual) => ({ ...atual, alt }))
            }}
            placeholder={placeholderAlt}
            className={inputClass}
          />
          <span className="text-xs font-light leading-relaxed text-muted">
            Lido por quem usa leitor de tela. Descreva o que a arte informa —
            ou deixe vazio se ela só repete o criativo do anúncio e não diz
            nada de novo.
          </span>
        </label>
      )}

      {valor.desktop !== null && valor.mobile === null && (
        <p className="text-xs font-light text-amber-300">
          Sem a versão de celular, a arte de desktop será usada também no
          telefone — e costuma ficar pequena demais para ler.
        </p>
      )}
      {valor.mobile !== null && valor.desktop === null && (
        <p className="text-xs font-light text-amber-300">
          Sem a versão de desktop, a arte de celular será esticada no
          computador.
        </p>
      )}
    </>
  )
}
