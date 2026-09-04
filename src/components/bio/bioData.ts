/**
 * Acesso a dados da página pública do bio. O visitante não está logado e as
 * tabelas estão fechadas por RLS: tudo passa pelas duas RPC security definer
 * (get_bio_links e registrar_evento_bio) criadas em
 * supabase/migrations/20260904120000_bio_links.sql.
 *
 * Medição jamais derruba a página — toda gravação é disparada sem espera e
 * com erro engolido, no mesmo espírito do rastreador do site institucional.
 */

import { supabase } from '../../lib/supabase'
import type { BioLink } from './bioLinks'

const SID_KEY = 'bio_sid'
const VISITA_KEY = 'bio_visita'
const MIN_SID = 8

/** Botões visíveis, já filtrados e ordenados pelo banco. */
export async function buscarBioLinks(): Promise<BioLink[]> {
  const { data, error } = await supabase.rpc('get_bio_links')
  if (error) throw error
  return (data ?? []) as unknown as BioLink[]
}

function lerStorage(chave: string): string | null {
  try {
    return localStorage.getItem(chave)
  } catch {
    return null
  }
}

function gravarStorage(chave: string, valor: string): void {
  try {
    localStorage.setItem(chave, valor)
  } catch {
    // Modo privado restrito: segue sem persistir.
  }
}

function novaSessao(): string {
  try {
    return crypto.randomUUID()
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`
  }
}

/** Identificador anônimo desta pessoa, estável entre recarregamentos. */
export function sessaoAtual(): string {
  const guardado = lerStorage(SID_KEY)
  if (guardado && guardado.length >= MIN_SID) return guardado
  const nova = novaSessao()
  gravarStorage(SID_KEY, nova)
  return nova
}

/**
 * Origem de campanha da URL atual, quando houver. Campo ausente vira
 * `undefined` (e não `null`) porque é assim que a chamada de função aceita
 * parâmetro opcional.
 */
function utmDaUrl(busca: string): {
  p_source?: string
  p_medium?: string
  p_campaign?: string
} {
  const query = new URLSearchParams(busca)
  return {
    p_source: query.get('utm_source') ?? undefined,
    p_medium: query.get('utm_medium') ?? undefined,
    p_campaign: query.get('utm_campaign') ?? undefined,
  }
}

function enviar(
  tipo: 'visita' | 'clique',
  sessao: string,
  linkId: string | null
): void {
  try {
    void supabase
      .rpc('registrar_evento_bio', {
        p_tipo: tipo,
        p_sessao: sessao,
        p_link_id: linkId ?? undefined,
        ...utmDaUrl(window.location.search),
      })
      .then(
        () => undefined,
        () => undefined
      )
  } catch {
    // Medição jamais derruba a página.
  }
}

/** Registra a visita uma vez por sessão, mesmo com recarregamentos. */
export function registrarVisita(): void {
  const sessao = sessaoAtual()
  if (lerStorage(VISITA_KEY) === sessao) return
  gravarStorage(VISITA_KEY, sessao)
  enviar('visita', sessao, null)
}

/** Registra o clique num botão. Nunca bloqueia a navegação. */
export function registrarClique(linkId: string): void {
  enviar('clique', sessaoAtual(), linkId)
}
