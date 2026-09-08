/**
 * Derivações de CONTEÚDO da página: como quebrar em benefícios um texto que o
 * dono do checkout escreveu, e como repartir garantia e selos entre a coluna
 * do resumo e a do fluxo.
 *
 * Regra que atravessa o arquivo: nada aqui INVENTA texto. Todas as funções só
 * recortam, ordenam e distribuem o que já veio da configuração. Quando não há
 * como formar um bloco, elas devolvem vazio e a tela some com o bloco — um
 * lugar a menos onde a página poderia prometer algo que ninguém prometeu.
 */

/** Acima disto a frase não é "benefício curto": vira parágrafo. */
const TAMANHO_MAXIMO_BENEFICIO = 90

/** Quantos itens da descrição do bump viram lista; o resto volta a parágrafo. */
const MAXIMO_BENEFICIOS = 3

/**
 * Separadores que o lojista usa de propósito para listar. Hífen e asterisco
 * entram só no INÍCIO da linha (regra aplicada depois): "day-to-day" não pode
 * virar duas linhas.
 */
const SEPARADORES = /[\n\r•|;]+/

function limparItem(bruto: string): string {
  // Marcador de lista no começo da linha: "- ", "– ", "* ".
  return bruto.trim().replace(/^[-–—*]\s+/, '').trim()
}

function partirEmSeparadores(texto: string): string[] {
  return texto.split(SEPARADORES).map(limparItem).filter((item) => item !== '')
}

/**
 * Quebra em frases sem lookbehind — Safari só passou a aceitar `(?<=)` na 16.4,
 * e um SyntaxError na avaliação do módulo derrubaria o checkout inteiro em tela
 * branca para quem ainda está no iPhone antigo.
 */
function partirEmFrases(texto: string): string[] {
  const frases = texto.match(/[^.!?]+[.!?]*/g)
  if (frases === null) return []
  return frases.map((frase) => frase.trim()).filter((frase) => frase !== '')
}

export interface TextoDoBump {
  /** Parágrafo explicativo à esquerda. `null` quando tudo virou lista. */
  paragrafo: string | null
  /** Itens da coluna da direita. Vazio = a coluna não existe. */
  beneficios: string[]
}

/**
 * Recorta o texto do bump em parágrafo + lista de benefícios.
 *
 * Ordem das tentativas:
 *   1. separadores explícitos (quebra de linha, `•`, `|`, `;`) — o lojista
 *      escreveu uma lista, respeitamos a lista;
 *   2. frases curtas — "Entrego em 24h. Suporte por 30 dias." vira duas linhas;
 *   3. nada: o texto continua parágrafo e a coluna da direita some.
 *
 * O que sobra além do terceiro item volta como parágrafo: cortar conteúdo
 * configurado seria pior que uma linha a mais de texto.
 */
export function textoDoBump(descricao: string | null): TextoDoBump {
  if (descricao === null || descricao.trim() === '') {
    return { paragrafo: null, beneficios: [] }
  }

  const explicitos = partirEmSeparadores(descricao)
  const frases = partirEmFrases(descricao)
  const itens =
    explicitos.length >= 2
      ? explicitos
      : frases.length >= 2 &&
          frases.every((frase) => frase.length <= TAMANHO_MAXIMO_BENEFICIO)
        ? frases
        : []

  // Sem lista possível o texto segue parágrafo, e a coluna da direita some.
  if (itens.length < 2) {
    return { paragrafo: descricao.trim(), beneficios: [] }
  }

  const resto = itens.slice(MAXIMO_BENEFICIOS)
  return {
    paragrafo: resto.length > 0 ? resto.join(' ') : null,
    beneficios: itens.slice(0, MAXIMO_BENEFICIOS),
  }
}

export interface TituloDestacado {
  /** Trecho em cor normal. Pode ser vazio quando o título inteiro é destaque. */
  inicio: string
  /** Última expressão, pintada de accent. Vazia = título sem destaque. */
  destaque: string
}

/** Palavras destacadas quando o título é longo o bastante para comportar. */
const PALAVRAS_DESTACADAS = 3
const MINIMO_PARA_EXPRESSAO = 5
const MINIMO_PARA_PALAVRA = 3

/**
 * Separa a última expressão do título para a tela pintá-la de roxo. É recorte,
 * não reescrita: as palavras são exatamente as configuradas, na mesma ordem.
 *
 * Título curto não ganha destaque — pintar duas de três palavras não cria
 * hierarquia nenhuma, só deixa o título malhado.
 */
export function destacarFinalDoTitulo(titulo: string): TituloDestacado {
  const palavras = titulo.trim().split(/\s+/).filter((p) => p !== '')
  if (palavras.length === 0) return { inicio: '', destaque: '' }

  const quantas =
    palavras.length >= MINIMO_PARA_EXPRESSAO
      ? PALAVRAS_DESTACADAS
      : palavras.length >= MINIMO_PARA_PALAVRA
        ? 1
        : 0

  if (quantas === 0) return { inicio: palavras.join(' '), destaque: '' }

  const corte = palavras.length - quantas
  return {
    inicio: palavras.slice(0, corte).join(' '),
    destaque: palavras.slice(corte).join(' '),
  }
}
