import { lazy, Suspense, useState } from 'react'
import { suportaWebGl } from './webgl'

// O shader só entra no bundle de quem abre o painel (o checkout público
// importa outra árvore) e só depois do resto da tela.
const DarkVeil = lazy(() => import('./DarkVeil'))

/** Parâmetros escolhidos no estúdio do React Bits — o visual do painel. */
const VEU = {
  hueShift: -10,
  noiseIntensity: 0,
  scanlineIntensity: 0.05,
  speed: 0.3,
  scanlineFrequency: 0,
  warpAmount: 0.1,
  resolutionScale: 1.25,
} as const

/**
 * Fundo fixo do painel: o "Dark Veil" cobrindo a viewport inteira, atrás de
 * tudo. Como é `position: fixed; inset: 0`, o canvas segue o tamanho da
 * janela em qualquer proporção — celular em pé, tablet, ultrawide — sem
 * versão por orientação. Com a aba oculta o navegador congela o
 * requestAnimationFrame, então o shader não gasta nada em segundo plano.
 */
export default function Atmosfera() {
  const [comShader] = useState(suportaWebGl)
  return (
    <div className="vx-atmosphere" aria-hidden="true">
      {comShader && (
        <Suspense fallback={null}>
          <DarkVeil {...VEU} />
        </Suspense>
      )}
    </div>
  )
}
