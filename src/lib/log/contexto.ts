/**
 * O contexto que vai junto de cada entrada de log do navegador: onde a
 * pessoa estava, em que aparelho, em qual versão do app, há quanto tempo,
 * e o que fez antes (migalhas). É o que transforma "TypeError em x" em algo
 * que dá para reproduzir.
 *
 * Sem dado pessoal: a URL sai com os tokens ocultos, e a sessão do rastreio
 * é um uuid opaco que só o painel Ao vivo sabe ligar a alguém.
 */

import { PREFIXO_SESSAO } from '../../components/checkout/rastreio/sessao'
import type { Migalha } from './migalhas'

/** Parâmetros de URL que identificam alguém ou pré-preenchem dados. */
const PARAMETROS_SENSIVEIS = /^(t|token|token_compra|email|whatsapp|nome|senha|code|access_token|refresh_token)$/i

/** Caminho + busca, com os valores sensíveis trocados por [oculto]. */
export function redigirUrl(url: string): string {
  try {
    const u = new URL(url, 'http://x')
    for (const chave of Array.from(u.searchParams.keys())) {
      if (PARAMETROS_SENSIVEIS.test(chave)) u.searchParams.set(chave, '[oculto]')
    }
    // Segmento de token na raiz (pay.vertix.studio/<token>): oculto também.
    const caminho = u.pathname.replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?=\/|$)/gi, '/[uuid]')
    return caminho + (u.search ? u.search : '')
  } catch {
    return url.slice(0, 200)
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** A sessão do rastreio do checkout aberta nesta aba, se houver. */
export function sessaoDeRastreioAtual(armazem: Storage | null): string | null {
  try {
    if (!armazem) return null
    for (let i = 0; i < armazem.length; i++) {
      const chave = armazem.key(i)
      if (!chave || !chave.startsWith(PREFIXO_SESSAO)) continue
      const valor = armazem.getItem(chave)
      if (valor && UUID.test(valor)) return valor
    }
  } catch {
    // storage bloqueado
  }
  return null
}

export interface FontesDoContexto {
  janela: Pick<Window, 'location' | 'innerWidth' | 'innerHeight' | 'devicePixelRatio'>
  navegador: Pick<Navigator, 'userAgent' | 'onLine' | 'language' | 'maxTouchPoints'>
  documento: Pick<Document, 'referrer' | 'visibilityState'>
  aba: string
  usuarioId: string | null
  migalhas: () => Migalha[]
  /** ms desde o carregamento. */
  relogio: () => number
  memoriaMb?: () => number | null
}

export function montarContexto(f: FontesDoContexto): Record<string, unknown> {
  const contexto: Record<string, unknown> = {
    rota: redigirUrl(f.janela.location.pathname + f.janela.location.search),
    host: f.janela.location.hostname,
    nav: f.aba,
    agente: f.navegador.userAgent.slice(0, 200),
    viewport: `${f.janela.innerWidth}x${f.janela.innerHeight}`,
    pixel_ratio: Math.round((f.janela.devicePixelRatio || 1) * 100) / 100,
    toque: f.navegador.maxTouchPoints > 0,
    online: f.navegador.onLine,
    idioma: f.navegador.language,
    visivel: f.documento.visibilityState === 'visible',
    tempo_na_pagina_s: Math.round(f.relogio() / 1000),
    migalhas: f.migalhas(),
  }
  const referrer = f.documento.referrer
  if (referrer) contexto.referrer = redigirUrl(referrer).slice(0, 200)
  if (f.usuarioId) contexto.usuario = f.usuarioId
  const memoria = f.memoriaMb?.()
  if (memoria) contexto.memoria_mb = memoria
  return contexto
}

/** `performance.memory` só existe no Chrome; nos outros, null. */
export function memoriaUsadaMb(): number | null {
  const p = performance as Performance & { memory?: { usedJSHeapSize: number } }
  const usada = p.memory?.usedJSHeapSize
  return typeof usada === 'number' ? Math.round(usada / 1048576) : null
}
