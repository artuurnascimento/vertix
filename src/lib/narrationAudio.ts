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
 * `onTime` recebe a posição em ms (~4x/s) para sincronizar legendas.
 */
export function playAudio(
  url: string,
  signal: AbortSignal,
  onTime?: (ms: number) => void
): Promise<boolean> {
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
      el.removeEventListener('pause', onPause)
      el.removeEventListener('play', onPlay)
      el.removeEventListener('timeupdate', onTimeUpdate)
      signal.removeEventListener('abort', onAbort)
      resolve(ok)
    }
    const onEnded = () => finish(true)
    const onError = () => finish(false)
    const onAbort = () => {
      el.pause()
      finish(true)
    }
    const onTimeUpdate = () => onTime?.(el.currentTime * 1000)
    // Watchdog: sem metadata em 15s → fallback; com duração conhecida, o
    // limite é o que FALTA tocar + folga. Pausar o áudio pausa o watchdog
    // também — senão o timer estoura no meio da pausa e avança o slide.
    const armWatchdog = () => {
      clearTimeout(timer)
      if (Number.isFinite(el.duration) && el.duration > 0) {
        const restaMs = Math.max(0, el.duration - el.currentTime) * 1000
        timer = setTimeout(() => finish(true), restaMs + ENDED_GRACE_MS)
      } else {
        timer = setTimeout(() => finish(false), METADATA_TIMEOUT_MS)
      }
    }
    const onPause = () => clearTimeout(timer)
    const onPlay = () => armWatchdog()
    const onMetadata = () => armWatchdog()
    timer = setTimeout(() => finish(false), METADATA_TIMEOUT_MS)
    el.addEventListener('ended', onEnded)
    el.addEventListener('error', onError)
    el.addEventListener('loadedmetadata', onMetadata)
    el.addEventListener('pause', onPause)
    el.addEventListener('play', onPlay)
    el.addEventListener('timeupdate', onTimeUpdate)
    signal.addEventListener('abort', onAbort, { once: true })
    el.src = url
    void el.play().catch(() => finish(false))
  })
}

export function pauseAudio(): void {
  sharedAudio?.pause()
}

export function resumeAudio(): void {
  // play() sobre faixa já encerrada REINICIA do zero (spec) — se a pausa
  // pegou a fronteira entre seções, retomar não deve repetir a anterior.
  if (!sharedAudio || sharedAudio.ended) return
  void sharedAudio.play().catch(() => undefined)
}

export function stopAudio(): void {
  if (!sharedAudio) return
  sharedAudio.pause()
  sharedAudio.removeAttribute('src')
}
