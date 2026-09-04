import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'

/**
 * Botão com líquido violeta dentro, desenhado em WebGL. Portado do snippet
 * "tactile button": lá o efeito vivia num iframe com Tailwind, GSAP e ícones
 * carregados de CDNs, o que a CSP do painel bloqueia e que engoliria o clique
 * do card. Aqui é só um canvas inline com o mesmo shader, recolorido para a
 * paleta da marca.
 *
 * Interação: passar o mouse balança o líquido e inclina a superfície; clicar
 * faz ele "engolir" um gole. Sem WebGL, cai num degradê CSS equivalente.
 * Pausa fora da tela e com a aba oculta; com menos movimento no sistema,
 * desenha um único quadro parado.
 *
 * É um <span>, não um <button>: mora dentro do <a> do card, que é o link.
 */

interface LiquidButtonProps {
  children: ReactNode
  className?: string
}

const VS = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}'

// Cores: fundo violeta-escuro, líquido lilás na superfície e indigo no fundo.
const FS = [
  'precision highp float;',
  'uniform vec2 u_res;',
  'uniform float u_time;',
  'uniform float u_level;',
  'uniform float u_tilt;',
  'uniform float u_slosh;',
  'float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}',
  'float noise(vec2 p){',
  '  vec2 i=floor(p), f=fract(p);',
  '  vec2 u=f*f*(3.0-2.0*f);',
  '  return mix(mix(hash(i),hash(i+vec2(1.,0.)),u.x),',
  '             mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),u.x),u.y);',
  '}',
  'float fbm(vec2 p){',
  '  float v=0.0; float a=0.5;',
  '  for(int i=0;i<4;i++){ v+=a*noise(p); p=p*2.04+vec2(11.3,7.1); a*=0.5; }',
  '  return v;',
  '}',
  'void main(){',
  '  vec2 uv = gl_FragCoord.xy / u_res;',
  '  float ar = u_res.x / u_res.y;',
  '  float x = uv.x * ar;',
  '  float t = u_time;',
  '  float amp = 0.012 + u_slosh * 0.045;',
  '  float surf = u_level',
  '    + u_tilt * (uv.x - 0.5) * 0.34',
  '    + amp * sin(x * 5.1 + t * 4.6)',
  '    + amp * 0.62 * sin(x * 9.7 + t * (-6.8) + 1.7)',
  '    + amp * 0.38 * sin(x * 14.3 + t * 8.9 + 4.2);',
  '  float d = surf - uv.y;',
  '  vec3 col = mix(vec3(0.05, 0.04, 0.11), vec3(0.10, 0.08, 0.20), uv.y);',
  '  col += vec3(0.09, 0.07, 0.20) * pow(max(0.0, 1.0 - abs(uv.y - 0.88) * 6.0), 2.0);',
  '  float inside = smoothstep(0.0, 0.012, d);',
  '  float depth = clamp(d / max(u_level, 0.001), 0.0, 1.0);',
  '  vec3 liq = mix(vec3(0.72, 0.66, 1.0), vec3(0.15, 0.10, 0.40), depth);',
  '  float caust = fbm(vec2(x * 4.2, (uv.y + t * 0.14) * 4.2));',
  '  liq *= 0.8 + 0.42 * caust;',
  '  liq += vec3(0.28, 0.20, 0.60) * pow(max(0.0, d * 3.0), 1.5) * u_slosh;',
  '  col = mix(col, liq, inside);',
  '  col += vec3(0.75, 0.68, 1.0) * exp(-abs(d) * 80.0) * 0.85;',
  '  col += vec3(0.93, 0.90, 1.0) * exp(-abs(d) * 220.0) * 0.5;',
  '  vec2 e = uv * (1.0 - uv);',
  '  col *= 0.55 + 0.45 * pow(e.x * e.y * 16.0, 0.22);',
  '  gl_FragColor = vec4(col, 1.0);',
  '}',
].join('\n')

const NIVEL_BASE = 0.56

export default function LiquidButton({ children, className = '' }: LiquidButtonProps) {
  const wrapRef = useRef<HTMLSpanElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const wrap = wrapRef.current
    const canvas = canvasRef.current
    if (!wrap || !canvas) return

    const gl = canvas.getContext('webgl')
    if (!gl) {
      // Sem WebGL: o degradê CSS de reserva (vx-liquid-btn--css) assume.
      wrap.classList.add('vx-liquid-btn--css')
      canvas.style.display = 'none'
      return
    }

    const reduzido = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const compile = (tipo: number, src: string) => {
      const s = gl.createShader(tipo)
      if (!s) return null
      gl.shaderSource(s, src)
      gl.compileShader(s)
      return s
    }
    const vs = compile(gl.VERTEX_SHADER, VS)
    const fs = compile(gl.FRAGMENT_SHADER, FS)
    const prog = gl.createProgram()
    if (!vs || !fs || !prog) return
    gl.attachShader(prog, vs)
    gl.attachShader(prog, fs)
    gl.linkProgram(prog)
    gl.useProgram(prog)

    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const locP = gl.getAttribLocation(prog, 'p')
    gl.enableVertexAttribArray(locP)
    gl.vertexAttribPointer(locP, 2, gl.FLOAT, false, 0, 0)

    const uRes = gl.getUniformLocation(prog, 'u_res')
    const uTime = gl.getUniformLocation(prog, 'u_time')
    const uLevel = gl.getUniformLocation(prog, 'u_level')
    const uTilt = gl.getUniformLocation(prog, 'u_tilt')
    const uSlosh = gl.getUniformLocation(prog, 'u_slosh')

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const redimensionar = () => {
      const w = Math.max(1, Math.round(canvas.clientWidth * dpr))
      const h = Math.max(1, Math.round(canvas.clientHeight * dpr))
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
        gl.viewport(0, 0, w, h)
      }
    }

    let nivel = NIVEL_BASE
    let gole = 0
    let balanco = 0.4
    let inclinacao = 0
    let inclinacaoAlvo = 0
    let ultimoX: number | null = null
    let ultimo = performance.now()
    let visivel = true
    let raf = 0

    const desenhar = (agora: number) => {
      redimensionar()
      gl.uniform2f(uRes, canvas.width, canvas.height)
      gl.uniform1f(uTime, reduzido ? 2.0 : agora / 1000)
      gl.uniform1f(uLevel, nivel)
      gl.uniform1f(uTilt, inclinacao)
      gl.uniform1f(uSlosh, reduzido ? 0.25 : balanco)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    }

    const quadro = (agora: number) => {
      raf = requestAnimationFrame(quadro)
      if (!visivel || document.hidden) {
        ultimo = agora
        return
      }
      const dt = Math.min(0.05, (agora - ultimo) / 1000)
      ultimo = agora
      balanco *= Math.exp(-1.5 * dt)
      gole *= Math.exp(-1.1 * dt)
      inclinacao += (inclinacaoAlvo - inclinacao) * Math.min(1, dt * 5)
      const nivelAlvo = NIVEL_BASE - 0.36 * gole
      nivel += (nivelAlvo - nivel) * Math.min(1, dt * 5.5)
      desenhar(agora)
    }

    const aoMover = (e: MouseEvent) => {
      const r = wrap.getBoundingClientRect()
      const x = (e.clientX - r.left) / Math.max(1, r.width)
      if (ultimoX !== null) balanco = Math.min(1.4, balanco + Math.abs(x - ultimoX) * 2.6)
      ultimoX = x
      inclinacaoAlvo = Math.max(-1, Math.min(1, (x - 0.5) * 2))
    }
    const aoSair = () => {
      ultimoX = null
      inclinacaoAlvo = 0
    }
    const aoClicar = () => {
      gole = 1
      balanco = Math.min(1.4, balanco + 0.7)
    }

    wrap.addEventListener('mousemove', aoMover)
    wrap.addEventListener('mouseleave', aoSair)
    wrap.addEventListener('click', aoClicar)

    // Fora da tela não desenha: economia de bateria no celular.
    const io = new IntersectionObserver(([entrada]) => {
      visivel = entrada.isIntersecting
    })
    io.observe(canvas)

    if (reduzido) {
      // Um único quadro parado.
      desenhar(performance.now())
    } else {
      raf = requestAnimationFrame(quadro)
    }

    return () => {
      cancelAnimationFrame(raf)
      io.disconnect()
      wrap.removeEventListener('mousemove', aoMover)
      wrap.removeEventListener('mouseleave', aoSair)
      wrap.removeEventListener('click', aoClicar)
    }
  }, [])

  return (
    <span
      ref={wrapRef}
      className={`vx-liquid-btn relative block overflow-hidden rounded-2xl ${className}`}
    >
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 block h-full w-full"
      />
      <span className="relative z-10 flex h-full items-center justify-center gap-2 px-4">
        {children}
      </span>
    </span>
  )
}
