/**
 * O registrador: a fila entre o que acontece no navegador e a RPC
 * `registrar_log` (tabela `logs_sistema`).
 *
 * Regras, todas pensadas para a página de PAGAMENTO — o log não pode custar
 * nada a quem está pagando:
 *
 *   · nunca lança, nunca espera; falhou o envio, perdeu-se o log e só;
 *   · junta o que aconteceu em ~1,5 s e manda num lote (fatal vai na hora);
 *   · a mesma falha repetida em 5 s vai uma vez, com a contagem local — o
 *     banco ainda soma as repetições dele por cima;
 *   · teto por página: depois de 200 entradas, só uma última avisando;
 *   · `keepalive` no descarregar da saída da página (pagehide);
 *   · lote grande demais para o keepalive (64 KB) é fatiado.
 *
 * Tudo injetável (fetch, relógio, temporizador) para os testes não
 * dependerem de rede nem de tempo real.
 */

export type Nivel = 'debug' | 'info' | 'aviso' | 'erro' | 'fatal'

export interface EntradaDeLog {
  nivel: Nivel
  origem: 'navegador'
  fonte: string
  evento: string
  mensagem: string
  detalhes: Record<string, unknown>
  contexto: Record<string, unknown>
  requisicao_id: string | null
  sessao_id: string | null
  versao: string | null
}

export interface DetalhesDoRegistro {
  detalhes?: Record<string, unknown>
  requisicaoId?: string | null
}

export interface OpcoesDoRegistrador {
  /** URL do projeto Supabase, sem barra no fim. */
  url: string
  /** Anon key. */
  chave: string
  /** JWT da pessoa logada (para `auth.uid()` na RPC); null para anônimos. */
  tokenDeAcesso: () => string | null
  contexto: () => Record<string, unknown>
  sessaoId: () => string | null
  versao: string | null
  /** Desligado = só console (dev, testes, sem config). */
  ligado: boolean
  fetchFn?: typeof fetch
  agora?: () => number
  agendar?: (fn: () => void, ms: number) => unknown
  cancelar?: (id: unknown) => void
  esperaMs?: number
  limitePorPagina?: number
  /** Espelho local (console) — desligável nos testes. */
  espelharNoConsole?: boolean
}

export interface Registrador {
  registrar(nivel: Nivel, fonte: string, evento: string, mensagem: string, extra?: DetalhesDoRegistro): void
  /** Manda o que estiver na fila agora. `keepalive` para a saída da página. */
  descarregar(keepalive?: boolean): void
  pendentes(): number
}

export const ESPERA_PADRAO_MS = 1_500
export const JANELA_REPETICAO_MS = 5_000
export const LIMITE_PADRAO_POR_PAGINA = 200
/** Limite do keepalive nos navegadores: 64 KB por requisição em voo. */
const TAMANHO_MAXIMO_DO_LOTE = 56_000
const MAXIMO_POR_LOTE = 25

// Os métodos ORIGINAIS do console, presos aqui na carga do módulo: o
// instalar.ts troca console.error/warn por ganchos que mandam para o log —
// se o espelho usasse os trocados, cada entrada geraria outra, sem fim.
const CONSOLE: Record<Nivel, (...a: unknown[]) => void> = {
  debug: console.debug.bind(console),
  info: console.info.bind(console),
  aviso: console.warn.bind(console),
  erro: console.error.bind(console),
  fatal: console.error.bind(console),
}

function normalizar(mensagem: string): string {
  return mensagem.toLowerCase().replace(/[0-9]+/g, '#').slice(0, 200)
}

/** Fatia um lote para caber em `limite` bytes de JSON, cortando detalhes se preciso. */
export function fatiar(entradas: EntradaDeLog[], limite: number = TAMANHO_MAXIMO_DO_LOTE): EntradaDeLog[][] {
  const lotes: EntradaDeLog[][] = []
  let atual: EntradaDeLog[] = []
  let tamanho = 2
  for (const e0 of entradas) {
    let e = e0
    let bytes = JSON.stringify(e).length + 1
    if (bytes > limite) {
      // Entrada sozinha já estoura: sacrifica os detalhes e as migalhas.
      e = { ...e, detalhes: { cortado: true, resumo: JSON.stringify(e.detalhes).slice(0, 2000) }, contexto: { ...e.contexto, migalhas: [] } }
      bytes = JSON.stringify(e).length + 1
    }
    if (atual.length > 0 && (tamanho + bytes > limite || atual.length >= MAXIMO_POR_LOTE)) {
      lotes.push(atual)
      atual = []
      tamanho = 2
    }
    atual.push(e)
    tamanho += bytes
  }
  if (atual.length) lotes.push(atual)
  return lotes
}

export function criarRegistrador(o: OpcoesDoRegistrador): Registrador {
  const fetchFn = o.fetchFn ?? ((...a: Parameters<typeof fetch>) => fetch(...a))
  const agora = o.agora ?? (() => Date.now())
  const agendar = o.agendar ?? ((fn, ms) => setTimeout(fn, ms))
  const cancelar = o.cancelar ?? ((id) => clearTimeout(id as ReturnType<typeof setTimeout>))
  const esperaMs = o.esperaMs ?? ESPERA_PADRAO_MS
  const limite = o.limitePorPagina ?? LIMITE_PADRAO_POR_PAGINA
  const espelhar = o.espelharNoConsole ?? true

  const fila: EntradaDeLog[] = []
  const vistos = new Map<string, { em: number; vezes: number }>()
  let enviadas = 0
  let temporizador: unknown = null

  function enviar(lote: EntradaDeLog[], keepalive: boolean): void {
    if (!o.ligado || lote.length === 0) return
    const token = o.tokenDeAcesso()
    for (const parte of fatiar(lote)) {
      try {
        const promessa = fetchFn(`${o.url}/rest/v1/rpc/registrar_log`, {
          method: 'POST',
          headers: {
            apikey: o.chave,
            Authorization: `Bearer ${token ?? o.chave}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ p_entradas: parte }),
          keepalive,
          credentials: 'omit',
        })
        promessa.catch(() => {})
      } catch {
        // fetch indisponível: perdeu-se o lote
      }
    }
  }

  function descarregar(keepalive = false): void {
    if (temporizador !== null) {
      cancelar(temporizador)
      temporizador = null
    }
    if (fila.length === 0) return
    enviar(fila.splice(0), keepalive)
  }

  function agendarDescarga(): void {
    if (temporizador !== null) return
    temporizador = agendar(() => {
      temporizador = null
      descarregar(false)
    }, esperaMs)
  }

  return {
    registrar(nivel, fonte, evento, mensagem, extra) {
      try {
        const texto = (mensagem || '(sem mensagem)').slice(0, 2000)
        if (espelhar) {
          CONSOLE[nivel](`[${fonte}] ${evento}: ${texto}`, extra?.detalhes ?? '')
        }
        if (!o.ligado) return

        // Repetição local dentro da janela: conta, não envia.
        const chave = `${nivel}|${fonte}|${evento}|${normalizar(texto)}`
        const visto = vistos.get(chave)
        const t = agora()
        if (visto && t - visto.em < JANELA_REPETICAO_MS) {
          visto.vezes += 1
          return
        }
        vistos.set(chave, { em: t, vezes: 1 })
        if (vistos.size > 500) vistos.delete(vistos.keys().next().value as string)

        if (enviadas >= limite) {
          if (enviadas === limite) {
            enviadas += 1
            fila.push({
              nivel: 'aviso', origem: 'navegador', fonte: 'log', evento: 'limite_por_pagina',
              mensagem: `Mais de ${limite} entradas nesta página; as próximas não serão enviadas.`,
              detalhes: {}, contexto: o.contexto(), requisicao_id: null, sessao_id: o.sessaoId(), versao: o.versao,
            })
            descarregar(false)
          }
          return
        }
        enviadas += 1

        const detalhes = { ...(extra?.detalhes ?? {}) }
        if (visto && visto.vezes > 1) detalhes.repeticoes_locais = visto.vezes
        fila.push({
          nivel, origem: 'navegador', fonte, evento, mensagem: texto,
          detalhes,
          contexto: o.contexto(),
          requisicao_id: extra?.requisicaoId ?? null,
          sessao_id: o.sessaoId(),
          versao: o.versao,
        })
        if (nivel === 'fatal') descarregar(false)
        else agendarDescarga()
      } catch {
        // o log jamais derruba a página
      }
    },
    descarregar,
    pendentes: () => fila.length,
  }
}
