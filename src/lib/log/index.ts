/**
 * O log do navegador — a ponta "navegador" da trilha única (`logs_sistema`).
 *
 *   log.erro('checkout', 'pagamento_falhou', 'MP recusou', { detalhes })
 *   logDe('checkout').capturar('pagamento_falhou', erro)
 *
 * Cada entrada sai com o contexto inteiro (rota, aparelho, versão, aba,
 * usuário, sessão do rastreio, migalhas) e cai na RPC `registrar_log` em
 * lotes, sem custar nada à página. Os ganchos globais (erro não tratado,
 * promessa rejeitada, CSP, console.error, cliques, navegação) ficam em
 * `instalar.ts`; aqui é o núcleo e a API que o resto do app importa.
 *
 * `fetchComLog` é o fetch que o client do Supabase usa: em toda chamada às
 * edge functions ele manda os cabeçalhos de correlação (`x-vx-requisicao`,
 * `x-vx-nav`, `x-vx-sessao`) e deixa migalha do que falhou — é o que faz
 * o erro visto aqui e o erro registrado lá serem a mesma linha.
 */

import { VERSAO_ATUAL } from '../versao'
import { memoriaUsadaMb, montarContexto, redigirUrl, sessaoDeRastreioAtual } from './contexto'
import { criarMigalhas, type Migalhas } from './migalhas'
import { idDaAba, novoIdDeRequisicao } from './nav'
import { criarRegistrador, type DetalhesDoRegistro, type Nivel, type Registrador } from './registrador'

const URL_SUPABASE: string = import.meta.env.VITE_SUPABASE_URL ?? ''
const CHAVE_ANON: string = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''
const NO_NAVEGADOR = typeof window !== 'undefined' && typeof document !== 'undefined'
/** Só o build de produção manda para o banco; dev e testes ficam no console. */
const LIGADO = NO_NAVEGADOR && Boolean(URL_SUPABASE && CHAVE_ANON) && import.meta.env.PROD && import.meta.env.MODE !== 'test'

export const migalhas: Migalhas = criarMigalhas()

let usuarioId: string | null = null
let tokenDeAcesso: string | null = null

function armazemDaSessao(): Storage | null {
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

function contextoAtual(): Record<string, unknown> {
  if (!NO_NAVEGADOR) return {}
  try {
    return montarContexto({
      janela: window,
      navegador: navigator,
      documento: document,
      aba: idDaAba(),
      usuarioId,
      migalhas: migalhas.listar,
      relogio: () => performance.now(),
      memoriaMb: memoriaUsadaMb,
    })
  } catch {
    return {}
  }
}

const registrador: Registrador = criarRegistrador({
  url: URL_SUPABASE,
  chave: CHAVE_ANON,
  tokenDeAcesso: () => tokenDeAcesso,
  contexto: contextoAtual,
  sessaoId: () => sessaoDeRastreioAtual(armazemDaSessao()),
  versao: VERSAO_ATUAL,
  ligado: LIGADO,
  espelharNoConsole: import.meta.env.MODE !== 'test',
})

/** Quem está logado (painel): id para o contexto, token para `auth.uid()`. */
export function definirUsuario(id: string | null, token: string | null): void {
  usuarioId = id
  tokenDeAcesso = token
}

export function descarregar(keepalive = false): void {
  registrador.descarregar(keepalive)
}

export function registrar(nivel: Nivel, fonte: string, evento: string, mensagem: string, extra?: DetalhesDoRegistro): void {
  registrador.registrar(nivel, fonte, evento, mensagem, extra)
}

/** Error → {nome, mensagem, stack (20 linhas), causa}; outros → {valor}. */
export function serializarErro(erro: unknown): Record<string, unknown> {
  if (erro instanceof Error) {
    const saida: Record<string, unknown> = {
      nome: erro.name,
      mensagem: erro.message,
      stack: (erro.stack ?? '').split('\n').slice(0, 20).join('\n'),
    }
    if (erro.cause !== undefined) saida.causa = serializarErro(erro.cause)
    return saida
  }
  if (erro && typeof erro === 'object') {
    try {
      return { valor: JSON.parse(JSON.stringify(erro).slice(0, 4000)) }
    } catch {
      return { valor: String(erro) }
    }
  }
  return { valor: String(erro) }
}

function mensagemDe(erro: unknown): string {
  return erro instanceof Error ? erro.message : typeof erro === 'string' ? erro : JSON.stringify(erro)?.slice(0, 300) ?? String(erro)
}

/** Para blocos catch: o erro vira mensagem + detalhes de uma vez. */
export function capturar(fonte: string, evento: string, erro: unknown, extra?: DetalhesDoRegistro, nivel: Nivel = 'erro'): void {
  registrar(nivel, fonte, evento, mensagemDe(erro), {
    ...extra,
    detalhes: { ...serializarErro(erro), ...(extra?.detalhes ?? {}) },
  })
}

export const log = {
  debug: (fonte: string, evento: string, mensagem: string, extra?: DetalhesDoRegistro) => registrar('debug', fonte, evento, mensagem, extra),
  info: (fonte: string, evento: string, mensagem: string, extra?: DetalhesDoRegistro) => registrar('info', fonte, evento, mensagem, extra),
  aviso: (fonte: string, evento: string, mensagem: string, extra?: DetalhesDoRegistro) => registrar('aviso', fonte, evento, mensagem, extra),
  erro: (fonte: string, evento: string, mensagem: string, extra?: DetalhesDoRegistro) => registrar('erro', fonte, evento, mensagem, extra),
  fatal: (fonte: string, evento: string, mensagem: string, extra?: DetalhesDoRegistro) => registrar('fatal', fonte, evento, mensagem, extra),
}

/** Um logger com a fonte fixa, para um módulo. */
export function logDe(fonte: string) {
  return {
    debug: (evento: string, mensagem: string, extra?: DetalhesDoRegistro) => registrar('debug', fonte, evento, mensagem, extra),
    info: (evento: string, mensagem: string, extra?: DetalhesDoRegistro) => registrar('info', fonte, evento, mensagem, extra),
    aviso: (evento: string, mensagem: string, extra?: DetalhesDoRegistro) => registrar('aviso', fonte, evento, mensagem, extra),
    erro: (evento: string, mensagem: string, extra?: DetalhesDoRegistro) => registrar('erro', fonte, evento, mensagem, extra),
    fatal: (evento: string, mensagem: string, extra?: DetalhesDoRegistro) => registrar('fatal', fonte, evento, mensagem, extra),
    capturar: (evento: string, erro: unknown, extra?: DetalhesDoRegistro, nivel?: Nivel) => capturar(fonte, evento, erro, extra, nivel),
  }
}

// ---------------------------------------------------------------------------
// fetch do client do Supabase: correlação + migalhas de rede
// ---------------------------------------------------------------------------

const EDGE = '/functions/v1/'

function urlDe(entrada: RequestInfo | URL): string {
  if (typeof entrada === 'string') return entrada
  if (entrada instanceof URL) return entrada.href
  return entrada.url
}

/** "https://x.supabase.co/functions/v1/checkout-pagar" → "checkout-pagar". */
function nomeDaFunction(url: string): string | null {
  const i = url.indexOf(EDGE)
  if (i === -1) return null
  return url.slice(i + EDGE.length).split(/[/?#]/)[0] || null
}

export const fetchComLog: typeof fetch = async (entrada, init) => {
  const url = urlDe(entrada)
  const fn = nomeDaFunction(url)
  const inicio = NO_NAVEGADOR ? performance.now() : 0
  let requisicaoId: string | null = null
  let opcoes = init

  if (fn) {
    requisicaoId = novoIdDeRequisicao()
    const headers = new Headers(init?.headers ?? (entrada instanceof Request ? entrada.headers : undefined))
    headers.set('x-vx-requisicao', requisicaoId)
    try {
      headers.set('x-vx-nav', idDaAba())
      const sessao = sessaoDeRastreioAtual(armazemDaSessao())
      if (sessao) headers.set('x-vx-sessao', sessao)
    } catch {
      // sem storage: só o id da requisição
    }
    opcoes = { ...init, headers }
  }

  const alvo = fn ? fn : redigirUrl(url).slice(0, 120)
  try {
    const resposta = await fetch(entrada, opcoes)
    const duracao = Math.round(performance.now() - inicio)
    if (resposta.status >= 400) {
      const idDoServidor = resposta.headers.get('x-vx-requisicao')
      migalhas.deixar('rede', `${resposta.status} ${alvo}`, { ms: duracao, req: idDoServidor ?? requisicaoId ?? undefined })
      if (fn && resposta.status >= 500) {
        registrar('erro', 'rede', 'edge_5xx', `${fn} respondeu ${resposta.status}`, {
          requisicaoId: idDoServidor ?? requisicaoId,
          detalhes: { status: resposta.status, duracao_ms: duracao },
        })
      }
    }
    return resposta
  } catch (erro) {
    const duracao = Math.round(performance.now() - inicio)
    migalhas.deixar('rede', `falhou ${alvo}`, { ms: duracao, req: requisicaoId ?? undefined })
    if (fn) {
      registrar('erro', 'rede', 'edge_sem_resposta', `${fn}: ${mensagemDe(erro)}`, {
        requisicaoId,
        detalhes: { duracao_ms: duracao, online: NO_NAVEGADOR ? navigator.onLine : null },
      })
    }
    throw erro
  }
}
