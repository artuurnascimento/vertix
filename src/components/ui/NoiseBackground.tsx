import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'

/**
 * Fundo do link de bio: halo violeta, grade fina e grão animado em canvas.
 *
 * O grão é desenhado no tamanho real da janela, sem esticar — esticar um
 * canvas pequeno borra o ruído e o efeito some. A única economia em relação
 * ao original é o teto de área: acima dele o canvas para de crescer e é
 * ampliado, para não desenhar milhões de pixels por quadro num celular.
 */

interface NoiseProps {
  /** Opacidade de cada ponto, 0–255. */
  patternAlpha?: number
  /** Redesenha a cada N quadros. */
  patternRefreshInterval?: number
}

/** ~1.1 MP: cobre telas de celular e notebook sem esticar. */
const MAX_PIXELS = 1_100_000

function Noise({ patternAlpha = 22, patternRefreshInterval = 2 }: NoiseProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const prefersReducedMotion = useReducedMotion()

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d', { alpha: true })
    if (!ctx) return

    let imageData: ImageData
    let quadro = 0
    let id = 0

    const dimensionar = () => {
      const largura = window.innerWidth
      const altura = window.innerHeight
      const escala = Math.min(1, Math.sqrt(MAX_PIXELS / (largura * altura)))
      canvas.width = Math.max(1, Math.round(largura * escala))
      canvas.height = Math.max(1, Math.round(altura * escala))
      imageData = ctx.createImageData(canvas.width, canvas.height)
    }

    const desenhar = () => {
      const data = imageData.data
      for (let i = 0; i < data.length; i += 4) {
        const valor = Math.random() * 255
        data[i] = valor
        data[i + 1] = valor
        data[i + 2] = valor
        data[i + 3] = patternAlpha
      }
      ctx.putImageData(imageData, 0, 0)
    }

    const aoRedimensionar = () => {
      dimensionar()
      desenhar()
    }

    dimensionar()

    // Quem pediu menos movimento recebe um quadro estático, não a animação.
    if (prefersReducedMotion) {
      desenhar()
      window.addEventListener('resize', aoRedimensionar)
      return () => window.removeEventListener('resize', aoRedimensionar)
    }

    const loop = () => {
      if (quadro % patternRefreshInterval === 0) desenhar()
      quadro++
      id = window.requestAnimationFrame(loop)
    }
    loop()

    window.addEventListener('resize', aoRedimensionar)
    return () => {
      window.removeEventListener('resize', aoRedimensionar)
      window.cancelAnimationFrame(id)
    }
  }, [patternAlpha, patternRefreshInterval, prefersReducedMotion])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full"
    />
  )
}

interface NoiseBackgroundProps {
  /** Halo violeta atrás do topo da página. */
  halo?: boolean
  /** Grade fina sobre o fundo. */
  grade?: boolean
}

/**
 * Camada z-0, e não o -z-10 do snippet original: aqui o elemento raiz da
 * aplicação tem fundo preto opaco, e um índice negativo joga o efeito para
 * trás dele — some por completo. O conteúdo da página fica acima por vir
 * depois no DOM, com posicionamento próprio.
 */
export default function NoiseBackground({
  halo = true,
  grade = true,
}: NoiseBackgroundProps) {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 bg-bg">
      {halo && (
        <div className="absolute inset-0 bg-[radial-gradient(circle_600px_at_50%_180px,rgba(108,91,242,0.38),transparent_70%)]" />
      )}
      {grade && (
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#8a8a8229_1px,transparent_1px),linear-gradient(to_bottom,#8a8a8229_1px,transparent_1px)] bg-[size:22px_24px]" />
      )}
      <Noise />
    </div>
  )
}
