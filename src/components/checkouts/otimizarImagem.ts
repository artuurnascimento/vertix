/**
 * Otimização da arte no navegador, antes do upload: reduz para a largura que
 * a página realmente usa, converte para WebP e aperta a qualidade até caber
 * no limite do bucket. Quem monta a oferta manda o PNG de 4 MB que saiu do
 * Figma e recebe de volta um WebP de 150 KB — sem abrir outro programa.
 *
 * A parte que decide (qual largura, qual qualidade, quando desistir) é pura
 * e testada; a parte que desenha usa canvas e só roda no navegador.
 */

export interface OpcoesDeOtimizacao {
  /** Largura máxima em px — a arte maior que isso é reduzida (nunca ampliada). */
  larguraMaxima: number
  /** Teto em bytes do arquivo final. */
  maxBytes: number
}

export interface Tentativa {
  qualidade: number
  largura: number
}

export interface RelatorioDeOtimizacao {
  deBytes: number
  paraBytes: number
  deLargura: number
  paraLargura: number
  deTipo: string
  paraTipo: string
}

const QUALIDADE_INICIAL = 0.9
const QUALIDADE_MINIMA = 0.5
const PASSO_DE_QUALIDADE = 0.1
/** Quando a qualidade mínima não basta, a largura cai 15% e a qualidade volta a 0,8. */
const FATOR_DE_REDUCAO = 0.85
const QUALIDADE_APOS_REDUZIR = 0.8
/** Abaixo disto a arte deixa de servir: melhor avisar do que subir um borrão. */
export const LARGURA_MINIMA = 320

/**
 * Próximo par (qualidade, largura) a tentar quando o resultado ainda passou
 * do limite: primeiro baixa a qualidade até 0,5; depois reduz a largura e
 * recomeça em 0,8. `null` = não há mais o que fazer.
 */
export function proximaTentativa(atual: Tentativa): Tentativa | null {
  const qualidade = Math.round((atual.qualidade - PASSO_DE_QUALIDADE) * 100) / 100
  if (qualidade >= QUALIDADE_MINIMA) return { qualidade, largura: atual.largura }
  const largura = Math.round(atual.largura * FATOR_DE_REDUCAO)
  if (largura < LARGURA_MINIMA) return null
  return { qualidade: QUALIDADE_APOS_REDUZIR, largura }
}

/** Primeira tentativa: a largura da página (ou a da arte, se menor) em qualidade alta. */
export function primeiraTentativa(larguraDaArte: number, larguraMaxima: number): Tentativa {
  return { qualidade: QUALIDADE_INICIAL, largura: Math.min(larguraDaArte, larguraMaxima) }
}

export function formatarTamanho(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

/** "Otimizada: 1,4 MB → 180 KB · 1400 px · WebP". `null` quando nada mudou. */
export function descreverOtimizacao(r: RelatorioDeOtimizacao): string | null {
  const mudou = r.paraBytes !== r.deBytes || r.paraLargura !== r.deLargura || r.paraTipo !== r.deTipo
  if (!mudou) return null
  const partes = [`${formatarTamanho(r.deBytes)} → ${formatarTamanho(r.paraBytes)}`]
  if (r.paraLargura !== r.deLargura) partes.push(`${r.deLargura} → ${r.paraLargura} px`)
  if (r.paraTipo !== r.deTipo) partes.push(nomeDoTipo(r.paraTipo))
  return `Otimizada: ${partes.join(' · ')}`
}

function nomeDoTipo(tipo: string): string {
  return tipo === 'image/webp' ? 'WebP' : tipo === 'image/jpeg' ? 'JPG' : tipo
}

// ------------------------------------------------------------ navegador --

type Fonte = ImageBitmap | HTMLImageElement

/** Decodifica respeitando a orientação EXIF (foto de celular deitada). */
async function decodificar(arquivo: Blob): Promise<Fonte> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(arquivo, { imageOrientation: 'from-image' })
    } catch {
      // formato que o bitmap não decodifica (AVIF em navegador antigo): tenta o <img>
    }
  }
  return new Promise((resolve, reject) => {
    const endereco = URL.createObjectURL(arquivo)
    const imagem = new Image()
    imagem.onload = () => {
      URL.revokeObjectURL(endereco)
      resolve(imagem)
    }
    imagem.onerror = () => {
      URL.revokeObjectURL(endereco)
      reject(new Error('Não foi possível ler a imagem. Ela pode estar corrompida.'))
    }
    imagem.src = endereco
  })
}

function larguraDe(fonte: Fonte): number {
  return 'naturalWidth' in fonte ? fonte.naturalWidth : fonte.width
}
function alturaDe(fonte: Fonte): number {
  return 'naturalHeight' in fonte ? fonte.naturalHeight : fonte.height
}

/**
 * Redesenha na largura pedida. Reduzir de uma vez só de 4000 para 800 px
 * serrilha; reduzir pela metade repetidas vezes até chegar perto preserva as
 * bordas — é o que os editores fazem por baixo dos panos.
 */
function redimensionar(fonte: Fonte, largura: number): HTMLCanvasElement {
  let atualLargura = larguraDe(fonte)
  let atualAltura = alturaDe(fonte)
  const altura = Math.max(1, Math.round((largura / atualLargura) * atualAltura))
  let origem: CanvasImageSource = fonte
  while (atualLargura / 2 > largura) {
    const passo = document.createElement('canvas')
    passo.width = Math.round(atualLargura / 2)
    passo.height = Math.round(atualAltura / 2)
    const ctx = passo.getContext('2d')
    if (!ctx) throw new Error('Este navegador não consegue processar imagens.')
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(origem, 0, 0, passo.width, passo.height)
    origem = passo
    atualLargura = passo.width
    atualAltura = passo.height
  }
  const final = document.createElement('canvas')
  final.width = largura
  final.height = altura
  const ctx = final.getContext('2d')
  if (!ctx) throw new Error('Este navegador não consegue processar imagens.')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(origem, 0, 0, largura, altura)
  return final
}

function codificar(canvas: HTMLCanvasElement, tipo: string, qualidade: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, tipo, qualidade))
}

let suporteAWebp: boolean | null = null

/** Safari antigo devolve PNG quando se pede WebP; aí o caminho é JPG. */
async function tipoDeSaida(): Promise<'image/webp' | 'image/jpeg'> {
  if (suporteAWebp === null) {
    const prova = document.createElement('canvas')
    prova.width = 1
    prova.height = 1
    const blob = await codificar(prova, 'image/webp', 0.8)
    suporteAWebp = blob?.type === 'image/webp'
  }
  return suporteAWebp ? 'image/webp' : 'image/jpeg'
}

function renomear(nome: string, tipo: string): string {
  const base = nome.replace(/\.[^.]+$/, '') || 'imagem'
  return `${base}.${tipo === 'image/webp' ? 'webp' : 'jpg'}`
}

/**
 * Arquivo pronto para subir. Se a arte já está dentro da largura e do peso,
 * ainda assim tenta o WebP e fica com o menor dos dois — mas nunca troca
 * AVIF por WebP (é menor ainda) nem amplia nada. Lança erro só quando nem a
 * largura mínima cabe no limite.
 */
export async function otimizarImagem(
  arquivo: File,
  opcoes: OpcoesDeOtimizacao
): Promise<{ arquivo: File; relatorio: RelatorioDeOtimizacao }> {
  const fonte = await decodificar(arquivo)
  const larguraOriginal = larguraDe(fonte)
  const relatorioOriginal: RelatorioDeOtimizacao = {
    deBytes: arquivo.size,
    paraBytes: arquivo.size,
    deLargura: larguraOriginal,
    paraLargura: larguraOriginal,
    deTipo: arquivo.type,
    paraTipo: arquivo.type,
  }
  const dentroDosLimites = arquivo.size <= opcoes.maxBytes && larguraOriginal <= opcoes.larguraMaxima
  if (dentroDosLimites && arquivo.type === 'image/avif') {
    return { arquivo, relatorio: relatorioOriginal }
  }

  const tipo = await tipoDeSaida()
  let tentativa: Tentativa | null = primeiraTentativa(larguraOriginal, opcoes.larguraMaxima)
  while (tentativa !== null) {
    const canvas = redimensionar(fonte, tentativa.largura)
    const blob = await codificar(canvas, tipo, tentativa.qualidade)
    if (blob && blob.size <= opcoes.maxBytes) {
      // Já servia e o original é menor que o convertido: fica o original.
      if (dentroDosLimites && arquivo.size <= blob.size) {
        return { arquivo, relatorio: relatorioOriginal }
      }
      const pronto = new File([blob], renomear(arquivo.name, tipo), { type: tipo })
      return {
        arquivo: pronto,
        relatorio: {
          ...relatorioOriginal,
          paraBytes: pronto.size,
          paraLargura: canvas.width,
          paraTipo: tipo,
        },
      }
    }
    tentativa = proximaTentativa(tentativa)
  }
  throw new Error(
    `Não deu para deixar a imagem abaixo de ${formatarTamanho(opcoes.maxBytes)} sem estragá-la. Simplifique a arte ou envie outra.`
  )
}
