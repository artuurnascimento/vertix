import { supabase } from '../../lib/supabase'

/**
 * Modelo e envio do banner do checkout — a arte do topo da página pública.
 *
 * São DUAS imagens: uma para desktop e uma para celular. Um banner desenhado
 * para 1200px de largura, espremido em 390px, vira uma tarja de texto
 * ilegível — e é no celular que a maioria paga. Quem escolhe qual mostrar é o
 * `<picture>` da página, no HTML (ver BannerCheckout.tsx).
 *
 * O jsonb `checkouts.banner` guarda URL + LARGURA + ALTURA de cada uma. As
 * medidas não são enfeite: sem elas o navegador não reserva espaço e a página
 * salta quando a imagem chega — num checkout, isso é o botão de pagar se
 * mexendo debaixo do dedo.
 */

export type VarianteBanner = 'desktop' | 'mobile'

export interface BannerImagem {
  url: string
  /** Medidas naturais do arquivo. `null` quando não deu para medir. */
  largura: number | null
  altura: number | null
}

export interface Banner {
  desktop: BannerImagem | null
  mobile: BannerImagem | null
  /**
   * Texto alternativo. Vazio é resposta legítima e não um esquecimento:
   * banner que só repete o criativo do anúncio é decorativo, e mandar o leitor
   * de tela recitá-lo só atrapalha quem está tentando pagar.
   */
  alt: string
}

export const BANNER_VAZIO: Banner = { desktop: null, mobile: null, alt: '' }

export const BANNER_BUCKET = 'checkout-banners'

/**
 * Teto de 1 MB. Um banner bem exportado (WebP/AVIF) fica muito abaixo disso;
 * acima daqui não é banner, é PNG sem tratamento — e ele atrasa exatamente o
 * topo da página onde a venda acontece. O mesmo limite está no bucket, que é
 * quem realmente manda: esta validação existe para dar mensagem legível antes
 * de gastar o upload.
 */
export const BANNER_MAX_BYTES = 1024 * 1024

/**
 * SVG fica de fora de propósito, como em FilesCard.tsx: SVG carrega script e,
 * servido do mesmo domínio do storage, vira XSS armazenado. Aqui é pior,
 * porque este bucket é público e a imagem aparece numa página anônima.
 */
export const BANNER_TIPOS: readonly string[] = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
]

const EXTENSAO_POR_TIPO: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
}

export const VARIANTE_LABEL: Record<VarianteBanner, string> = {
  desktop: 'Desktop',
  mobile: 'Celular',
}

/** O mínimo que a validação precisa saber de um arquivo — testável sem `File`. */
export interface ArquivoEscolhido {
  name: string
  type: string
  size: number
}

function formatarMb(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`
}

/** Mensagem do problema, ou `null` quando o arquivo serve. */
export function validarArquivoBanner(arquivo: ArquivoEscolhido): string | null {
  if (!BANNER_TIPOS.includes(arquivo.type)) {
    return 'Formato não aceito. Envie JPG, PNG, WebP ou AVIF.'
  }
  if (arquivo.size > BANNER_MAX_BYTES) {
    return `A imagem tem ${formatarMb(arquivo.size)} e o limite é 1 MB. Exporte em WebP ou reduza a largura antes de enviar.`
  }
  return null
}

/**
 * Caminho no bucket. Nome sorteado, e não o nome do arquivo: dois lojistas
 * mandando "banner.png" não podem se sobrescrever, e um nome imprevisível
 * deixa o objeto imutável — por isso o cache longo lá embaixo.
 */
export function caminhoBanner(
  variante: VarianteBanner,
  tipo: string,
  id: string = crypto.randomUUID()
): string {
  const extensao = EXTENSAO_POR_TIPO[tipo] ?? 'img'
  return `${variante}/${id}.${extensao}`
}

// --------------------------------------------------------------- leitura --

function ehRegistro(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
}

function inteiroPositivo(valor: unknown): number | null {
  const numero = typeof valor === 'number' ? valor : Number.NaN
  return Number.isFinite(numero) && numero > 0 ? Math.round(numero) : null
}

function lerImagem(bruto: unknown): BannerImagem | null {
  if (!ehRegistro(bruto)) return null
  const url = typeof bruto.url === 'string' ? bruto.url.trim() : ''
  if (url === '') return null
  return {
    url,
    largura: inteiroPositivo(bruto.largura),
    altura: inteiroPositivo(bruto.altura),
  }
}

/**
 * jsonb solto do banco → banner com forma conhecida. Tolerante pelo mesmo
 * motivo de `parseProva`: o campo pode ter sido escrito por SQL, por outra
 * tela ou por uma versão anterior, e um banner malformado não pode derrubar o
 * formulário da oferta.
 */
export function parseBanner(bruto: unknown): Banner {
  if (!ehRegistro(bruto)) return BANNER_VAZIO
  return {
    desktop: lerImagem(bruto.desktop),
    mobile: lerImagem(bruto.mobile),
    alt: typeof bruto.alt === 'string' ? bruto.alt.trim() : '',
  }
}

/** Descarta o `alt` de um banner sem imagem — texto órfão não vai para o jsonb. */
export function limparBanner(banner: Banner): Banner {
  if (banner.desktop === null && banner.mobile === null) return BANNER_VAZIO
  return { ...banner, alt: banner.alt.trim() }
}

export function bannerVazio(banner: Banner): boolean {
  return banner.desktop === null && banner.mobile === null
}

// ----------------------------------------------------------------- envio --

/**
 * Medidas naturais do arquivo, lidas no navegador antes de subir.
 *
 * Nunca rejeita: se o navegador não conseguir decodificar, seguimos com
 * `null` e a página só perde a reserva de espaço. Falhar aqui e cancelar o
 * upload seria trocar um salto de layout por um banner que não existe.
 */
export function medirImagem(
  arquivo: Blob
): Promise<{ largura: number | null; altura: number | null }> {
  return new Promise((resolve) => {
    if (typeof URL.createObjectURL !== 'function') {
      resolve({ largura: null, altura: null })
      return
    }
    const endereco = URL.createObjectURL(arquivo)
    const imagem = new Image()
    const responder = (largura: number | null, altura: number | null) => {
      URL.revokeObjectURL(endereco)
      resolve({ largura, altura })
    }
    imagem.onload = () =>
      responder(imagem.naturalWidth || null, imagem.naturalHeight || null)
    imagem.onerror = () => responder(null, null)
    imagem.src = endereco
  })
}

/**
 * Sobe a arte e devolve a URL pública já com as medidas.
 *
 * Repare que o arquivo vai para o storage ANTES de o formulário ser salvo. É
 * por isso que trocar ou remover um banner aqui NÃO apaga o arquivo antigo:
 * se a pessoa trocar a imagem e fechar o modal sem salvar, o checkout que
 * está no ar continua apontando para o arquivo anterior. Objeto órfão no
 * bucket custa centavos; banner quebrado numa página de venda custa a venda.
 */
export async function enviarBanner(
  variante: VarianteBanner,
  arquivo: File
): Promise<BannerImagem> {
  const problema = validarArquivoBanner(arquivo)
  if (problema !== null) throw new Error(problema)

  const medidas = await medirImagem(arquivo)
  const caminho = caminhoBanner(variante, arquivo.type)

  const { error } = await supabase.storage
    .from(BANNER_BUCKET)
    .upload(caminho, arquivo, {
      // O nome é sorteado, então este objeto nunca muda de conteúdo: um ano de
      // cache tira a imagem do caminho crítico em toda visita seguinte.
      cacheControl: '31536000',
      contentType: arquivo.type,
      upsert: false,
    })
  if (error) throw new Error(mensagemDeUpload(error))

  const { data } = supabase.storage.from(BANNER_BUCKET).getPublicUrl(caminho)
  return { url: data.publicUrl, ...medidas }
}

/** Erro do Storage → frase que diz o que fazer, sem vazar detalhe de infra. */
export function mensagemDeUpload(erro: unknown): string {
  const texto =
    erro instanceof Error
      ? erro.message
      : typeof erro === 'object' && erro !== null && 'message' in erro
        ? String((erro as { message: unknown }).message)
        : ''
  const cru = texto.toLowerCase()

  if (cru.includes('bucket not found')) {
    return 'O bucket "checkout-banners" ainda não existe neste ambiente. Rode a migração do banner antes de enviar.'
  }
  if (cru.includes('exceeded') || cru.includes('maximum allowed size')) {
    return 'A imagem passou do limite de 1 MB aceito pelo servidor.'
  }
  if (cru.includes('mime') || cru.includes('not allowed')) {
    return 'O servidor recusou este formato. Envie JPG, PNG, WebP ou AVIF.'
  }
  if (cru.includes('row-level security') || cru.includes('unauthorized')) {
    return 'Sua sessão não tem permissão para enviar imagens. Entre de novo no painel.'
  }
  return 'Não foi possível enviar a imagem. Tente novamente.'
}
