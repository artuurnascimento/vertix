import { useEffect, useState } from 'react'

/**
 * "Tem versão nova?" — o app compara o hash embutido no build
 * (`__VERSAO_APP__`) com o `versao.json` que o servidor tem agora. Diferente
 * = saiu deploy depois desta aba abrir. Nada é trocado sozinho: trocar os
 * arquivos debaixo de uma sessão aberta quebra o import da próxima rota
 * (tela branca no meio do trabalho); quem decide a hora é a pessoa, pelo
 * aviso com o botão. Ver vite.config.ts para quem gera o JSON.
 */

export interface VersaoNova {
  versao: string
  data: string
  titulo: string
  itens: string[]
}

const CAMINHO = '/versao.json'
/** De 5 em 5 minutos, e sempre que a aba volta ao foco. */
const INTERVALO_MS = 5 * 60 * 1000

/** Hash desta build; 'dev' fora do build. */
export const VERSAO_ATUAL: string = typeof __VERSAO_APP__ === 'string' ? __VERSAO_APP__ : 'dev'

function lerVersao(bruto: unknown): VersaoNova | null {
  if (typeof bruto !== 'object' || bruto === null) return null
  const r = bruto as Record<string, unknown>
  if (typeof r.versao !== 'string' || r.versao === '') return null
  return {
    versao: r.versao,
    data: typeof r.data === 'string' ? r.data : '',
    titulo: typeof r.titulo === 'string' && r.titulo !== '' ? r.titulo : 'Atualização do sistema',
    itens: Array.isArray(r.itens) ? r.itens.filter((i): i is string => typeof i === 'string') : [],
  }
}

/** A versão publicada agora, ou null se não deu para ler (offline, 404…). */
export async function buscarVersaoPublicada(
  fetchFn: typeof fetch = fetch
): Promise<VersaoNova | null> {
  try {
    const resposta = await fetchFn(CAMINHO, { cache: 'no-store' })
    if (!resposta.ok) return null
    return lerVersao(await resposta.json())
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
      if (ativo && publicada && publicada.versao !== atual) setNova(publicada)
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
