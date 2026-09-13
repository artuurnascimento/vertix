import { useEffect, useRef, useState } from 'react'

const DURACAO_PADRAO_MS = 900

/** Quem pediu menos movimento vê o número pronto; no jsdom não há matchMedia. */
function animar(): boolean {
  return typeof window.matchMedia === 'function'
    ? !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false
}

/**
 * Número que "conta" até o alvo — de zero na primeira montagem, e do valor
 * atual quando o alvo muda (o dado atualizou em segundo plano). Curva
 * ease-out cúbica: acelera no começo e assenta devagar no valor final, que
 * é sempre exato — o último quadro grava o alvo, não uma aproximação.
 */
export function useContagem(alvo: number, duracaoMs = DURACAO_PADRAO_MS): number {
  const [valor, setValor] = useState(() => (animar() ? 0 : alvo))
  const atual = useRef(valor)

  useEffect(() => {
    const de = atual.current
    if (de === alvo || !animar()) {
      atual.current = alvo
      setValor(alvo)
      return
    }
    const inicio = performance.now()
    let quadro = requestAnimationFrame(function passo(agora) {
      const t = Math.min((agora - inicio) / duracaoMs, 1)
      const suave = 1 - (1 - t) ** 3
      const proximo = t < 1 ? de + (alvo - de) * suave : alvo
      atual.current = proximo
      setValor(proximo)
      if (t < 1) quadro = requestAnimationFrame(passo)
    })
    return () => cancelAnimationFrame(quadro)
  }, [alvo, duracaoMs])

  return valor
}
