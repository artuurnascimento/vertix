/**
 * Player das narrações MP3 pré-geradas (voz neural via Edge TTS, hospedadas
 * no Supabase Storage). Voz muito mais natural que o sintetizador do
 * navegador — e imune às pegadinhas do speechSynthesis no iOS.
 *
 * iOS só deixa `audio.play()` funcionar se o PRIMEIRO play veio de um gesto
 * do usuário. Por isso existe um único elemento compartilhado, destravado de
 * forma síncrona no onClick (unlockAudio) e reaproveitado trocando o src.
 */

let sharedAudio: HTMLAudioElement | null = null

function getAudio(): HTMLAudioElement {
  if (!sharedAudio) sharedAudio = new Audio()
  return sharedAudio
}

/** WAV de ~1 amostra silenciosa — só para consumir o gesto e destravar. */
const SILENT_WAV =
  'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA='

/** Chamar de forma SÍNCRONA dentro do onClick que inicia a apresentação. */
export function unlockAudio(): void {
  try {
    const el = getAudio()
    el.src = SILENT_WAV
    void el.play().catch(() => undefined)
  } catch {
    // sem destravar, o playAudio falha e o chamador cai no sintetizador
  }
}

const METADATA_TIMEOUT_MS = 15000
const ENDED_GRACE_MS = 15000

/**
 * Toca a URL até o fim. Resolve `true` quando terminou (ou foi abortado) e
 * `false` quando a reprodução falhou — aí o chamador usa o fallback (TTS).
 */
export function playAudio(url: string, signal: AbortSignal): Promise<boolean> {
  if (signal.aborted) return Promise.resolve(true)
  const el = getAudio()
  return new Promise((resolve) => {
    let settled = false
    let timer: ReturnType<typeof setTimeout>
    const finish = (ok: boolean) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      el.removeEventListener('ended', onEnded)
      el.removeEventListener('error', onError)
      el.removeEventListener('loadedmetadata', onMetadata)
      signal.removeEventListener('abort', onAbort)
      resolve(ok)
    }
    const onEnded = () => finish(true)
    const onError = () => finish(false)
    const onAbort = () => {
      el.pause()
      finish(true)
    }
    // Watchdog em duas fases: se nem o metadata chegar, cai pro fallback; com
    // a duração conhecida, o limite vira duração + folga (rede lenta ≠ travar).
    const onMetadata = () => {
      clearTimeout(timer)
      const durMs = Number.isFinite(el.duration) ? el.duration * 1000 : 60000
      timer = setTimeout(() => finish(true), durMs + ENDED_GRACE_MS)
    }
    timer = setTimeout(() => finish(false), METADATA_TIMEOUT_MS)
    el.addEventListener('ended', onEnded)
    el.addEventListener('error', onError)
    el.addEventListener('loadedmetadata', onMetadata)
    signal.addEventListener('abort', onAbort, { once: true })
    el.src = url
    void el.play().catch(() => finish(false))
  })
}

export function pauseAudio(): void {
  sharedAudio?.pause()
}

export function resumeAudio(): void {
  void sharedAudio?.play().catch(() => undefined)
}

export function stopAudio(): void {
  if (!sharedAudio) return
  sharedAudio.pause()
  sharedAudio.removeAttribute('src')
}
