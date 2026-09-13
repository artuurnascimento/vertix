import { useEffect, useState } from 'react'
import { restanteDoVisitanteMs, restanteMs } from './checkoutTotal'

export interface FonteDoCronometro {
  /** Prazo real, ISO absoluto. */
  ate: string | null
  /** Minutos por visitante; quando existe, manda ele. */
  minutos: number | null
  /** Slug do checkout — separa a contagem de uma oferta da de outra no mesmo navegador. */
  slug: string
}

/** Chave que a versão anterior deixava no navegador; só é apagada. */
const PREFIXO_CHAVE_ANTIGA = 'checkout-cronometro:'

/**
 * Instante em que a contagem começa: sempre AGORA. Cada abertura do checkout
 * parte do tempo cheio — nada fica guardado no navegador, então quem viu o
 * 00:00 e voltou depois encontra os minutos inteiros de novo. A versão
 * anterior gravava a primeira abertura no localStorage e, uma vez zerado,
 * o cronômetro nunca mais saía do zero; a chave que ela deixou é apagada
 * aqui para não sobrar lixo.
 */
export function inicioDoVisitante(slug: string, agora: number = Date.now()): number {
  try {
    window.localStorage.removeItem(`${PREFIXO_CHAVE_ANTIGA}${slug}`)
  } catch {
    // sem armazenamento não há o que apagar
  }
  return agora
}

function calcular(fonte: FonteDoCronometro, inicio: number | null): number | null {
  if (fonte.minutos !== null && inicio !== null) {
    return restanteDoVisitanteMs(inicio, fonte.minutos)
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
 * - `minutos`: por visitante. A contagem parte do tempo cheio a cada
 *   abertura da página e, ao zerar, fica em zero (a faixa mostra 00:00
 *   piscando) até a pessoa sair; nunca devolve `null`, e o intervalo para
 *   quando não há mais o que contar.
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
      if (agora === null || agora === 0) window.clearInterval(id)
    }, 1000)

    return () => window.clearInterval(id)
  }, [ate, minutos, slug])

  return restante
}
