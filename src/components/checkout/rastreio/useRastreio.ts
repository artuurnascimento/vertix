import { useEffect, useMemo, useRef } from 'react'
import { supabaseConfigMissing } from '../../../lib/supabase'
import {
  sessaoDaVisita,
  sessaoExistente,
  visitanteDaMaquina,
} from './sessao'
import { criarRastreador, rastreadorMudo, type Rastreador } from './transporte'
import {
  CAMPOS_COM_VALOR,
  campoEmFoco,
  dispositivoDoAgente,
  distanciaAoCentro,
  navegadorDoAgente,
  secaoDominante,
  sistemaDoAgente,
  utmDaBusca,
  type CampoEmFoco,
  type SecaoNaTela,
} from './visita'

/**
 * O rastreio ao vivo do checkout, do lado de quem está comprando.
 *
 * Dois hooks:
 *
 *   useRastreioSessao    O básico que toda página do funil precisa: a
 *                        identidade da visita, o batimento a cada 25 s (é
 *                        ele que mantém a bolinha verde acesa no painel), a
 *                        troca de aba, o 'saiu' no fechamento e o primeiro
 *                        sinal humano — o que separa gente de bot.
 *
 *   useRastreioCheckout  O básico mais o que só a página do checkout tem: a
 *                        chegada (dispositivo, origem, UTMs), a localização
 *                        (via /api/geo), a SEÇÃO que está no centro da tela
 *                        e o CAMPO que tem o cursor — o "onde a pessoa está
 *                        olhando agora" do painel.
 *
 * Os passos explícitos (marcou o bump, escolheu Pix, clicou em pagar,
 * pagamento aprovado...) são disparados pelas páginas com `rastrear()`.
 *
 * Desligado nos testes unitários e sem config do Supabase: devolve um
 * rastreador mudo, e a página nem nota.
 */

const LIGADO = !supabaseConfigMissing && import.meta.env.MODE !== 'test'
const URL_SUPABASE: string = import.meta.env.VITE_SUPABASE_URL ?? ''
const CHAVE_ANON: string = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''

/** Batimento. O painel considera "agora" quem bateu nos últimos 90 s. */
const INTERVALO_PULSO_MS = 25_000
/** Quão rápido notamos que o cursor mudou de campo. */
const INTERVALO_FOCO_MS = 700
/** Rolagem gera dezenas de medições; só a seção onde a pessoa PAROU conta. */
const ESPERA_SECAO_MS = 800

function armazem(qual: 'session' | 'local'): Storage | null {
  try {
    return qual === 'session' ? window.sessionStorage : window.localStorage
  } catch {
    return null
  }
}

function marcarUmaVez(chave: string): boolean {
  const s = armazem('session')
  try {
    if (s?.getItem(chave)) return false
    s?.setItem(chave, '1')
  } catch {
    // sem storage, a marca vale só nesta página
  }
  return true
}

const SINAIS_HUMANOS: ReadonlyArray<[string, string]> = [
  ['touchstart', 'toque'],
  ['pointerdown', 'toque'],
  ['pointermove', 'mouse'],
  ['keydown', 'teclado'],
  ['wheel', 'rolagem'],
  ['scroll', 'rolagem'],
]

export function useRastreioSessao(
  slug: string | undefined,
  modo: 'criar' | 'continuar'
): Rastreador {
  const rastreador = useMemo(() => {
    if (!slug || !LIGADO || typeof window === 'undefined') return rastreadorMudo()
    const id =
      modo === 'criar'
        ? sessaoDaVisita(slug, armazem('session')).id
        : sessaoExistente(slug, armazem('session'))
    if (!id) return rastreadorMudo()
    return criarRastreador({ slug, sessaoId: id, url: URL_SUPABASE, chave: CHAVE_ANON })
  }, [slug, modo])

  useEffect(() => {
    if (!rastreador.sessaoId) return

    const visivel = () => document.visibilityState === 'visible'
    const pulso = window.setInterval(
      () => rastreador.rastrear('pulso', { visivel: visivel() }),
      INTERVALO_PULSO_MS
    )
    const aoMudarAba = () => rastreador.rastrear('aba', { visivel: visivel() })
    const aoSair = () => rastreador.encerrar()
    document.addEventListener('visibilitychange', aoMudarAba)
    window.addEventListener('pagehide', aoSair)

    // Primeiro sinal humano: uma vez por sessão. Bot de preview não toca,
    // não rola, não digita — e é isso que o painel usa para descartá-lo.
    const chaveSinal = `vx-rastreio:${rastreador.sessaoId}:humano`
    let removerSinais = () => {}
    const jaSinalizou = (() => {
      try {
        return Boolean(armazem('session')?.getItem(chaveSinal))
      } catch {
        return false
      }
    })()
    if (!jaSinalizou) {
      const aoInteragir = (evento: Event) => {
        const tipo = SINAIS_HUMANOS.find(([nome]) => nome === evento.type)?.[1] ?? 'outro'
        rastreador.rastrear('interagiu', { tipo })
        marcarUmaVez(chaveSinal)
        removerSinais()
      }
      SINAIS_HUMANOS.forEach(([nome]) =>
        window.addEventListener(nome, aoInteragir, { capture: true, passive: true })
      )
      removerSinais = () =>
        SINAIS_HUMANOS.forEach(([nome]) =>
          window.removeEventListener(nome, aoInteragir, true)
        )
    }

    return () => {
      window.clearInterval(pulso)
      document.removeEventListener('visibilitychange', aoMudarAba)
      window.removeEventListener('pagehide', aoSair)
      removerSinais()
    }
  }, [rastreador])

  return rastreador
}

export function useRastreioCheckout(
  slug: string | undefined,
  pronto: boolean
): Rastreador {
  const rastreador = useRastreioSessao(slug, 'criar')
  const entrou = useRef(false)

  // Chegada + localização.
  useEffect(() => {
    if (!pronto || !rastreador.sessaoId || entrou.current) return
    entrou.current = true

    const agente = navigator.userAgent ?? ''
    rastreador.rastrear('entrou', {
      agente,
      dispositivo: dispositivoDoAgente(agente),
      navegador: navegadorDoAgente(agente),
      so: sistemaDoAgente(agente),
      largura: window.innerWidth,
      altura: window.innerHeight,
      referrer: document.referrer,
      utm: utmDaBusca(window.location.search),
      idiomas: (navigator.languages ?? []).join(','),
      webdriver: navigator.webdriver === true,
      visitante_id: visitanteDaMaquina(armazem('local')),
    })

    // Cidade/UF vêm dos cabeçalhos da Vercel, uma vez por sessão. Falhou
    // (preview local, bloqueador)? A sessão fica sem local, e só.
    if (!marcarUmaVez(`vx-rastreio:${rastreador.sessaoId}:geo`)) return
    fetch('/api/geo', { credentials: 'omit' })
      .then((r) => (r.ok ? r.json() : null))
      .then((geo: unknown) => {
        if (geo && typeof geo === 'object') {
          rastreador.rastrear('localizou', geo as Record<string, unknown>)
        }
      })
      .catch(() => {})
  }, [pronto, rastreador])

  // Seção no centro da tela.
  useEffect(() => {
    if (!pronto || !rastreador.sessaoId) return
    if (typeof IntersectionObserver === 'undefined') return
    const elementos = Array.from(document.querySelectorAll<HTMLElement>('[data-secao]'))
    if (elementos.length === 0) return

    const estado = new Map<string, SecaoNaTela>()
    let ultima: string | null = null
    let temporizador: number | undefined

    const medir = (el: HTMLElement, proporcao?: number) => {
      const secao = el.dataset.secao ?? ''
      const r = el.getBoundingClientRect()
      const atual = estado.get(secao)
      estado.set(secao, {
        secao,
        proporcao: proporcao ?? atual?.proporcao ?? 0,
        distanciaAoCentro: distanciaAoCentro(r.top, r.bottom, window.innerHeight),
      })
    }
    const avaliar = () => {
      const secao = secaoDominante([...estado.values()])
      if (secao && secao !== ultima) {
        ultima = secao
        rastreador.rastrear('olhou', { secao })
      }
    }
    const agendar = () => {
      window.clearTimeout(temporizador)
      temporizador = window.setTimeout(avaliar, ESPERA_SECAO_MS)
    }

    const observador = new IntersectionObserver(
      (entradas) => {
        for (const e of entradas) medir(e.target as HTMLElement, e.intersectionRatio)
        agendar()
      },
      { threshold: [0, 0.1, 0.25, 0.5, 0.75, 1] }
    )
    elementos.forEach((el) => observador.observe(el))
    // Entre um limiar e outro o centro da tela também anda: a rolagem
    // refaz as distâncias (a visibilidade fica por conta do observer).
    const aoRolar = () => {
      elementos.forEach((el) => medir(el))
      agendar()
    }
    window.addEventListener('scroll', aoRolar, { passive: true })

    return () => {
      observador.disconnect()
      window.removeEventListener('scroll', aoRolar)
      window.clearTimeout(temporizador)
    }
  }, [pronto, rastreador])

  // Campo com o cursor, e o valor quando a pessoa sai de um campo de contato.
  useEffect(() => {
    if (!pronto || !rastreador.sessaoId) return
    let campoAtual: CampoEmFoco | null = null
    const ultimosValores = new Map<string, string>()

    const tique = () => {
      const campo = campoEmFoco(document.activeElement)
      if (campo === campoAtual) return
      if (campoAtual && campoAtual !== 'cartao') {
        const input = document.getElementById(`cliente-${campoAtual}`)
        const valor = input instanceof HTMLInputElement ? input.value.trim() : ''
        if (valor && ultimosValores.get(campoAtual) !== valor) {
          ultimosValores.set(campoAtual, valor)
          rastreador.rastrear(
            'preencheu',
            CAMPOS_COM_VALOR.has(campoAtual)
              ? { campo: campoAtual, valor }
              : { campo: campoAtual }
          )
        }
      }
      campoAtual = campo
      if (campo) rastreador.rastrear('digitando', { campo })
    }
    const intervalo = window.setInterval(tique, INTERVALO_FOCO_MS)
    return () => window.clearInterval(intervalo)
  }, [pronto, rastreador])

  return rastreador
}
