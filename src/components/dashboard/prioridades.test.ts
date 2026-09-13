import { describe, expect, test } from 'vitest'
import type { ItemDaFila } from '../comercial/fila'
import { diasAte, montarPrioridades } from './prioridades'
import type { EntradasDoRanking } from './prioridades'

const HOJE = '2026-09-13'

/** `Intl` separa "R$" do número com espaço fino; o teste compara texto comum. */
const texto = (t: string) => t.replace(/\u00a0/g, ' ')

const itemDaFila = (o: Partial<ItemDaFila>): ItemDaFila => ({
  project_id: 'p1',
  projeto: 'Correção da loja',
  status: 'lead',
  client_id: 'c1',
  cliente: 'Ana Silva',
  empresa: null,
  responsavel_id: null,
  responsavel: null,
  proxima_acao: null,
  proxima_acao_em: null,
  valor_estimado: null,
  previsao_fechamento: null,
  updated_at: '2026-09-10T12:00:00.000Z',
  comprou_plano: false,
  pediu_ajuda: null,
  reuniao_em: null,
  relatorio_aberto_em: null,
  tickets_abertos: 0,
  ...o,
})

const vazio: EntradasDoRanking = {
  hoje: HOJE,
  recebiveis: [],
  propostas: [],
  briefings: [],
  nudges: [],
  fila: [],
  projetos: [
    { id: 'p1', nome: 'Correção da loja', client_id: 'c1', cliente: 'Ana Silva' },
    { id: 'p2', nome: 'Site novo', client_id: 'c2', cliente: 'Bruno Costa' },
    { id: 'p3', nome: 'Projeto órfão', client_id: null, cliente: null },
  ],
}

describe('diasAte', () => {
  test('conta dias inteiros entre datas; futuro é negativo', () => {
    expect(diasAte('2026-09-09', HOJE)).toBe(4)
    expect(diasAte(HOJE, HOJE)).toBe(0)
    expect(diasAte('2026-09-20', HOJE)).toBe(-7)
  })
})

describe('montarPrioridades', () => {
  test('um cliente com três problemas vira UM cartão com três motivos e o porquê resumido', () => {
    const cartoes = montarPrioridades({
      ...vazio,
      recebiveis: [
        { id: 'r1', descricao: 'Parcela 2', valor: 3200, vencimento: '2026-09-09', status: 'pendente', project_id: 'p1', client_id: 'c1' },
        { id: 'r2', descricao: 'Ainda no prazo', valor: 900, vencimento: '2026-09-20', status: 'pendente', project_id: 'p1', client_id: 'c1' },
        { id: 'r3', descricao: 'Já paga', valor: 900, vencimento: '2026-09-01', status: 'pago', project_id: 'p1', client_id: 'c1' },
      ],
      propostas: [
        { id: 'pr1', titulo: 'Fase 2', valor_total: 5000, status: 'enviada', sent_at: '2026-09-10T10:00:00.000Z', created_at: '2026-09-09T10:00:00.000Z', project_id: 'p1' },
      ],
      nudges: [
        { id: 'n1', tipo: 'projeto_parado', severidade: 'atencao', titulo: 'Projeto parado', descricao: 'sem atividade há 10 dias', link: null, project_id: 'p1', client_id: null, created_at: '2026-09-03T00:00:00.000Z' },
        // Redundante: o recebível vencido já está no cartão.
        { id: 'n2', tipo: 'pagamento_atrasado', severidade: 'urgente', titulo: 'Pagamento atrasado', descricao: null, link: null, project_id: 'p1', client_id: 'c1', created_at: '2026-09-10T00:00:00.000Z' },
      ],
    })

    expect(cartoes).toHaveLength(1)
    const [ana] = cartoes
    expect(ana.chave).toBe('cliente:c1')
    expect(ana.nome).toBe('Ana Silva')
    expect(ana.link).toBe('/admin/clientes/c1')
    expect(ana.projectId).toBe('p1')
    expect(ana.motivos.map((m) => m.tipo)).toEqual(['recebivel_vencido', 'proposta_sem_resposta', 'nudge'])
    expect(texto(ana.motivos[0].texto)).toBe('R$ 3.200 vencidos há 4 dias — Parcela 2')
    expect(texto(ana.motivos[1].texto)).toBe('proposta de R$ 5.000 sem resposta há 3 dias')
    expect(texto(ana.porque)).toBe('R$ 3.200 vencidos há 4 dias — Parcela 2 · +2')
    expect(ana.valor).toBe(8200)
    expect(ana.motivos[2].nudgeId).toBe('n1')
  })

  test('ordena por urgência × valor × intenção: sinal forte do Scan passa na frente de briefing parado', () => {
    const cartoes = montarPrioridades({
      ...vazio,
      briefings: [{ id: 'b1', status: 'enviado', project_id: 'p2' }],
      fila: [itemDaFila({ comprou_plano: true, pediu_ajuda: 'não sei mexer no tema', valor_estimado: 1500 })],
    })
    expect(cartoes.map((c) => c.nome)).toEqual(['Ana Silva', 'Bruno Costa'])
    expect(cartoes[0].motivos[0].tipo).toBe('sinal_scan')
    expect(cartoes[0].motivos[0].texto).toContain('comprou o plano')
    expect(cartoes[1].porque).toBe('briefing enviado e ainda não preenchido')
  })

  test('ação combinada para o futuro não entra; vencida entra com o atraso', () => {
    const cartoes = montarPrioridades({
      ...vazio,
      fila: [
        itemDaFila({ project_id: 'p1', proxima_acao: 'Ligar', proxima_acao_em: '2026-09-11' }),
        itemDaFila({ project_id: 'p2', client_id: 'c2', cliente: 'Bruno Costa', proxima_acao: 'Enviar proposta', proxima_acao_em: '2026-09-20' }),
      ],
    })
    expect(cartoes).toHaveLength(1)
    expect(cartoes[0].motivos[0].texto).toBe('Ligar — venceu há 2 dias')
    expect(cartoes[0].motivos[0].urgencia).toBe(2)
  })

  test('dado sem cliente agrupa por projeto; sem projeto, fica sozinho', () => {
    const cartoes = montarPrioridades({
      ...vazio,
      briefings: [{ id: 'b1', status: 'enviado', project_id: 'p3' }],
      nudges: [
        { id: 'n1', tipo: 'onboarding', severidade: 'info', titulo: 'Onboarding parado', descricao: null, link: '/admin/projetos/p3', project_id: 'p3', client_id: null, created_at: '2026-09-12T00:00:00.000Z' },
        { id: 'n9', tipo: 'onboarding', severidade: 'info', titulo: 'Sem dono', descricao: null, link: null, project_id: null, client_id: null, created_at: '2026-09-12T00:00:00.000Z' },
      ],
    })
    expect(cartoes.map((c) => c.chave).sort()).toEqual(['nudge:n9', 'projeto:p3'])
    const orfao = cartoes.find((c) => c.chave === 'projeto:p3')
    expect(orfao?.nome).toBe('Projeto órfão')
    expect(orfao?.motivos).toHaveLength(2)
    expect(orfao?.link).toBe('/admin/projetos/p3')
  })

  test('sem nada, lista vazia', () => {
    expect(montarPrioridades(vazio)).toEqual([])
  })
})
