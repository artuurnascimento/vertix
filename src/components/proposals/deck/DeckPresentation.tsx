import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import {
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  X,
} from 'lucide-react'
import {
  cancelSpeech,
  pauseSpeech,
  resumeSpeech,
  speakText,
} from '../../../lib/speech'
import {
  pauseAudio,
  playAudio,
  resumeAudio,
  stopAudio,
} from '../../../lib/narrationAudio'
import type { NarrationTrack } from './deckData'

interface DeckPresentationProps {
  /** Trilhas na ordem das seções .slide do deck (slides + aprovação). */
  tracks: NarrationTrack[]
  onExit: () => void
}

const STOPWORDS = new Set([
  'para', 'como', 'mais', 'isso', 'esse', 'essa', 'pelo', 'pela', 'cada',
  'quando', 'vocês', 'voces', 'todos', 'toda', 'tudo', 'aqui', 'ainda',
  'sobre', 'entre', 'depois', 'antes', 'então', 'entao', 'reais',
])

/** Palavras significativas (≥4 letras, sem pontuação) de um trecho. */
function tokeniza(texto: string): Set<string> {
  return new Set(
    texto
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((p) => p.length >= 4 && !STOPWORDS.has(p))
  )
}

/**
 * Modo apresentação: não re-renderiza nada — rola a própria página até o
 * slide da vez, destaca-o (CSS .vdk-presenting) e narra o roteiro. Ao fim da
 * fala de cada seção, avança sozinho. Controles flutuantes embaixo.
 */
export default function DeckPresentation({
  tracks,
  onExit,
}: DeckPresentationProps) {
  const [idx, setIdx] = useState(0)
  const [paused, setPaused] = useState(false)
  const nodesRef = useRef<HTMLElement[]>([])
  const abortRef = useRef<AbortController | null>(null)
  // Cada playFrom incrementa o run; loops antigos percebem e morrem em paz.
  const runRef = useRef(0)
  // Espelho de `paused` legível de dentro do loop async (evita closure velha).
  const pausedRef = useRef(false)
  // Blocos de texto do slide atual + qual está marcado como "sendo lido".
  const candidatosRef = useRef<{ el: HTMLElement; tokens: Set<string> }[]>([])
  const lendoRef = useRef<HTMLElement | null>(null)
  const total = tracks.length

  const highlight = (i: number) => {
    nodesRef.current.forEach((node, n) =>
      node.classList.toggle('vdk-current', n === i)
    )
    nodesRef.current[i]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    // Recolhe os blocos de texto do slide da vez p/ o marcador de leitura.
    limpaLeitura()
    const slide = nodesRef.current[i]
    candidatosRef.current = slide
      ? Array.from(
          slide.querySelectorAll<HTMLElement>(
            'h1, h2, h3, p, li, .bar-row, .callout'
          )
        )
          .filter(
            (el) =>
              !el.closest('.s-foot') && (el.textContent ?? '').trim().length >= 8
          )
          .map((el) => ({ el, tokens: tokeniza(el.textContent ?? '') }))
      : []
  }

  const limpaLeitura = () => {
    lendoRef.current?.classList.remove('vdk-reading')
    lendoRef.current = null
  }

  const marcaBloco = (el: HTMLElement | null) => {
    if (!el || el === lendoRef.current) return
    lendoRef.current?.classList.remove('vdk-reading')
    el.classList.add('vdk-reading')
    lendoRef.current = el
  }

  /**
   * A narração é um roteiro de vendedor, não o texto literal do slide — então
   * o trecho falado é casado com o bloco de texto que mais compartilha
   * palavras com ele, e esse bloco ganha o marcador visual.
   */
  const marcaLeitura = (trechoFalado: string) => {
    const palavras = tokeniza(trechoFalado)
    if (palavras.size === 0) return
    let melhor: HTMLElement | null = null
    let melhorScore = 0
    for (const cand of candidatosRef.current) {
      let score = 0
      palavras.forEach((p) => {
        if (cand.tokens.has(p)) score++
      })
      if (score > melhorScore) {
        melhorScore = score
        melhor = cand.el
      }
    }
    // Sem casamento razoável, mantém o marcador onde está (não pisca à toa).
    if (!melhor || melhorScore < 2 || melhor === lendoRef.current) return
    lendoRef.current?.classList.remove('vdk-reading')
    melhor.classList.add('vdk-reading')
    lendoRef.current = melhor
  }

  // Se o usuário pausou bem na troca de seção, segura aqui até retomar —
  // senão a narração do próximo slide começa "por baixo" da pausa.
  const esperaRetomar = async (run: number) => {
    while (pausedRef.current && run === runRef.current) {
      await new Promise((r) => setTimeout(r, 200))
    }
  }

  const playFrom = async (start: number) => {
    const run = ++runRef.current
    abortRef.current?.abort()
    cancelSpeech()
    stopAudio()
    pausedRef.current = false
    setPaused(false)
    for (let i = start; i < total && i < nodesRef.current.length; i++) {
      await esperaRetomar(run)
      if (run !== runRef.current) return
      setIdx(i)
      highlight(i)
      const ctrl = new AbortController()
      abortRef.current = ctrl
      const track = tracks[i]
      const cues = track.legenda
      // Sincronia em tempo real: o cue da posição atual do MP3 aponta qual
      // bloco de texto do slide deve estar marcado como "sendo lido".
      const onTime = cues?.length
        ? (ms: number) => {
            let atual: (typeof cues)[number] | null = null
            for (const cue of cues) {
              if (cue.i <= ms) atual = cue
              else break
            }
            if (!atual) return
            // Mapeamento autorado (exato) quando o cue traz o índice do
            // bloco; casamento por palavras só como fallback.
            if (atual.b !== undefined) {
              marcaBloco(candidatosRef.current[atual.b]?.el ?? null)
            } else {
              marcaLeitura(atual.t)
            }
          }
        : undefined
      // Voz neural pré-gerada quando existe; sintetizador só como fallback.
      const tocou = track.audio
        ? await playAudio(track.audio, ctrl.signal, onTime)
        : false
      if (!tocou && !ctrl.signal.aborted) {
        await speakText(track.texto, ctrl.signal, marcaLeitura)
      }
      if (run !== runRef.current || ctrl.signal.aborted) return
    }
    if (run === runRef.current) exit()
  }

  const exit = () => {
    runRef.current++
    abortRef.current?.abort()
    cancelSpeech()
    stopAudio()
    limpaLeitura()
    document.querySelector('.vdk')?.classList.remove('vdk-presenting')
    nodesRef.current.forEach((node) => node.classList.remove('vdk-current'))
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => undefined)
    }
    onExit()
  }

  const togglePause = () => {
    // Pausar/retomar os dois canais é inócuo no que estiver ocioso.
    if (paused) {
      resumeSpeech()
      resumeAudio()
    } else {
      pauseSpeech()
      pauseAudio()
    }
    pausedRef.current = !paused
    setPaused(!paused)
  }

  const go = (delta: number) => {
    const alvo = Math.min(total - 1, Math.max(0, idx + delta))
    void playFrom(alvo)
  }

  useEffect(() => {
    const root = document.querySelector('.vdk')
    nodesRef.current = Array.from(
      document.querySelectorAll<HTMLElement>('.vdk .slide')
    ).slice(0, total)
    root?.classList.add('vdk-presenting')
    // Tela cheia é cortesia — iPhone não suporta e a apresentação segue igual.
    void document.documentElement.requestFullscreen?.().catch(() => undefined)
    void playFrom(0)

    return () => {
      runRef.current++
      abortRef.current?.abort()
      cancelSpeech()
      stopAudio()
      lendoRef.current?.classList.remove('vdk-reading')
      root?.classList.remove('vdk-presenting')
      nodesRef.current.forEach((node) => node.classList.remove('vdk-current'))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed inset-x-0 bottom-5 z-50 flex justify-center px-4 font-kanit"
    >
      <div
        role="toolbar"
        aria-label="Controles da apresentação"
        className="flex items-center gap-1 rounded-full border border-white/10 bg-[#151515]/95 px-3 py-2 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.8)] backdrop-blur"
      >
        <button
          type="button"
          onClick={() => go(-1)}
          disabled={idx === 0}
          aria-label="Slide anterior"
          className="rounded-full p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-30"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={togglePause}
          aria-label={paused ? 'Retomar narração' : 'Pausar narração'}
          className="rounded-full bg-accent p-2.5 text-white transition-colors hover:bg-accent-2"
        >
          {paused ? (
            <Play className="h-4 w-4" />
          ) : (
            <Pause className="h-4 w-4" />
          )}
        </button>
        <button
          type="button"
          onClick={() => go(1)}
          disabled={idx >= total - 1}
          aria-label="Próximo slide"
          className="rounded-full p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-30"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <span className="px-2 text-xs font-medium tabular-nums text-white/60">
          {idx + 1} / {total}
        </span>
        <button
          type="button"
          onClick={exit}
          aria-label="Encerrar apresentação"
          className="rounded-full p-2 text-white/70 transition-colors hover:bg-red-500/20 hover:text-red-300"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </motion.div>
  )
}
