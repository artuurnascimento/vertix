/**
 * Painel "Automações" (jornada, fase 5): o que roda sozinho, quando rodou
 * pela última vez e o que falhou. Duas fontes: `job_status` (batimento das
 * varreduras do worker do Scan, uma linha por rotina) e `job_runs` (trilha
 * do cron do Postgres, uma linha por disparo). Puro; a busca fica em
 * automacoesData.ts.
 */

export interface LinhaDeJobStatus {
  job: string
  origem: string
  ultimo_inicio: string | null
  ultimo_ok: string | null
  ultimo_erro: string | null
  erro: string | null
  itens: number | null
  updated_at: string
}

export interface LinhaDeJobRun {
  id: string
  job: string
  status: string
  itens: number
  detalhe: string | null
  created_at: string
}

export type SaudeDaRotina = 'ok' | 'falhou' | 'parada' | 'nunca'

export interface RotinaDoWorker {
  job: string
  rotulo: string
  descricao: string
  saude: SaudeDaRotina
  ultimoOk: string | null
  ultimoErro: string | null
  erro: string | null
  itens: number | null
}

export interface RotinaDoCron {
  job: string
  rotulo: string
  agenda: string
  ultimaExecucao: string | null
  ultimoStatus: string | null
  ultimosItens: number | null
  ultimoDetalhe: string | null
  falhas7d: number
  execucoes7d: number
  saude: SaudeDaRotina
}

export interface EntregaPendente {
  tipo: 'pedido' | 'compra'
  id: string
  pago_em: string
  cliente: string | null
  email: string | null
  valor: number | string | null
  faltando: string
  plano_code: string | null
}

const MS_POR_MINUTO = 60_000
const MS_POR_DIA = 24 * 60 * MS_POR_MINUTO
/** Varredura roda a cada minuto e grava OK a cada 5; 15 min sem sinal é parada. */
const VARREDURA_PARADA_APOS_MS = 15 * MS_POR_MINUTO
const JANELA_DE_FALHAS_DIAS = 7

/** As nove varreduras do worker (server.ts) — a ordem é a de importância para o negócio. */
export const ROTINAS_DO_WORKER: readonly { job: string; rotulo: string; descricao: string }[] = [
  { job: 'entregas-pendentes', rotulo: 'Entrega de compra paga', descricao: 'Compra do Scan paga que o webhook não avisou: gera plano e recibo.' },
  { job: 'pedidos-pendentes', rotulo: 'Entrega de pedido pago', descricao: 'Pedido do checkout pago sem recibo: entrega e recibo.' },
  { job: 'itens-sem-entrega', rotulo: 'Correção Aplicada sem entrega', descricao: 'Upsell pago sem confirmação: abre a fila e confirma por e-mail.' },
  { job: 'analises-presas', rotulo: 'Análises presas', descricao: 'Raio-X que ficou no meio do caminho volta para a fila.' },
  { job: 'reanalises', rotulo: 'Reanálise de 30 dias', descricao: 'Roda o Scan de novo um mês depois da compra.' },
  { job: 'medicoes', rotulo: 'Medições do acompanhamento', descricao: 'Semanas 1, 2 e 3 do Acompanhamento de 30 dias.' },
  { job: 'sequencia-emails', rotulo: 'Sequência de e-mails', descricao: 'Quem abriu o relatório e não comprou.' },
  { job: 'recuperacao-checkout', rotulo: 'Recuperação de checkout', descricao: 'Quem abriu o checkout e não pagou.' },
  { job: 'acompanhamento', rotulo: 'Acompanhamento pós-venda', descricao: 'Três dias depois do plano: "quer ajuda para aplicar?".' },
]

/** Rotinas do cron do Postgres (migração scheduler_cobranca e onboarding_nudges). */
export const ROTINAS_DO_CRON: readonly { job: string; rotulo: string; agenda: string }[] = [
  { job: 'lembretes-pagamento', rotulo: 'Lembretes de pagamento', agenda: 'todo dia às 9h' },
  { job: 'varredura-nudges', rotulo: 'Varredura de nudges', agenda: 'todo dia às 8h' },
  { job: 'cobranca-recorrente', rotulo: 'Cobrança recorrente', agenda: 'dia 1 de cada mês' },
]

function ms(iso: string | null): number | null {
  if (!iso) return null
  const t = Date.parse(iso)
  return Number.isFinite(t) ? t : null
}

export function saudeDaVarredura(linha: LinhaDeJobStatus | undefined, agora: Date): SaudeDaRotina {
  if (!linha) return 'nunca'
  const ok = ms(linha.ultimo_ok)
  const erro = ms(linha.ultimo_erro)
  if (erro !== null && (ok === null || erro > ok)) return 'falhou'
  if (ok === null) return 'nunca'
  return agora.getTime() - ok > VARREDURA_PARADA_APOS_MS ? 'parada' : 'ok'
}

/** As rotinas do worker na ordem fixa, cada uma com o que a tabela sabe dela. */
export function rotinasDoWorker(linhas: readonly LinhaDeJobStatus[], agora: Date): RotinaDoWorker[] {
  const porJob = new Map(linhas.map((l) => [l.job, l] as const))
  const conhecidas = ROTINAS_DO_WORKER.map((r) => {
    const linha = porJob.get(r.job)
    return {
      ...r,
      saude: saudeDaVarredura(linha, agora),
      ultimoOk: linha?.ultimo_ok ?? null,
      ultimoErro: linha?.ultimo_erro ?? null,
      erro: linha?.erro ?? null,
      itens: linha?.itens ?? null,
    }
  })
  // Rotina que o worker ganhou depois desta tela ainda aparece — sem descrição.
  const extras = linhas
    .filter((l) => l.origem === 'worker' && !ROTINAS_DO_WORKER.some((r) => r.job === l.job))
    .map((l) => ({
      job: l.job,
      rotulo: l.job,
      descricao: '',
      saude: saudeDaVarredura(l, agora),
      ultimoOk: l.ultimo_ok,
      ultimoErro: l.ultimo_erro,
      erro: l.erro,
      itens: l.itens,
    }))
  return [...conhecidas, ...extras]
}

/** Última execução e falhas recentes de cada rotina do cron, a partir da trilha. */
export function resumirCron(runs: readonly LinhaDeJobRun[], agora: Date): RotinaDoCron[] {
  const desde = agora.getTime() - JANELA_DE_FALHAS_DIAS * MS_POR_DIA
  const porJob = new Map<string, LinhaDeJobRun[]>()
  for (const run of runs) {
    const lista = porJob.get(run.job) ?? []
    lista.push(run)
    porJob.set(run.job, lista)
  }
  const jobs = [
    ...ROTINAS_DO_CRON,
    ...[...porJob.keys()]
      .filter((job) => !ROTINAS_DO_CRON.some((r) => r.job === job))
      .map((job) => ({ job, rotulo: job, agenda: '' })),
  ]
  return jobs.map((r) => {
    const lista = [...(porJob.get(r.job) ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at))
    const ultima = lista[0]
    const recentes = lista.filter((run) => (ms(run.created_at) ?? 0) >= desde)
    const falhas7d = recentes.filter((run) => run.status === 'erro').length
    let saude: SaudeDaRotina = 'nunca'
    if (ultima) saude = ultima.status === 'erro' ? 'falhou' : 'ok'
    return {
      ...r,
      ultimaExecucao: ultima?.created_at ?? null,
      ultimoStatus: ultima?.status ?? null,
      ultimosItens: ultima?.itens ?? null,
      ultimoDetalhe: ultima?.detalhe ?? null,
      falhas7d,
      execucoes7d: recentes.length,
      saude,
    }
  })
}

/** "há 3 min", "há 2 h", "há 4 dias" — o tempo desde o instante, curto. */
export function haQuanto(iso: string | null, agora: Date): string {
  const t = ms(iso)
  if (t === null) return 'nunca'
  const diff = Math.max(0, agora.getTime() - t)
  const minutos = Math.round(diff / MS_POR_MINUTO)
  if (minutos < 1) return 'agora'
  if (minutos < 60) return `há ${minutos} min`
  const horas = Math.round(minutos / 60)
  if (horas < 48) return `há ${horas} h`
  const dias = Math.round(horas / 24)
  return `há ${dias} dias`
}

export function normalizarEntregasPendentes(valor: unknown): EntregaPendente[] {
  if (!Array.isArray(valor)) return []
  const saida: EntregaPendente[] = []
  for (const bruto of valor) {
    const d = bruto as Record<string, unknown> | null
    if (!d || typeof d !== 'object') continue
    if (d.tipo !== 'pedido' && d.tipo !== 'compra') continue
    if (typeof d.id !== 'string' || typeof d.pago_em !== 'string') continue
    saida.push({
      tipo: d.tipo,
      id: d.id,
      pago_em: d.pago_em,
      cliente: typeof d.cliente === 'string' ? d.cliente : null,
      email: typeof d.email === 'string' ? d.email : null,
      valor: typeof d.valor === 'number' || typeof d.valor === 'string' ? d.valor : null,
      faltando: typeof d.faltando === 'string' ? d.faltando : 'entrega',
      plano_code: typeof d.plano_code === 'string' ? d.plano_code : null,
    })
  }
  return saida.sort((a, b) => a.pago_em.localeCompare(b.pago_em))
}
