/**
 * O fio entre o navegador e a RPC `checkout_rastrear`.
 *
 * Um `fetch` cru em vez do supabase-js, por três motivos:
 *   · `keepalive: true` — o evento 'saiu' é disparado no `pagehide` e precisa
 *     sobreviver à página fechando; o client do Supabase não expõe isso;
 *   · fila em ordem — os passos chegam ao banco na ordem em que aconteceram
 *     (cada envio espera o anterior), o que mantém a linha do tempo honesta;
 *   · silêncio total — rastreio jamais lança, jamais mostra erro, jamais
 *     atrasa o pagamento. Falhou? Perdeu-se um passo. Só isso.
 *
 * O `encerrar()` fura a fila de propósito: no `pagehide` não há tempo de
 * esperar os envios pendentes; o 'saiu' vai sozinho, imediatamente.
 *
 * Passo idêntico ao anterior dentro de 2 s é descartado: um componente que
 * dispara o mesmo callback duas vezes (troca de método, foco que pisca) não
 * deve virar duas linhas iguais na linha do tempo.
 */

/** Janela em que um passo igual ao anterior é considerado repetição. */
export const JANELA_REPETICAO_MS = 2_000

export type DadosDoEvento = Record<string, unknown>

export interface Rastreador {
  readonly sessaoId: string
  /** Enfileira um passo. Nunca lança. */
  rastrear(tipo: string, dados?: DadosDoEvento): void
  /** Manda 'saiu' na hora, fora da fila (para o pagehide). */
  encerrar(dados?: DadosDoEvento): void
}

export interface OpcoesDoRastreador {
  slug: string
  sessaoId: string
  /** URL do projeto Supabase (sem barra no fim). */
  url: string
  /** Anon key: pública por definição; a RPC valida tudo do lado de lá. */
  chave: string
  fetchFn?: typeof fetch
  /** Relógio injetável (testes). */
  agora?: () => number
}

export function criarRastreador({
  slug,
  sessaoId,
  url,
  chave,
  fetchFn = globalThis.fetch,
  agora = Date.now,
}: OpcoesDoRastreador): Rastreador {
  const destino = `${url.replace(/\/$/, '')}/rest/v1/rpc/checkout_rastrear`
  let fila: Promise<void> = Promise.resolve()
  let ultimo: { assinatura: string; em: number } | null = null

  const enviar = async (tipo: string, dados: DadosDoEvento): Promise<void> => {
    try {
      await fetchFn(destino, {
        method: 'POST',
        keepalive: true,
        headers: {
          'Content-Type': 'application/json',
          apikey: chave,
          Authorization: `Bearer ${chave}`,
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          p_sessao: sessaoId,
          p_slug: slug,
          p_tipo: tipo,
          p_dados: dados,
        }),
      })
    } catch {
      // Rede caiu, bloqueador de conteúdo, aba fechando: o passo se perde e a
      // página segue. Nunca um erro visível por causa de rastreio.
    }
  }

  return {
    sessaoId,
    rastrear(tipo, dados = {}) {
      const assinatura = `${tipo}:${JSON.stringify(dados)}`
      const instante = agora()
      if (
        tipo !== 'pulso' &&
        ultimo &&
        ultimo.assinatura === assinatura &&
        instante - ultimo.em < JANELA_REPETICAO_MS
      ) {
        return
      }
      ultimo = { assinatura, em: instante }
      fila = fila.then(() => enviar(tipo, dados))
    },
    encerrar(dados = {}) {
      void enviar('saiu', dados)
    },
  }
}

/** Rastreador que não faz nada — para testes e para quando falta config. */
export function rastreadorMudo(sessaoId = ''): Rastreador {
  return { sessaoId, rastrear() {}, encerrar() {} }
}
