/**
 * O gravador de log das edge functions — a ponta "edge" da trilha única
 * (tabela `logs_sistema`, migração logs_sistema).
 *
 * Duas peças:
 *
 *   criarLog(fonte)      Um logger por arquivo: `log.erro(...)`, `log.info(...)`.
 *                        Espelha no console (o painel da Supabase continua
 *                        útil) E enfileira para o banco.
 *
 *   comLog(fonte, h)     Envolve o handler HTTP. Dá a cada requisição um id
 *                        (o navegador manda o dele em `x-vx-requisicao`; sem
 *                        ele, criamos um), guarda esse id num contexto que
 *                        toda chamada de `log.*` feita durante a requisição
 *                        enxerga — inclusive dentro dos módulos _shared, sem
 *                        passar nada por parâmetro —, registra sozinho a
 *                        exceção não tratada (500 + fatal), a resposta de
 *                        erro e a lentidão, devolve o id no cabeçalho de
 *                        resposta e descarrega a fila DEPOIS de responder
 *                        (`EdgeRuntime.waitUntil`), para o log não atrasar
 *                        ninguém.
 *
 * Duas formas de chamar, para a migração dos console.error ser um rename:
 *
 *   log.erro('mp_recusou', 'MP recusou o pagamento', { status: 402 })
 *     evento explícito (slug), mensagem, detalhes — a forma preferida;
 *
 *   log.erro('Falha ao criar customer:', res.status, erro)
 *     estilo console: o texto vira mensagem, o resto vira detalhes, e o
 *     evento é derivado do texto ("falha_ao_criar_customer").
 *
 * Nunca lança, nunca espera rede no caminho da resposta, nunca grava chave
 * sensível (a poda de verdade é no banco; aqui só não mandamos o que sabemos
 * ser segredo).
 */

// Deno traz o AsyncLocalStorage do Node; se o runtime da Supabase um dia não
// trouxer, o log continua funcionando — só sem o id de requisição.
const armazem = await (async () => {
  try {
    const m = await import('node:async_hooks')
    return new m.AsyncLocalStorage<ContextoDaRequisicao>()
  } catch {
    return null
  }
})()

export type Nivel = 'debug' | 'info' | 'aviso' | 'erro' | 'fatal'

export interface Entrada {
  nivel: Nivel
  origem: 'edge'
  fonte: string
  evento: string
  mensagem: string
  detalhes: Record<string, unknown>
  contexto: Record<string, unknown>
  requisicao_id: string | null
  sessao_id: string | null
  usuario_id: string | null
  versao: string | null
}

interface ContextoDaRequisicao {
  id: string
  fonte: string
  inicio: number
  contexto: Record<string, unknown>
  sessaoId: string | null
  usuarioId: string | null
  fila: Entrada[]
  /** Alguém já registrou erro/fatal nesta requisição (evita o 5xx genérico duplicado). */
  registrouErro: boolean
}

export interface Registrador {
  debug(...args: unknown[]): void
  info(...args: unknown[]): void
  aviso(...args: unknown[]): void
  erro(...args: unknown[]): void
  fatal(...args: unknown[]): void
  /** Acrescenta ao contexto desta requisição (slug, pedido_id...) — vai em toda entrada seguinte. */
  contexto(extra: Record<string, unknown>): void
}

export type Transporte = (entradas: Entrada[]) => Promise<void>

/** Acima disto a requisição vira 'aviso: lento'. */
export const LENTO_MS = 5_000
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const SLUG_RE = /^[a-z0-9][a-z0-9_.-]{1,80}$/
const TIMEOUT_MS = 4_000
const MAXIMO_POR_REQUISICAO = 50

/** Env sem permissão (testes rodam sem --allow-env) vira "não tem". */
function env(nome: string): string | null {
  try {
    return Deno.env.get(nome) ?? null
  } catch {
    return null
  }
}

const VERSAO: string | null = env('VERSAO_APP')

// ---------------------------------------------------------------------------
// Transporte: um POST na RPC de serviço. Substituível nos testes.
// ---------------------------------------------------------------------------

let transporte: Transporte = enviarParaOBanco

export function configurarTransporte(novo: Transporte | null): void {
  transporte = novo ?? enviarParaOBanco
}

async function enviarParaOBanco(entradas: Entrada[]): Promise<void> {
  const url = env('SUPABASE_URL')
  const chave = env('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !chave || entradas.length === 0) return
  try {
    const res = await fetch(`${url}/rest/v1/rpc/registrar_log_servico`, {
      method: 'POST',
      headers: {
        apikey: chave,
        Authorization: `Bearer ${chave}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_entradas: entradas }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!res.ok) {
      console.warn('[log] banco recusou o lote:', res.status, (await res.text()).slice(0, 200))
    }
  } catch (erro) {
    console.warn('[log] lote não chegou ao banco:', erro instanceof Error ? erro.message : String(erro))
  }
}

// ---------------------------------------------------------------------------
// Serialização: Error vira {nome, mensagem, stack}; o resto passa como está.
// ---------------------------------------------------------------------------

export function serializar(valor: unknown, profundidade = 0): unknown {
  if (valor instanceof Error) {
    const base: Record<string, unknown> = {
      nome: valor.name,
      mensagem: valor.message,
      stack: (valor.stack ?? '').split('\n').slice(0, 12).join('\n'),
    }
    if (valor.cause !== undefined) base.causa = serializar(valor.cause, profundidade + 1)
    return base
  }
  if (valor instanceof Response) {
    return { resposta: { status: valor.status, url: valor.url } }
  }
  if (typeof valor === 'bigint') return valor.toString()
  if (typeof valor === 'function' || typeof valor === 'symbol') return String(valor)
  if (valor && typeof valor === 'object' && profundidade < 4) {
    if (Array.isArray(valor)) return valor.slice(0, 50).map((v) => serializar(v, profundidade + 1))
    const saida: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(valor as Record<string, unknown>).slice(0, 60)) {
      saida[k] = serializar(v, profundidade + 1)
    }
    return saida
  }
  if (typeof valor === 'string') return valor.length > 4000 ? valor.slice(0, 4000) + '…' : valor
  return valor
}

/** "[fonte] Falha ao criar customer: 500" → "falha_ao_criar_customer". */
export function eventoDaMensagem(mensagem: string): string {
  const semPrefixo = mensagem.replace(/^\s*\[[^\]]*\]\s*/, '')
  const cabeca = semPrefixo.split(/[:—–(]/)[0] ?? semPrefixo
  const slug = cabeca
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .split('_')
    .slice(0, 6)
    .join('_')
  return slug || 'evento'
}

/**
 * Interpreta os argumentos nas duas formas (ver cabeçalho). Devolve
 * evento, mensagem e detalhes.
 */
export function interpretar(args: unknown[]): {
  evento: string
  mensagem: string
  detalhes: Record<string, unknown>
} {
  const [primeiro, segundo, terceiro] = args
  const formaExplicita =
    typeof primeiro === 'string' &&
    SLUG_RE.test(primeiro) &&
    typeof segundo === 'string' &&
    args.length <= 3 &&
    (terceiro === undefined || (typeof terceiro === 'object' && terceiro !== null && !(terceiro instanceof Error)))
  if (formaExplicita) {
    return {
      evento: primeiro,
      mensagem: segundo,
      detalhes: (serializar(terceiro ?? {}) as Record<string, unknown>) ?? {},
    }
  }

  const textos: string[] = []
  const extras: unknown[] = []
  for (const a of args) {
    if (typeof a === 'string' || typeof a === 'number' || typeof a === 'boolean') textos.push(String(a))
    else if (a instanceof Error) {
      textos.push(a.message)
      extras.push(a)
    } else if (a !== undefined && a !== null) extras.push(a)
  }
  const mensagem = textos.join(' ').replace(/^\s*\[[^\]]*\]\s*/, '').trim() || '(sem mensagem)'
  const detalhes: Record<string, unknown> = {}
  if (extras.length === 1) {
    const unico = serializar(extras[0])
    if (unico && typeof unico === 'object' && !Array.isArray(unico)) Object.assign(detalhes, unico)
    else detalhes.valor = unico
  } else if (extras.length > 1) {
    detalhes.valores = extras.map((e) => serializar(e))
  }
  return { evento: eventoDaMensagem(textos[0] ?? mensagem), mensagem, detalhes }
}

// ---------------------------------------------------------------------------
// O logger
// ---------------------------------------------------------------------------

const CONSOLE: Record<Nivel, (...a: unknown[]) => void> = {
  debug: console.debug,
  info: console.info,
  aviso: console.warn,
  erro: console.error,
  fatal: console.error,
}

function registrar(fonte: string, nivel: Nivel, args: unknown[]): void {
  try {
    const { evento, mensagem, detalhes } = interpretar(args)
    const ctx = armazem?.getStore() ?? null
    CONSOLE[nivel](`[${fonte}] ${mensagem}`, ...(Object.keys(detalhes).length ? [detalhes] : []))
    const entrada: Entrada = {
      nivel,
      origem: 'edge',
      fonte,
      evento,
      mensagem,
      detalhes,
      contexto: ctx ? { ...ctx.contexto, function: ctx.fonte } : {},
      requisicao_id: ctx?.id ?? null,
      sessao_id: ctx?.sessaoId ?? null,
      usuario_id: ctx?.usuarioId ?? null,
      versao: VERSAO,
    }
    if (ctx) {
      if (nivel === 'erro' || nivel === 'fatal') ctx.registrouErro = true
      if (ctx.fila.length < MAXIMO_POR_REQUISICAO) ctx.fila.push(entrada)
    } else {
      // Fora de requisição (boot do módulo, tarefa solta): vai agora. O
      // catch é obrigatório: rejeição solta derruba o isolate inteiro.
      transporte([entrada]).catch(() => {})
    }
  } catch {
    // o log jamais derruba quem chamou
  }
}

export function criarLog(fonte: string): Registrador {
  return {
    debug: (...a) => registrar(fonte, 'debug', a),
    info: (...a) => registrar(fonte, 'info', a),
    aviso: (...a) => registrar(fonte, 'aviso', a),
    erro: (...a) => registrar(fonte, 'erro', a),
    fatal: (...a) => registrar(fonte, 'fatal', a),
    contexto: (extra) => {
      const ctx = armazem?.getStore()
      if (ctx) Object.assign(ctx.contexto, serializar(extra) as Record<string, unknown>)
    },
  }
}

// ---------------------------------------------------------------------------
// O envelope da requisição
// ---------------------------------------------------------------------------

function novoId(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 16)
}

/** Sub do JWT sem verificar (a verificação é do gateway); só para o contexto. */
function usuarioDoJwt(cabecalho: string | null): string | null {
  const token = cabecalho?.replace(/^Bearer\s+/i, '')
  if (!token) return null
  try {
    const carga = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    const sub = typeof carga.sub === 'string' ? carga.sub : null
    return sub && UUID_RE.test(sub) && carga.role !== 'anon' ? sub : null
  } catch {
    return null
  }
}

async function codigoDeErroDaResposta(resposta: Response): Promise<string | null> {
  try {
    if (!(resposta.headers.get('content-type') ?? '').includes('json')) return null
    const corpo = await resposta.clone().json()
    const codigo = corpo?.erro ?? corpo?.error ?? corpo?.code
    return typeof codigo === 'string' ? codigo.slice(0, 80) : null
  } catch {
    return null
  }
}

function descarregar(ctx: ContextoDaRequisicao): void {
  if (ctx.fila.length === 0) return
  const lote = ctx.fila.splice(0)
  const envio = transporte(lote).catch(() => {})
  const runtime = (globalThis as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } }).EdgeRuntime
  if (runtime?.waitUntil) runtime.waitUntil(envio)
  else void envio
}

export function comLog(
  fonte: string,
  handler: (req: Request) => Promise<Response> | Response
): (req: Request) => Promise<Response> {
  const log = criarLog(fonte)
  return async (req: Request): Promise<Response> => {
    const idRecebido = req.headers.get('x-vx-requisicao')?.trim().slice(0, 80)
    const sessao = req.headers.get('x-vx-sessao')?.trim() ?? ''
    const url = new URL(req.url)
    const ctx: ContextoDaRequisicao = {
      id: idRecebido && /^[A-Za-z0-9_-]+$/.test(idRecebido) ? idRecebido : novoId(),
      fonte,
      inicio: performance.now(),
      contexto: {
        metodo: req.method,
        caminho: url.pathname,
        nav: req.headers.get('x-vx-nav')?.slice(0, 40) ?? null,
        origem_http: req.headers.get('origin') ?? null,
        agente: (req.headers.get('user-agent') ?? '').slice(0, 160),
        pais: req.headers.get('x-vercel-ip-country') ?? req.headers.get('cf-ipcountry') ?? null,
      },
      sessaoId: UUID_RE.test(sessao) ? sessao : null,
      usuarioId: usuarioDoJwt(req.headers.get('authorization')),
      fila: [],
      registrouErro: false,
    }

    const executar = async (): Promise<Response> => {
      let resposta: Response
      try {
        resposta = await handler(req)
      } catch (erro) {
        log.fatal('excecao_nao_tratada', erro instanceof Error ? erro.message : String(erro), {
          erro: serializar(erro),
        })
        resposta = new Response(JSON.stringify({ erro: 'interno', requisicao_id: ctx.id }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      const duracao = Math.round(performance.now() - ctx.inicio)
      try {
        if (resposta.status >= 500 && !ctx.registrouErro) {
          log.erro('resposta_5xx', `Respondeu ${resposta.status}`, {
            status: resposta.status,
            codigo: await codigoDeErroDaResposta(resposta),
            duracao_ms: duracao,
          })
        } else if (resposta.status >= 400) {
          log.aviso('resposta_4xx', `Respondeu ${resposta.status}`, {
            status: resposta.status,
            codigo: await codigoDeErroDaResposta(resposta),
            duracao_ms: duracao,
          })
        }
        if (duracao > LENTO_MS) {
          log.aviso('lento', `Levou ${(duracao / 1000).toFixed(1)} s`, {
            duracao_ms: duracao,
            status: resposta.status,
          })
        }
      } catch {
        // medir nunca derruba a resposta
      }

      const headers = new Headers(resposta.headers)
      headers.set('x-vx-requisicao', ctx.id)
      const final = new Response(resposta.body, {
        status: resposta.status,
        statusText: resposta.statusText,
        headers,
      })
      descarregar(ctx)
      return final
    }

    return armazem ? armazem.run(ctx, executar) : executar()
  }
}
