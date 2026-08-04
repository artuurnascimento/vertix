/**
 * Narração via Web Speech API (speechSynthesis) — grátis, roda no aparelho
 * do cliente, sem chamada de rede.
 *
 * Dois cuidados que não são óbvios:
 *   • As vozes carregam de forma assíncrona em alguns navegadores — por isso
 *     o pickVoice espera o evento voiceschanged (com timeout).
 *   • O Chrome corta utterances longas (~15s). Falar sentença a sentença
 *     evita o corte e ainda dá pontos naturais de cancelamento.
 */

export const speechSupported =
  typeof window !== 'undefined' && 'speechSynthesis' in window

const MAX_CHUNK_CHARS = 200
const VOICES_TIMEOUT_MS = 1500

let cachedVoice: SpeechSynthesisVoice | null = null
let voiceResolved = false

function listVoices(): Promise<SpeechSynthesisVoice[]> {
  const synth = window.speechSynthesis
  const now = synth.getVoices()
  if (now.length > 0) return Promise.resolve(now)
  return new Promise((resolve) => {
    const done = () => resolve(synth.getVoices())
    synth.addEventListener('voiceschanged', done, { once: true })
    setTimeout(done, VOICES_TIMEOUT_MS)
  })
}

/** Melhor voz pt-BR disponível no aparelho (null = default do navegador). */
export async function pickPtBrVoice(): Promise<SpeechSynthesisVoice | null> {
  if (voiceResolved) return cachedVoice
  const voices = await listVoices()
  const ptBr = voices.filter((v) => v.lang.replace('_', '-') === 'pt-BR')
  const anyPt = voices.filter((v) => v.lang.toLowerCase().startsWith('pt'))
  cachedVoice =
    ptBr.find((v) => /luciana|google|microsoft/i.test(v.name)) ??
    ptBr[0] ??
    anyPt[0] ??
    null
  voiceResolved = true
  return cachedVoice
}

/**
 * iOS/Safari só autoriza síntese iniciada DENTRO do gesto do usuário — e o
 * primeiro speak real acontece depois de awaits. Chamar isto de forma
 * síncrona no onClick (utterance vazia, volume 0) destrava a sessão de fala
 * para tudo que vier depois.
 */
export function unlockSpeech(): void {
  if (!speechSupported) return
  try {
    const synth = window.speechSynthesis
    const u = new SpeechSynthesisUtterance(' ')
    u.volume = 0
    synth.speak(u)
    synth.resume()
  } catch {
    // melhor sem destravar do que quebrar o clique
  }
}

/** Quebra o texto em sentenças curtas, agrupadas até ~200 caracteres. */
export function splitSentences(text: string): string[] {
  const sentencas = text
    .split(/(?<=[.!?…])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
  const chunks: string[] = []
  let atual = ''
  for (const s of sentencas) {
    if (atual && (atual + ' ' + s).length > MAX_CHUNK_CHARS) {
      chunks.push(atual)
      atual = s
    } else {
      atual = atual ? `${atual} ${s}` : s
    }
  }
  if (atual) chunks.push(atual)
  return chunks
}

/**
 * Fala o texto inteiro; resolve quando terminar ou quando o signal abortar.
 * Abortar cancela a fila do sintetizador na hora.
 */
export async function speakText(
  text: string,
  signal: AbortSignal
): Promise<void> {
  if (!speechSupported || signal.aborted) return
  const synth = window.speechSynthesis
  const voice = await pickPtBrVoice()

  for (const chunk of splitSentences(text)) {
    if (signal.aborted) return
    await new Promise<void>((resolve) => {
      const utterance = new SpeechSynthesisUtterance(chunk)
      utterance.lang = 'pt-BR'
      utterance.rate = 1.03
      if (voice) utterance.voice = voice
      // Watchdog: se onend nunca vier (síntese muda/quebrada), a apresentação
      // vira slideshow temporizado em vez de travar no slide.
      const timeoutMs = 5000 + chunk.length * 130
      let timer: ReturnType<typeof setTimeout>
      const finish = () => {
        clearTimeout(timer)
        signal.removeEventListener('abort', onAbort)
        resolve()
      }
      const onAbort = () => {
        synth.cancel()
        finish()
      }
      timer = setTimeout(finish, timeoutMs)
      utterance.onend = finish
      utterance.onerror = finish
      signal.addEventListener('abort', onAbort, { once: true })
      synth.speak(utterance)
      // iOS às vezes inicia a fila pausada — resume é inócuo nos demais.
      synth.resume()
    })
  }
}

export function pauseSpeech(): void {
  if (speechSupported) window.speechSynthesis.pause()
}

export function resumeSpeech(): void {
  if (speechSupported) window.speechSynthesis.resume()
}

export function cancelSpeech(): void {
  if (speechSupported) window.speechSynthesis.cancel()
}
