import { useEffect, useState } from 'react'
import { restanteMs } from './checkoutTotal'

/**
 * Tempo restante até `ate`, atualizado a cada segundo. Devolve `null` quando
 * não há prazo, quando a data é inválida ou quando o prazo já passou — e para
 * o intervalo nesse momento, para não ficar acordando o navegador à toa.
 *
 * O relógio é o do servidor materializado num instante ISO absoluto: nada aqui
 * "recomeça" a contagem quando alguém recarrega a página.
 */
export function useCronometro(ate: string | null): number | null {
  const [restante, setRestante] = useState(() => restanteMs(ate))

  useEffect(() => {
    setRestante(restanteMs(ate))
    if (ate === null) return

    const id = window.setInterval(() => {
      const agora = restanteMs(ate)
      setRestante(agora)
      if (agora === null) window.clearInterval(id)
    }, 1000)

    return () => window.clearInterval(id)
  }, [ate])

  return restante
}
