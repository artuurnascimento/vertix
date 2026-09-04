import { useEffect, useRef } from 'react'

/**
 * Fundo do link de bio — as mesmas camadas do hero do Vertix Scan
 * (raiox-vertix/web), para as duas superfícies públicas da Vertix parecerem
 * a mesma marca:
 *
 * 1. radial preto no topo virando indigo nas bordas, entrando em escala;
 * 2. atmosfera: glow violeta suave + grade de 44px;
 * 3. feixes de luz roxa atravessando linhas da grade.
 *
 * Uma diferença em relação ao original: lá o fundo é `-z-10` dentro de uma
 * seção com `isolate`. Aqui o elemento raiz da aplicação tem preto opaco, e
 * índice negativo jogaria tudo para trás dele. Por isso a camada é z-0 e o
 * conteúdo da página fica acima por vir depois no DOM.
 */

const GRID = 44
const ROXO = '108, 91, 242'
const ROXO_CLARO = '169, 158, 247'

interface Beam {
  x: number
  y: number
  speed: number
  trail: number
  delay: number
}

function rand(min: number, max: number) {
  return min + Math.random() * (max - min)
}

function criaFeixe(h: number, primeiraVez: boolean): Beam {
  const linhas = Math.max(1, Math.floor(h / GRID) - 1)
  const y = (1 + Math.floor(rand(0, linhas))) * GRID
  const trail = rand(160, 320)
  return {
    x: -trail,
    y,
    speed: rand(650, 1100),
    trail,
    delay: primeiraVez ? rand(0, 2) : rand(0.3, 1.6),
  }
}

/** Feixes de luz percorrendo as linhas da grade (igual ao GridBeams do Scan). */
function GridBeams() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let w = 0
    let h = 0
    let beams: Beam[] = []
    let raf = 0
    let last = 0

    const dpr = Math.min(window.devicePixelRatio || 1, 2)

    const medir = () => {
      const rect = canvas.getBoundingClientRect()
      w = rect.width
      h = rect.height
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const alvo = Math.max(2, Math.min(4, Math.round(h / 450)))
      beams = Array.from({ length: alvo }, () => criaFeixe(h, true))
    }

    const desenha = (b: Beam) => {
      const x0 = b.x - b.trail
      const grad = ctx.createLinearGradient(x0, 0, b.x, 0)
      grad.addColorStop(0, `rgba(${ROXO}, 0)`)
      grad.addColorStop(0.6, `rgba(${ROXO}, 0.5)`)
      grad.addColorStop(0.92, `rgba(${ROXO_CLARO}, 0.9)`)
      grad.addColorStop(1, 'rgba(255, 255, 255, 0.95)')
      ctx.strokeStyle = grad
      ctx.lineWidth = 1.6
      ctx.beginPath()
      ctx.moveTo(x0, b.y)
      ctx.lineTo(b.x, b.y)
      ctx.stroke()

      // Cabeça: brilho roxo com núcleo branco.
      ctx.save()
      ctx.shadowColor = `rgba(${ROXO}, 0.95)`
      ctx.shadowBlur = 14
      ctx.fillStyle = `rgba(${ROXO_CLARO}, 1)`
      ctx.beginPath()
      ctx.arc(b.x, b.y, 1.9, 0, Math.PI * 2)
      ctx.fill()
      ctx.shadowBlur = 5
      ctx.fillStyle = 'rgba(255, 255, 255, 0.95)'
      ctx.beginPath()
      ctx.arc(b.x, b.y, 0.9, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }

    const frame = (ts: number) => {
      raf = requestAnimationFrame(frame)
      if (document.hidden) {
        last = ts
        return
      }
      const dt = Math.min(0.05, (ts - last) / 1000 || 0)
      last = ts
      ctx.clearRect(0, 0, w, h)
      ctx.globalCompositeOperation = 'lighter'
      for (const b of beams) {
        if (b.delay > 0) {
          b.delay -= dt
          continue
        }
        b.x += b.speed * dt
        if (b.x - b.trail > w) {
          Object.assign(b, criaFeixe(h, false))
          continue
        }
        desenha(b)
      }
      ctx.globalCompositeOperation = 'source-over'
    }

    medir()
    const ro = new ResizeObserver(medir)
    ro.observe(canvas)
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full"
    />
  )
}

interface VertixBackgroundProps {
  /** Feixes de luz percorrendo a grade. */
  feixes?: boolean
}

export default function VertixBackground({ feixes = true }: VertixBackgroundProps) {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 bg-bg">
      {/* Radial do hero do Scan: preto no topo, indigo nas bordas. */}
      <div className="vx-bio-fundo absolute inset-0 [background:radial-gradient(125%_125%_at_50%_10%,#0C0C0C_40%,#5546E0_100%)]" />
      {/* Atmosfera do Scan: glow violeta + grade de 44px. */}
      <div className="vx-bio-atmosfera absolute inset-0" />
      {feixes && <GridBeams />}
    </div>
  )
}
