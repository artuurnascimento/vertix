import type {
  BriefingFieldTipo,
  BriefingIlustracao,
  BriefingPergunta,
} from '../../lib/briefing'

/**
 * Helpers puros do rascunho do editor de templates: criação, reordenação e
 * contagem de alterações. Tudo imutável — nunca modifica a lista recebida.
 */

export const TIPO_CAMPO_LABELS: Record<BriefingFieldTipo, string> = {
  texto: 'Texto curto',
  textarea: 'Texto longo',
  select: 'Seleção',
  numero: 'Número',
  escolha_visual: 'Escolha visual',
}

/** Nomes legíveis das ilustrações no editor de opções visuais. */
export const ILUSTRACAO_LABELS: Record<BriefingIlustracao, string> = {
  loja: 'Loja virtual',
  catalogo: 'Catálogo de produtos',
  pagamento: 'Pagamento',
  entrega: 'Entrega',
  identidade_visual: 'Identidade visual',
  estilo_minimalista: 'Estilo minimalista',
  estilo_vibrante: 'Estilo vibrante',
  estilo_premium: 'Estilo sofisticado',
  automacao: 'Automação',
  usuarios: 'Usuários',
  integracoes: 'Integrações',
  site_paginas: 'Páginas do site',
  conteudo: 'Conteúdo',
  agendamento: 'Agendamento',
  metas: 'Metas',
}

const NEW_ID_LENGTH = 8

/**
 * Cria pergunta nova com id imutável `q_<uuid8>`. O id nunca é editável e é
 * preservado em qualquer edição — as respostas antigas são keyed por ele.
 */
export function createPergunta(): BriefingPergunta {
  return {
    id: `q_${crypto.randomUUID().slice(0, NEW_ID_LENGTH)}`,
    label: '',
    tipo: 'texto',
    obrigatoria: false,
  }
}

/** Move a pergunta de `index` uma posição para cima/baixo (retorna nova lista). */
export function movePergunta(
  list: readonly BriefingPergunta[],
  index: number,
  delta: -1 | 1
): BriefingPergunta[] {
  const target = index + delta
  if (target < 0 || target >= list.length) return [...list]
  const next = [...list]
  const [moved] = next.splice(index, 1)
  next.splice(target, 0, moved)
  return next
}

/** Rascunho difere do salvo? Comparação estrutural via JSON (ordem inclusa). */
export function isDraftDirty(
  saved: readonly BriefingPergunta[],
  draft: readonly BriefingPergunta[] | null
): boolean {
  if (draft === null) return false
  return JSON.stringify(saved) !== JSON.stringify(draft)
}

/**
 * Conta alterações do rascunho vs. salvo: perguntas novas, removidas e
 * editadas, mais 1 se a ordem relativa das perguntas mantidas mudou.
 */
export function countChanges(
  saved: readonly BriefingPergunta[],
  draft: readonly BriefingPergunta[]
): number {
  const savedById = new Map(saved.map((p) => [p.id, p]))
  const draftById = new Map(draft.map((p) => [p.id, p]))
  let changes = 0

  for (const pergunta of saved) {
    if (!draftById.has(pergunta.id)) changes += 1
  }
  for (const pergunta of draft) {
    const previous = savedById.get(pergunta.id)
    if (!previous) {
      changes += 1
      continue
    }
    if (JSON.stringify(previous) !== JSON.stringify(pergunta)) changes += 1
  }

  const savedOrder = saved
    .filter((p) => draftById.has(p.id))
    .map((p) => p.id)
    .join('|')
  const draftOrder = draft
    .filter((p) => savedById.has(p.id))
    .map((p) => p.id)
    .join('|')
  if (savedOrder !== draftOrder) changes += 1

  return changes
}
