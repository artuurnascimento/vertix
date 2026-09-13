import { lazy, Suspense, useState } from 'react'
import { suportaWebGl2 } from './webgl'

// O shader só entra no bundle de quem abre o painel (o checkout público
// importa outra árvore) e só depois do resto da tela.
const GhostFibers = lazy(() => import('./GhostFibers'))

/** Parâmetros escolhidos no estúdio do React Bits — o visual do painel. */
const FIBRAS = {
  lineColor: '#8036ff',
  glowColor: '#9354ff',
  speed: 0.15,
  scale: 1.83,
  rotation: 15,
  rotationSpeed: 0.25,
  layers: 1,
  waveAmplitude: 0.015,
  waveFrequency: 6,
  waveSpeed: 0.15,
  layerSpeed: -0.09,
  twist: 0.05,
  twistFrequency: 6.4,
  twistSpeed: 1.2,
  lineFrequency: 5,
  lineSpacing: 2,
  lineSharpness: 16,
  glowFalloff: 10,
  glowIntensity: 1.6,
  brightness: 2,
  blueBoost: 1.25,
  vignette: 0.8,
  grain: 0.05,
  lightMode: false,
  dpr: 1,
  fps: 60,
  paused: false,
} as const

/**
 * Fundo fixo do painel: o "Ghost Fibers" cobrindo a viewport inteira, atrás
 * de tudo. Como é `position: fixed; inset: 0`, o canvas segue o tamanho da
 * janela em qualquer proporção — celular em pé, tablet, ultrawide — sem
 * versão por orientação. O próprio componente para de renderizar com a aba
 * oculta, fora da tela ou com `prefers-reduced-motion` (mostra um quadro só).
 */
export default function Atmosfera() {
  const [comShader] = useState(suportaWebGl2)
  return (
    <div className="vx-atmosphere" aria-hidden="true">
      {comShader && (
        <Suspense fallback={null}>
          <GhostFibers {...FIBRAS} />
        </Suspense>
      )}
    </div>
  )
}
