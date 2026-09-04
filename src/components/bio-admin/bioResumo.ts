/**
 * Resumo do link de bio a partir dos eventos crus. Cálculo puro, sem rede —
 * é o que responde a pergunta que motivou ter link próprio em vez de
 * ferramenta pronta: qual atalho traz cliente.
 *
 * Divisão por zero devolve null (exibido como "—"), nunca Infinity ou NaN,
 * como em src/components/trafego/adMetrics.ts.
 */

export interface EventoBio {
  tipo: string
  link_id: string | null
  created_at: string
}

export interface BotaoResumido {
  id: string
  rotulo: string
  cliques: number
  /** Fatia deste botão no total de cliques, em %. Null sem cliques. */
  participacao: number | null
  /** Cliques por visita, em %. Null sem visitas. */
  taxa: number | null
}

export interface ResumoBio {
  visitas: number
  cliques: number
  /** Cliques por visita no período, em %. Null sem visitas. */
  taxaGeral: number | null
  botoes: BotaoResumido[]
}

/** Cliques por visita em %, ou null quando não houve visita. */
export function taxa(cliques: number, visitas: number): number | null {
  if (visitas <= 0) return null
  return (cliques / visitas) * 100
}

/**
 * Resume os eventos do período. `botoes` traz rótulo e id de cada botão
 * cadastrado; botões sem clique aparecem com zero, para a lista não esconder
 * o que não está funcionando.
 */
export function resumirBio(
  eventos: EventoBio[],
  botoes: Array<{ id: string; rotulo: string }>
): ResumoBio {
  const visitas = eventos.filter((e) => e.tipo === 'visita').length
  const cliquesEventos = eventos.filter((e) => e.tipo === 'clique')
  const cliques = cliquesEventos.length

  const porBotao = new Map<string, number>()
  for (const evento of cliquesEventos) {
    if (!evento.link_id) continue
    porBotao.set(evento.link_id, (porBotao.get(evento.link_id) ?? 0) + 1)
  }

  const resumidos: BotaoResumido[] = botoes.map((botao) => {
    const doBotao = porBotao.get(botao.id) ?? 0
    return {
      id: botao.id,
      rotulo: botao.rotulo,
      cliques: doBotao,
      participacao: cliques > 0 ? (doBotao / cliques) * 100 : null,
      taxa: taxa(doBotao, visitas),
    }
  })

  // Mais clicado primeiro: a lista serve para decidir o que promover.
  resumidos.sort((a, b) => b.cliques - a.cliques)

  return { visitas, cliques, taxaGeral: taxa(cliques, visitas), botoes: resumidos }
}

/** Número em pt-BR com uma casa e sinal de %, ou travessão quando indefinido. */
export function formatarPercentual(valor: number | null): string {
  if (valor === null) return '—'
  return `${valor.toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`
}
