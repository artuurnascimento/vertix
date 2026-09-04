/**
 * Lógica pura do link de bio — nada aqui toca no navegador nem na rede, para
 * poder ser testado direto (o projeto testa lógica isolada, não componentes).
 * Quem visita a página nunca lê a tabela: o backend já devolve só os botões
 * visíveis. Estas funções repetem o filtro no cliente porque a prévia do
 * console mostra o mesmo cálculo sobre os registros crus, incluindo os
 * desligados e os fora de vigência.
 */

import { buildWhatsAppLink, normalizePhoneBR } from '../ui/whatsapp'

export type BioFormato = 'destaque' | 'largo' | 'grade'
export type BioTipoDestino = 'url' | 'whatsapp'

/** Botão como a página o consome (formato de get_bio_links). */
export interface BioLink {
  id: string
  rotulo: string
  descricao: string | null
  icone: string | null
  formato: BioFormato
  tipo_destino: BioTipoDestino
  /** Endereço quando o tipo é url; número quando é whatsapp. */
  destino: string
  mensagem: string | null
  posicao: number
  /** Só existe nos registros crus do console; ausente no retorno público. */
  ativo?: boolean
  inicia_em?: string | null
  termina_em?: string | null
}

/** Botões que devem aparecer agora, na ordem de exibição. */
export function linksVisiveis(links: BioLink[], agora: Date): BioLink[] {
  const t = agora.getTime()
  return links
    .filter((link) => {
      // `ativo` ausente = veio do retorno público, que já filtrou.
      if (link.ativo === false) return false
      if (link.destino.trim() === '') return false
      if (link.inicia_em && new Date(link.inicia_em).getTime() > t) return false
      if (link.termina_em && new Date(link.termina_em).getTime() <= t) return false
      return true
    })
    .slice()
    .sort((a, b) => a.posicao - b.posicao)
}

/**
 * Endereço final do botão. Devolve null quando o destino não dá para montar
 * (número inválido, por exemplo) — o chamador oculta o botão em vez de
 * entregar um link quebrado.
 */
export function destinoFinal(link: BioLink): string | null {
  const destino = link.destino.trim()
  if (destino === '') return null

  if (link.tipo_destino === 'whatsapp') {
    const mensagem = link.mensagem?.trim()
    if (mensagem) return buildWhatsAppLink(destino, mensagem)
    // Sem mensagem, evita o "?text=" vazio que buildWhatsAppLink deixaria.
    const numero = normalizePhoneBR(destino)
    return numero ? `https://wa.me/${numero}` : null
  }

  return destino
}

export interface BioGrupos {
  destaque: BioLink[]
  largos: BioLink[]
  grade: BioLink[]
}

/** Separa os botões por formato, preservando a ordem recebida. */
export function agrupaPorFormato(links: BioLink[]): BioGrupos {
  return {
    destaque: links.filter((l) => l.formato === 'destaque'),
    largos: links.filter((l) => l.formato === 'largo'),
    grade: links.filter((l) => l.formato === 'grade'),
  }
}
