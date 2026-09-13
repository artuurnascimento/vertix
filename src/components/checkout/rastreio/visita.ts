/**
 * Leitura PURA do que o navegador conta sobre a visita: dispositivo,
 * navegador, sistema, UTMs, qual seção está no centro da tela e qual campo
 * tem o cursor. Sem React, sem rede — testado em visita.test.ts e usado por
 * useRastreio.ts. O servidor (RPC checkout_rastrear) refaz a classificação
 * de bot por conta própria; aqui só descrevemos.
 */

export type Dispositivo = 'celular' | 'tablet' | 'computador'

/** Campos que podem estar com o cursor. `cartao` é qualquer iframe/campo
 *  dentro da seção de pagamento — o conteúdo é do Mercado Pago, nunca nosso. */
export type CampoEmFoco = 'nome' | 'email' | 'whatsapp' | 'documento' | 'cartao'

export function dispositivoDoAgente(agente: string): Dispositivo {
  const ua = agente.toLowerCase()
  if (/ipad|tablet|kindle|silk|playbook/.test(ua)) return 'tablet'
  if (/android/.test(ua) && !/mobile/.test(ua)) return 'tablet'
  if (/mobi|iphone|ipod|android|windows phone|opera mini/.test(ua)) return 'celular'
  return 'computador'
}

/**
 * Navegador legível. Os embutidos em app (Instagram, Facebook, TikTok) vêm
 * ANTES do Chrome/Safari porque o agente deles também contém "Safari": para
 * quem olha o painel, "Instagram" diz muito mais sobre de onde a pessoa veio.
 */
export function navegadorDoAgente(agente: string): string {
  if (/Instagram/i.test(agente)) return 'Instagram'
  if (/FBAN|FBAV|FB_IAB/.test(agente)) return 'Facebook'
  if (/TikTok|Bytedance|musical_ly/i.test(agente)) return 'TikTok'
  if (/Edg(e|A|iOS)?\//.test(agente)) return 'Edge'
  if (/OPR\/|Opera/.test(agente)) return 'Opera'
  if (/SamsungBrowser/.test(agente)) return 'Samsung Internet'
  if (/Firefox\/|FxiOS/.test(agente)) return 'Firefox'
  if (/Chrome\/|CriOS\//.test(agente)) return 'Chrome'
  if (/Safari\//.test(agente)) return 'Safari'
  return 'Outro'
}

export function sistemaDoAgente(agente: string): string {
  if (/iPhone|iPad|iPod/.test(agente)) return 'iOS'
  if (/Android/.test(agente)) return 'Android'
  if (/Windows/.test(agente)) return 'Windows'
  if (/Macintosh|Mac OS X/.test(agente)) return 'macOS'
  if (/CrOS/.test(agente)) return 'ChromeOS'
  if (/Linux/.test(agente)) return 'Linux'
  return 'Outro'
}

/**
 * UTMs da URL, já podadas. `fbclid`/`gclid`/`ttclid` viram só um marcador de
 * origem (o valor é um token de rastreio da plataforma, não interessa).
 */
export function utmDaBusca(busca: string): Record<string, string> {
  const params = new URLSearchParams(busca)
  const utm: Record<string, string> = {}
  for (const [chave, valor] of params) {
    const limpo = valor.trim()
    if (!limpo) continue
    if (/^utm_(source|medium|campaign|content|term)$/.test(chave)) {
      utm[chave] = limpo.slice(0, 80)
    }
  }
  if (params.has('fbclid')) utm.clid = 'facebook'
  else if (params.has('gclid')) utm.clid = 'google'
  else if (params.has('ttclid')) utm.clid = 'tiktok'
  return utm
}

/** Uma seção da página e como ela aparece na tela agora. */
export interface SecaoNaTela {
  secao: string
  /** Fração da seção dentro da viewport (0 = fora). */
  proporcao: number
  /** Distância do retângulo ao centro da tela; 0 quando o centro cai nela. */
  distanciaAoCentro: number
}

/**
 * Qual seção a pessoa está OLHANDO: a que cobre o centro da tela; se nenhuma
 * cobre, a visível mais perto dele. Proporção sozinha enganaria — um bloco
 * pequeno 100% visível no rodapé "ganharia" do formulário grande que ocupa
 * o meio da tela.
 */
export function secaoDominante(secoes: readonly SecaoNaTela[]): string | null {
  const visiveis = secoes.filter((s) => s.proporcao > 0)
  if (visiveis.length === 0) return null
  return [...visiveis].sort(
    (a, b) =>
      a.distanciaAoCentro - b.distanciaAoCentro || b.proporcao - a.proporcao
  )[0].secao
}

/** Distância de um retângulo (topo/base, em px da viewport) ao centro dela. */
export function distanciaAoCentro(
  topo: number,
  base: number,
  alturaDaTela: number
): number {
  const centro = alturaDaTela / 2
  if (topo <= centro && base >= centro) return 0
  return Math.min(Math.abs(topo - centro), Math.abs(base - centro))
}

/**
 * Qual campo tem o cursor. Os campos de contato têm id `cliente-<campo>`
 * (DadosCliente.tsx); tudo que ganha foco dentro de `#pagamento` — os
 * iframes dos Secure Fields/Brick, o select de parcelas — é "cartao".
 */
export function campoEmFoco(ativo: Element | null): CampoEmFoco | null {
  if (!ativo) return null
  const contato = /^cliente-(nome|email|whatsapp|documento)$/.exec(ativo.id ?? '')
  if (contato) return contato[1] as CampoEmFoco
  if (!ativo.closest('#pagamento')) return null
  const tag = ativo.tagName
  if (tag === 'IFRAME' || tag === 'INPUT' || tag === 'SELECT') return 'cartao'
  return null
}

/** Os campos cujo VALOR vai para a sessão. Documento nunca. */
export const CAMPOS_COM_VALOR: ReadonlySet<CampoEmFoco> = new Set([
  'nome',
  'email',
  'whatsapp',
])
