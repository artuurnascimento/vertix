/**
 * O funil por PESSOA. Cada linha de `funil_pessoas` é um e-mail com a data
 * em que atingiu cada etapa; contar documentos (propostas ÷ projetos) dava
 * 300 % quando um projeto tinha três propostas.
 */

export interface PessoaNoFunil {
  email: string
  origem: string | null
  campanha: string | null
  lead_em: string | null
  relatorio_em: string | null
  compra_em: string | null
  reuniao_em: string | null
  contratado_em: string | null
  recorrencia_em: string | null
}

export interface EtapaDoFunil {
  chave: string
  label: string
  count: number
  /** % em relação à etapa anterior — null na primeira. */
  conversao: number | null
}

export const ETAPAS: readonly { chave: keyof PessoaNoFunil; label: string }[] = [
  { chave: 'lead_em', label: 'Leads captados' },
  { chave: 'relatorio_em', label: 'Abriram o relatório' },
  { chave: 'compra_em', label: 'Compraram o plano' },
  { chave: 'reuniao_em', label: 'Marcaram reunião' },
  { chave: 'contratado_em', label: 'Contrataram implementação' },
  { chave: 'recorrencia_em', label: 'Recorrência' },
]

/** Pessoas por etapa, com a conversão etapa a etapa. */
export function etapasDoFunil(pessoas: readonly PessoaNoFunil[]): EtapaDoFunil[] {
  return ETAPAS.reduce<EtapaDoFunil[]>((acc, etapa) => {
    const count = pessoas.filter((p) => p[etapa.chave] !== null).length
    const anterior = acc[acc.length - 1]
    acc.push({
      chave: etapa.chave,
      label: etapa.label,
      count,
      conversao: anterior ? (anterior.count > 0 ? (count / anterior.count) * 100 : null) : null,
    })
    return acc
  }, [])
}

/**
 * Propostas por projeto único: um projeto com três propostas enviadas conta
 * uma vez em "enviada" e, se qualquer uma foi aceita, uma vez em "aceita".
 */
export function funilDePropostas(
  propostas: readonly { project_id: string | null; sent_at: string | null; status: string }[]
): { projetos: number; enviadas: number; aceitas: number } {
  const porProjeto = new Map<string, { enviada: boolean; aceita: boolean }>()
  for (const p of propostas) {
    const chave = p.project_id ?? `sem-projeto:${Math.random()}`
    const atual = porProjeto.get(chave) ?? { enviada: false, aceita: false }
    porProjeto.set(chave, {
      enviada: atual.enviada || p.sent_at !== null,
      aceita: atual.aceita || p.status === 'aceita',
    })
  }
  const valores = [...porProjeto.values()]
  return {
    projetos: valores.length,
    enviadas: valores.filter((v) => v.enviada).length,
    aceitas: valores.filter((v) => v.aceita).length,
  }
}
