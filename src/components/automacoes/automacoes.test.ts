import { describe, expect, test } from 'vitest'
import {
  ROTINAS_DO_WORKER,
  haQuanto,
  normalizarEntregasPendentes,
  resumirCron,
  rotinasDoWorker,
  saudeDaVarredura,
} from './automacoes'
import type { LinhaDeJobRun, LinhaDeJobStatus } from './automacoes'

const AGORA = new Date('2026-09-13T12:00:00Z')
const min = (n: number) => new Date(AGORA.getTime() - n * 60_000).toISOString()
const dia = (n: number) => new Date(AGORA.getTime() - n * 24 * 60 * 60_000).toISOString()

const status = (o: Partial<LinhaDeJobStatus>): LinhaDeJobStatus => ({
  job: 'x',
  origem: 'worker',
  ultimo_inicio: null,
  ultimo_ok: null,
  ultimo_erro: null,
  erro: null,
  itens: null,
  updated_at: AGORA.toISOString(),
  ...o,
})

describe('saudeDaVarredura', () => {
  test('ok recente = rodando; ok velho = parada; erro depois do ok = falhou; nada = nunca', () => {
    expect(saudeDaVarredura(status({ ultimo_ok: min(3) }), AGORA)).toBe('ok')
    expect(saudeDaVarredura(status({ ultimo_ok: min(40) }), AGORA)).toBe('parada')
    expect(saudeDaVarredura(status({ ultimo_ok: min(3), ultimo_erro: min(1), erro: 'boom' }), AGORA)).toBe('falhou')
    // Falhou há uma hora mas voltou a rodar: o que vale é o mais recente.
    expect(saudeDaVarredura(status({ ultimo_ok: min(3), ultimo_erro: min(60) }), AGORA)).toBe('ok')
    expect(saudeDaVarredura(status({ ultimo_erro: min(200), erro: 'x' }), AGORA)).toBe('falhou')
    expect(saudeDaVarredura(undefined, AGORA)).toBe('nunca')
  })
})

describe('rotinasDoWorker', () => {
  test('as nove rotinas na ordem fixa, mesmo sem linha; extras desconhecidas no fim', () => {
    const linhas = [
      status({ job: 'medicoes', ultimo_ok: min(2), itens: 3 }),
      status({ job: 'rotina-nova', ultimo_ok: min(1) }),
      status({ job: 'cron-coisa', origem: 'cron', ultimo_ok: min(1) }),
    ]
    const r = rotinasDoWorker(linhas, AGORA)
    expect(r.map((x) => x.job)).toEqual([...ROTINAS_DO_WORKER.map((x) => x.job), 'rotina-nova'])
    expect(r.find((x) => x.job === 'medicoes')).toMatchObject({ saude: 'ok', itens: 3, rotulo: 'Medições do acompanhamento' })
    expect(r.find((x) => x.job === 'entregas-pendentes')).toMatchObject({ saude: 'nunca', ultimoOk: null })
  })
})

describe('resumirCron', () => {
  const run = (o: Partial<LinhaDeJobRun>): LinhaDeJobRun => ({
    id: Math.random().toString(36).slice(2),
    job: 'lembretes-pagamento',
    status: 'ok',
    itens: 0,
    detalhe: null,
    created_at: dia(1),
    ...o,
  })

  test('última execução, itens e falhas nos últimos 7 dias, por rotina', () => {
    const r = resumirCron(
      [
        run({ created_at: dia(1), itens: 4, detalhe: '4 lembretes' }),
        run({ created_at: dia(2), status: 'erro', detalhe: 'SMTP' }),
        run({ created_at: dia(9), status: 'erro' }), // fora da janela
        run({ job: 'varredura-nudges', created_at: dia(0), status: 'ok', itens: 2 }),
        run({ job: 'cobranca-recorrente', created_at: dia(12), status: 'pulado', detalhe: 'sem assinaturas' }),
      ],
      AGORA
    )
    expect(r.map((x) => x.job)).toEqual(['lembretes-pagamento', 'varredura-nudges', 'cobranca-recorrente'])
    expect(r[0]).toMatchObject({ saude: 'ok', ultimosItens: 4, ultimoDetalhe: '4 lembretes', falhas7d: 1, execucoes7d: 2 })
    expect(r[1]).toMatchObject({ saude: 'ok', falhas7d: 0, execucoes7d: 1 })
    // "pulado" não é falha; e sem execução na janela conta zero.
    expect(r[2]).toMatchObject({ saude: 'ok', ultimoStatus: 'pulado', falhas7d: 0, execucoes7d: 0 })
  })

  test('rotina que nunca rodou aparece como "nunca"', () => {
    expect(resumirCron([], AGORA).every((x) => x.saude === 'nunca')).toBe(true)
  })
})

describe('haQuanto', () => {
  test('agora, minutos, horas, dias, nunca', () => {
    expect(haQuanto(min(0), AGORA)).toBe('agora')
    expect(haQuanto(min(7), AGORA)).toBe('há 7 min')
    expect(haQuanto(min(150), AGORA)).toBe('há 3 h')
    expect(haQuanto(dia(4), AGORA)).toBe('há 4 dias')
    expect(haQuanto(null, AGORA)).toBe('nunca')
  })
})

describe('normalizarEntregasPendentes', () => {
  test('mantém só linhas válidas, ordena da mais antiga para a mais nova', () => {
    const r = normalizarEntregasPendentes([
      { tipo: 'pedido', id: 'p2', pago_em: dia(1), cliente: 'B', email: 'b@x', valor: '197.00', faltando: 'plano', plano_code: null },
      { tipo: 'compra', id: 'c1', pago_em: dia(3), cliente: null, email: null, valor: 197, faltando: 'plano e recibo', plano_code: 'ABC' },
      { tipo: 'outro', id: 'x', pago_em: dia(1) },
      null,
    ])
    expect(r.map((e) => e.id)).toEqual(['c1', 'p2'])
    expect(r[0]).toMatchObject({ tipo: 'compra', cliente: null, plano_code: 'ABC' })
    expect(normalizarEntregasPendentes('x')).toEqual([])
  })
})
