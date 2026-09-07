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

export interface MesResumido {
  /** Chave ordenável do mês, no fuso de São Paulo (ex.: "2026-09"). */
  mes: string
  /** Rótulo curto para a UI (ex.: "set/26"). */
  rotulo: string
  visitas: number
  cliques: number
  /** Cliques por visita no mês, em %. Null sem visitas. */
  taxa: number | null
}

const FUSO = 'America/Sao_Paulo'

/** "2026-09" a partir de um ISO, no fuso de São Paulo (e não em UTC). */
export function chaveMes(iso: string): string | null {
  const data = new Date(iso)
  if (Number.isNaN(data.getTime())) return null
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(data)
  const ano = partes.find((p) => p.type === 'year')?.value
  const mes = partes.find((p) => p.type === 'month')?.value
  return ano && mes ? `${ano}-${mes}` : null
}

/** "set/26" a partir de "2026-09". */
export function rotuloMes(chave: string): string {
  const [ano, mes] = chave.split('-')
  const data = new Date(Number(ano), Number(mes) - 1, 1)
  const nome = new Intl.DateTimeFormat('pt-BR', { month: 'short' })
    .format(data)
    .replace('.', '')
  return `${nome}/${ano.slice(2)}`
}

/**
 * Visitas e cliques mês a mês, do mais recente para o mais antigo. Os últimos
 * `meses` aparecem sempre, mesmo zerados, para a queda de um mês ficar
 * visível em vez de sumir da lista.
 */
export function resumirPorMes(
  eventos: EventoBio[],
  meses = 6,
  agora: Date = new Date()
): MesResumido[] {
  const contagem = new Map<string, { visitas: number; cliques: number }>()
  for (const evento of eventos) {
    const chave = chaveMes(evento.created_at)
    if (!chave) continue
    const atual = contagem.get(chave) ?? { visitas: 0, cliques: 0 }
    if (evento.tipo === 'visita') atual.visitas += 1
    if (evento.tipo === 'clique') atual.cliques += 1
    contagem.set(chave, atual)
  }

  const hoje = chaveMes(agora.toISOString())
  const chaves: string[] = []
  if (hoje) {
    const [ano, mes] = hoje.split('-').map(Number)
    for (let i = 0; i < meses; i += 1) {
      const d = new Date(Date.UTC(ano, mes - 1 - i, 1))
      chaves.push(
        `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
      )
    }
  }
  // Meses com evento fora da janela pedida não somem da lista.
  for (const chave of contagem.keys()) {
    if (!chaves.includes(chave)) chaves.push(chave)
  }

  return chaves
    .sort((a, b) => b.localeCompare(a))
    .map((chave) => {
      const { visitas, cliques } = contagem.get(chave) ?? {
        visitas: 0,
        cliques: 0,
      }
      return {
        mes: chave,
        rotulo: rotuloMes(chave),
        visitas,
        cliques,
        taxa: taxa(cliques, visitas),
      }
    })
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
