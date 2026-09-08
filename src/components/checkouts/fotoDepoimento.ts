import { supabase } from '../../lib/supabase'
import { BANNER_BUCKET } from './bannerUpload'

/**
 * Foto de perfil do depoimento: escolher, encolher e enviar.
 *
 * O REDIMENSIONAMENTO É O PONTO DESTE ARQUIVO. A foto sai da galeria do
 * celular com 3 a 5 MB e 4000px de largura para ser exibida num círculo de 28
 * pixels no checkout. Sem encolher, ou o arquivo é recusado pelo limite do
 * bucket (1 MB), ou passa e vira meio megabyte carregando na frente de quem
 * está decidindo pagar — o lugar mais caro da loja para se perder tempo.
 *
 * Encolher no navegador, e não no servidor: o corte acontece antes de a foto
 * sair do computador de quem cadastrou, então nada de grande trafega, e não
 * existe função de imagem para manter no backend.
 *
 * Guardadas no mesmo bucket dos banners, sob `avaliacoes/`. Bucket separado só
 * para isto seria mais uma migration, mais um conjunto de policies e mais um
 * nome para lembrar — sendo que as regras necessárias são idênticas: leitura
 * pública (a página é anônima), escrita só para a equipe, e nada de SVG.
 */

/** Lado do quadrado gravado, em pixels. */
const LADO = 128

/**
 * Por que 128 para exibir 28: telas de celular desenham a 3x, então 84px é o
 * tamanho realmente necessário hoje. 128 dá folga para o componente crescer
 * sem ninguém precisar recadastrar foto, e ainda assim o arquivo fica na casa
 * dos poucos quilobytes.
 */
export const FOTO_LADO = LADO

/** Qualidade do WebP. 0.82 é onde o artefato deixa de ser visível num avatar. */
const QUALIDADE = 0.82

/** Teto do arquivo ORIGINAL, antes de encolher. */
export const FOTO_MAX_BYTES = 12 * 1024 * 1024

export const FOTO_TIPOS: readonly string[] = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
]

/**
 * Mensagem de recusa, ou `null` quando o arquivo serve.
 *
 * SVG fica de fora mesmo sendo imagem: arquivo com script dentro, servido do
 * nosso próprio domínio, é execução de código de terceiro na página do
 * checkout. Mesma regra do upload de banner e do de arquivos de projeto.
 */
export function validarFoto(arquivo: {
  type: string
  size: number
}): string | null {
  if (!FOTO_TIPOS.includes(arquivo.type)) {
    return 'Use uma imagem JPEG, PNG, WebP ou AVIF.'
  }
  if (arquivo.size > FOTO_MAX_BYTES) {
    return 'Escolha uma foto de até 12 MB.'
  }
  return null
}

/**
 * Encolhe para um quadrado de `LADO`, cortando pelo centro.
 *
 * O corte central existe porque foto de perfil é redonda na página: uma imagem
 * deitada, se apenas espremida, entrega um rosto achatado. Cortar pelo meio é
 * o que a maioria das pessoas espera ao subir uma foto de rosto.
 */
export async function encolherParaAvatar(arquivo: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(arquivo)
  try {
    const canvas = document.createElement('canvas')
    canvas.width = LADO
    canvas.height = LADO

    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('canvas_indisponivel')

    // Lado do maior quadrado que cabe na imagem, centralizado.
    const corte = Math.min(bitmap.width, bitmap.height)
    const origemX = (bitmap.width - corte) / 2
    const origemY = (bitmap.height - corte) / 2

    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(bitmap, origemX, origemY, corte, corte, 0, 0, LADO, LADO)

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/webp', QUALIDADE)
    )
    if (!blob) throw new Error('conversao_falhou')
    return blob
  } finally {
    // Libera a memória do decodificador mesmo se algo acima falhar: num
    // formulário com vários depoimentos, isso se acumula.
    bitmap.close()
  }
}

/** Caminho no bucket. O nome aleatório evita adivinhar a foto de outra oferta. */
export function caminhoFoto(): string {
  return `avaliacoes/${crypto.randomUUID()}.webp`
}

/**
 * Encolhe, envia e devolve a URL pública.
 *
 * A foto antiga NÃO é apagada ao trocar, mesma decisão do banner: o envio
 * acontece antes de salvar o formulário, e apagar agora deixaria a página que
 * está no ar com foto quebrada caso a pessoa feche o modal sem salvar. Arquivo
 * órfão custa alguns quilobytes; depoimento com foto quebrada custa a
 * credibilidade da prova social inteira.
 */
export async function enviarFoto(arquivo: Blob): Promise<string> {
  const pequena = await encolherParaAvatar(arquivo)
  const caminho = caminhoFoto()

  const { error } = await supabase.storage
    .from(BANNER_BUCKET)
    .upload(caminho, pequena, { contentType: 'image/webp', upsert: false })
  if (error) throw new Error(error.message)

  const { data } = supabase.storage.from(BANNER_BUCKET).getPublicUrl(caminho)
  return data.publicUrl
}
