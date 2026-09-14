/**
 * Migalhas: o que a pessoa fez ANTES do erro.
 *
 * Um erro sozinho diz "quebrou"; as últimas ações dizem "quebrou depois de
 * clicar em Pagar com o cupom aplicado, na segunda tentativa". Guardamos
 * uma fila curta (navegação, cliques, chamadas de rede que falharam, avisos
 * do console) e ela vai inteira no `contexto` de cada entrada de log.
 *
 * Nada de texto digitado: o clique registra o rótulo do botão, nunca o
 * valor de um campo.
 */

export type TipoDeMigalha = 'navegacao' | 'clique' | 'rede' | 'console' | 'estado'

export interface Migalha {
  /** ms desde o carregamento da página — compacto e sem fuso. */
  t: number
  tipo: TipoDeMigalha
  texto: string
  dados?: Record<string, unknown>
}

export interface Migalhas {
  deixar(tipo: TipoDeMigalha, texto: string, dados?: Record<string, unknown>): void
  listar(): Migalha[]
}

const LIMITE_PADRAO = 25
const TEXTO_MAXIMO = 120

export function criarMigalhas(
  limite: number = LIMITE_PADRAO,
  relogio: () => number = () => Math.round(performance.now())
): Migalhas {
  const fila: Migalha[] = []
  return {
    deixar(tipo, texto, dados) {
      const m: Migalha = { t: relogio(), tipo, texto: texto.slice(0, TEXTO_MAXIMO) }
      if (dados && Object.keys(dados).length) m.dados = dados
      fila.push(m)
      if (fila.length > limite) fila.splice(0, fila.length - limite)
    },
    listar: () => fila.slice(),
  }
}

/** Rótulo de um elemento clicado: o texto visível, ou aria-label, ou id. */
export function rotuloDoAlvo(alvo: EventTarget | null): string | null {
  if (!(alvo instanceof Element)) return null
  const interativo = alvo.closest('button, a, [role="button"], input, select, label, summary')
  const el = interativo ?? alvo
  const tag = el.tagName.toLowerCase()
  if (tag === 'input') {
    const input = el as HTMLInputElement
    // Campos de texto: só qual campo, nunca o valor.
    const nome = input.id || input.name || input.type
    return `${tag}#${nome}`
  }
  const texto =
    el.getAttribute('aria-label') ||
    (el.textContent ?? '').replace(/\s+/g, ' ').trim() ||
    el.id ||
    tag
  return `${tag}: ${texto.slice(0, 60)}`
}
