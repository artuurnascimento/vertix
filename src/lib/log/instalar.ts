/**
 * Os ganchos globais do log do navegador. Chamado uma vez, no main.tsx,
 * antes de o React montar.
 *
 * O que passa a ser registrado sem ninguém precisar escrever `log.` em
 * lugar nenhum:
 *
 *   · exceção não tratada (window 'error') — com arquivo, linha e stack;
 *   · recurso que não carregou (script, imagem, fonte, CSS) — quase sempre
 *     é a causa da "tela em branco" e nunca aparecia em lugar nenhum;
 *   · promessa rejeitada sem catch;
 *   · bloqueio de CSP ('securitypolicyviolation') — o SDK do Mercado Pago
 *     barrado pela política é exatamente este evento;
 *   · console.error de qualquer módulo (o Brick do MP, o SDK, o React).
 *
 * E as migalhas: cliques (rótulo do botão, nunca o valor de campo),
 * navegação (pushState/popstate), console.warn, online/offline.
 *
 * Na saída da página (pagehide / aba escondida) a fila é descarregada com
 * keepalive, para o último erro não se perder junto com a aba.
 */

import { descarregar, log, migalhas, serializarErro } from './index'
import { redigirUrl } from './contexto'
import { rotuloDoAlvo } from './migalhas'

const console_ = {
  error: console.error.bind(console),
  warn: console.warn.bind(console),
}

function textoDosArgumentos(args: unknown[]): string {
  return args
    .map((a) => (a instanceof Error ? a.message : typeof a === 'string' ? a : safeJson(a)))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500)
}

function safeJson(valor: unknown): string {
  try {
    return typeof valor === 'object' ? JSON.stringify(valor).slice(0, 300) : String(valor)
  } catch {
    return String(valor)
  }
}

/** Erros que o próprio ecossistema dispara e não dizem nada de útil. */
const RUIDO = [
  /ResizeObserver loop/i,
  /Script error\.?$/i, // script de outra origem sem CORS: sem stack, sem mensagem
]

let instalado = false

export function instalarLogGlobal(alvo: Window = window): void {
  if (instalado) return
  instalado = true

  // --- exceções e recursos ------------------------------------------------
  alvo.addEventListener(
    'error',
    (evento: Event) => {
      // Recurso que não carregou: o evento não borbulha, só chega na captura,
      // e o alvo é o elemento (img, script, link).
      const el = evento.target
      if (el instanceof HTMLElement && el !== (alvo.document.body as HTMLElement) && !(evento instanceof ErrorEvent)) {
        const url = (el as HTMLScriptElement).src || (el as HTMLLinkElement).href || ''
        const externo = url && !url.startsWith(alvo.location.origin)
        log.aviso('recurso', 'recurso_nao_carregou', `${el.tagName.toLowerCase()} não carregou: ${redigirUrl(url).slice(0, 160)}`, {
          detalhes: { url: url.slice(0, 300), externo, online: alvo.navigator.onLine },
        })
        return
      }
      if (!(evento instanceof ErrorEvent)) return
      const mensagem = evento.message || (evento.error instanceof Error ? evento.error.message : 'erro sem mensagem')
      if (RUIDO.some((r) => r.test(mensagem))) return
      log.erro('janela', 'excecao_nao_tratada', mensagem, {
        detalhes: {
          ...serializarErro(evento.error),
          arquivo: evento.filename ? redigirUrl(evento.filename).slice(0, 200) : undefined,
          linha: evento.lineno || undefined,
          coluna: evento.colno || undefined,
        },
      })
    },
    true
  )

  alvo.addEventListener('unhandledrejection', (evento) => {
    const motivo = (evento as PromiseRejectionEvent).reason
    const mensagem = motivo instanceof Error ? motivo.message : safeJson(motivo)
    if (RUIDO.some((r) => r.test(mensagem))) return
    log.erro('janela', 'promessa_rejeitada', mensagem, { detalhes: serializarErro(motivo) })
  })

  alvo.addEventListener('securitypolicyviolation', (evento) => {
    const e = evento as SecurityPolicyViolationEvent
    log.erro('csp', 'csp_bloqueou', `${e.violatedDirective} bloqueou ${e.blockedURI || '(inline)'}`, {
      detalhes: {
        diretiva: e.violatedDirective,
        bloqueado: (e.blockedURI || '').slice(0, 300),
        arquivo: e.sourceFile ? redigirUrl(e.sourceFile).slice(0, 200) : undefined,
        linha: e.lineNumber || undefined,
        disposicao: e.disposition,
      },
    })
  })

  // --- console ------------------------------------------------------------
  console.error = (...args: unknown[]) => {
    console_.error(...args)
    try {
      const texto = textoDosArgumentos(args)
      // O espelho do registrador no console começa com "[fonte] evento:" —
      // não volta para o banco (já está lá).
      if (/^\[[^\]]+\] [a-z0-9_.-]+: /.test(texto)) return
      const erro = args.find((a) => a instanceof Error)
      migalhas.deixar('console', texto.slice(0, 120))
      log.erro('console', 'console_erro', texto, { detalhes: erro ? serializarErro(erro) : {} })
    } catch {
      // nunca a partir daqui
    }
  }
  console.warn = (...args: unknown[]) => {
    console_.warn(...args)
    try {
      const texto = textoDosArgumentos(args)
      if (/^\[[^\]]+\] [a-z0-9_.-]+: /.test(texto)) return
      migalhas.deixar('console', texto.slice(0, 120))
    } catch {
      // idem
    }
  }

  // --- migalhas -----------------------------------------------------------
  alvo.addEventListener(
    'click',
    (evento) => {
      const rotulo = rotuloDoAlvo(evento.target)
      if (rotulo) migalhas.deixar('clique', rotulo)
    },
    { capture: true, passive: true }
  )

  const historico = alvo.history
  const rotaAtual = () => redigirUrl(alvo.location.pathname + alvo.location.search)
  for (const metodo of ['pushState', 'replaceState'] as const) {
    const original = historico[metodo].bind(historico)
    historico[metodo] = ((...args: Parameters<History['pushState']>) => {
      const retorno = original(...args)
      migalhas.deixar('navegacao', rotaAtual())
      return retorno
    }) as History['pushState']
  }
  alvo.addEventListener('popstate', () => migalhas.deixar('navegacao', `voltar → ${rotaAtual()}`))
  alvo.addEventListener('online', () => migalhas.deixar('estado', 'online'))
  alvo.addEventListener('offline', () => migalhas.deixar('estado', 'offline'))

  // --- saída da página ----------------------------------------------------
  alvo.addEventListener('pagehide', () => descarregar(true))
  alvo.document.addEventListener('visibilitychange', () => {
    if (alvo.document.visibilityState === 'hidden') descarregar(true)
  })

  migalhas.deixar('navegacao', rotaAtual())
}
