import { useEffect, useState } from 'react'

/**
 * "Tem versão nova?" — o app compara o hash embutido no build
 * (`__VERSAO_APP__`) com o `versao.json` que o servidor tem agora. Diferente
 * = saiu deploy depois desta aba abrir. Nada é trocado sozinho: trocar os
 * arquivos debaixo de uma sessão aberta quebra o import da próxima rota
 * (tela branca no meio do trabalho); quem decide a hora é a pessoa, pelo
 * aviso com o botão. Ver vite.config.ts para quem gera o JSON.
 */

export interface Commit {
  versao: string
  data: string
  assunto: string
}

export interface VersaoPublicada {
  versao: string
  data: string
  historico: Commit[]
}

export interface VersaoNova {
  versao: string
  data: string
  /** O que entrou depois da versão desta aba, já em linguagem de gente. */
  itens: string[]
}

const CAMINHO = '/versao.json'
/** De 5 em 5 minutos, e sempre que a aba volta ao foco. */
const INTERVALO_MS = 5 * 60 * 1000
/** Acima disto a lista vira "…e mais N". */
const MAXIMO_DE_ITENS = 12

/** Hash desta build; 'dev' fora do build. */
export const VERSAO_ATUAL: string = typeof __VERSAO_APP__ === 'string' ? __VERSAO_APP__ : 'dev'

/** Tipos de commit que dizem algo a quem usa o painel; o resto é cozinha. */
const TIPOS_VISIVEIS = new Set(['feat', 'fix', 'style', 'perf', 'revert'])

/** "feat: cards do painel…" → "Cards do painel…"; chore/test/docs ficam de fora. */
export function assuntoLegivel(assunto: string): string | null {
  const m = /^([a-z]+)(\([^)]*\))?!?:\s*(.+)$/i.exec(assunto.trim())
  if (!m) return assunto.trim() || null
  if (!TIPOS_VISIVEIS.has(m[1].toLowerCase())) return null
  const texto = m[3].trim()
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

/**
 * Os itens do aviso: assuntos dos commits mais novos que `atual`. Se `atual`
 * não está no histórico (a aba está atrás de tudo o que o JSON carrega), vale
 * o histórico inteiro — melhor listar demais do que esconder o que mudou.
 */
export function itensDesde(historico: Commit[], atual: string): string[] {
  const posicao = historico.findIndex((c) => c.versao === atual)
  const novos = posicao === -1 ? historico : historico.slice(0, posicao)
  const legiveis = novos.map((c) => assuntoLegivel(c.assunto)).filter((t): t is string => t !== null)
  if (legiveis.length <= MAXIMO_DE_ITENS) return legiveis
  return [...legiveis.slice(0, MAXIMO_DE_ITENS), `…e mais ${legiveis.length - MAXIMO_DE_ITENS}`]
}

function lerPublicada(bruto: unknown): VersaoPublicada | null {
  if (typeof bruto !== 'object' || bruto === null) return null
  const r = bruto as Record<string, unknown>
  if (typeof r.versao !== 'string' || r.versao === '') return null
  const historico = Array.isArray(r.historico)
    ? r.historico.filter(
        (c): c is Commit =>
          typeof c === 'object' && c !== null && typeof (c as Commit).versao === 'string' && typeof (c as Commit).assunto === 'string'
      )
    : []
  return { versao: r.versao, data: typeof r.data === 'string' ? r.data : '', historico }
}

/** A versão publicada agora, ou null se não deu para ler (offline, 404…). */
export async function buscarVersaoPublicada(
  fetchFn: typeof fetch = fetch
): Promise<VersaoPublicada | null> {
  try {
    const resposta = await fetchFn(CAMINHO, { cache: 'no-store' })
    if (!resposta.ok) return null
    return lerPublicada(await resposta.json())
  } catch {
    return null
  }
}

/** A versão nova esperando, ou null enquanto esta aba está na última. */
export function useVersaoNova(atual: string = VERSAO_ATUAL): VersaoNova | null {
  const [nova, setNova] = useState<VersaoNova | null>(null)

  useEffect(() => {
    // Em desenvolvimento o hash é sempre 'dev' e não há deploy para comparar.
    if (atual === 'dev') return
    let ativo = true
    const conferir = async () => {
      const publicada = await buscarVersaoPublicada()
      if (!ativo || !publicada || publicada.versao === atual) return
      setNova({
        versao: publicada.versao,
        data: publicada.data,
        itens: itensDesde(publicada.historico, atual),
      })
    }
    const aoVoltar = () => {
      if (document.visibilityState === 'visible') void conferir()
    }
    void conferir()
    const id = window.setInterval(() => void conferir(), INTERVALO_MS)
    document.addEventListener('visibilitychange', aoVoltar)
    return () => {
      ativo = false
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', aoVoltar)
    }
  }, [atual])

  return nova
}
