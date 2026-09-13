import { useEffect, useState } from 'react'
import { restanteEmLoopMs, restanteMs } from './checkoutTotal'

export interface FonteDoCronometro {
  /** Prazo real, ISO absoluto. */
  ate: string | null
  /** Minutos por visitante; quando existe, manda ele. */
  minutos: number | null
  /** Slug do checkout — separa a contagem de uma oferta da de outra no mesmo navegador. */
  slug: string
}

const PREFIXO_CHAVE = 'checkout-cronometro:'

/**
 * Instante em que ESTE navegador abriu a oferta pela primeira vez. Fica no
 * localStorage para recarregar a página não zerar a contagem — o loop só
 * recomeça quando o ciclo termina, não a cada F5. Sem armazenamento (modo
 * privado, bloqueio), a contagem começa agora e recomeça a cada abertura; é o
 * melhor que dá sem guardar nada.
 */
export function inicioDoVisitante(slug: string, agora: number = Date.now()): number {
  const chave = `${PREFIXO_CHAVE}${slug}`
  try {
    const guardado = Number(window.localStorage.getItem(chave))
    if (Number.isFinite(guardado) && guardado > 0 && guardado <= agora) return guardado
    window.localStorage.setItem(chave, String(agora))
  } catch {
    // sem armazenamento: segue com "agora"
  }
  return agora
}

function calcular(fonte: FonteDoCronometro, inicio: number | null): number | null {
  if (fonte.minutos !== null && inicio !== null) {
    return restanteEmLoopMs(inicio, fonte.minutos)
  }
  return restanteMs(fonte.ate)
}

/**
 * Tempo restante do cronômetro, atualizado a cada segundo.
 *
 * Dois modos, decididos pelo dono da oferta no painel:
 *
 * - `ate`: prazo real. Devolve `null` quando não há prazo, quando a data é
 *   inválida ou quando ele já passou — e para o intervalo nesse momento. O
 *   relógio é o do servidor materializado num instante ISO absoluto: nada
 *   aqui "recomeça" quando alguém recarrega a página.
 * - `minutos`: por visitante. A contagem parte da primeira abertura neste
 *   navegador e recomeça ao zerar, então nunca devolve `null`.
 */
export function useCronometro(fonte: FonteDoCronometro): number | null {
  const { ate, minutos, slug } = fonte
  const [inicio, setInicio] = useState<number | null>(() =>
    minutos !== null ? inicioDoVisitante(slug) : null
  )
  const [restante, setRestante] = useState(() => calcular(fonte, inicio))

  useEffect(() => {
    const inicioAtual = minutos !== null ? inicioDoVisitante(slug) : null
    setInicio(inicioAtual)
    const proximo = { ate, minutos, slug }
    setRestante(calcular(proximo, inicioAtual))
    if (ate === null && minutos === null) return

    const id = window.setInterval(() => {
      const agora = calcular(proximo, inicioAtual)
      setRestante(agora)
      if (agora === null) window.clearInterval(id)
    }, 1000)

    return () => window.clearInterval(id)
  }, [ate, minutos, slug])

  return restante
}
