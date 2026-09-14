import { afterAll, beforeEach, describe, expect, test, vi } from 'vitest'

/**
 * Os ganchos globais. O núcleo (`./index`) é substituído por um dublê:
 * aqui o que importa é QUAL evento do navegador vira QUAL entrada.
 */
const { registrado, migalha, descarregado } = vi.hoisted(() => ({
  registrado: vi.fn(),
  migalha: vi.fn(),
  descarregado: vi.fn(),
}))
vi.mock('./index', () => ({
  log: {
    debug: (...a: unknown[]) => registrado('debug', ...a),
    info: (...a: unknown[]) => registrado('info', ...a),
    aviso: (...a: unknown[]) => registrado('aviso', ...a),
    erro: (...a: unknown[]) => registrado('erro', ...a),
    fatal: (...a: unknown[]) => registrado('fatal', ...a),
  },
  migalhas: { deixar: migalha, listar: () => [] },
  descarregar: descarregado,
  serializarErro: (e: unknown) => (e instanceof Error ? { nome: e.name, mensagem: e.message } : { valor: String(e) }),
}))

import { instalarLogGlobal } from './instalar'

const consoleErrorOriginal = console.error
const consoleWarnOriginal = console.warn

beforeEach(() => {
  registrado.mockReset()
  migalha.mockReset()
  descarregado.mockReset()
  instalarLogGlobal(window)
})
// Os ganchos se instalam UMA vez por página (e por suíte): o console só
// volta ao original no fim.
afterAll(() => {
  console.error = consoleErrorOriginal
  console.warn = consoleWarnOriginal
})

describe('instalarLogGlobal', () => {
  test('exceção não tratada vira erro com arquivo e linha', () => {
    window.dispatchEvent(new ErrorEvent('error', { message: 'x is undefined', error: new TypeError('x is undefined'), filename: 'https://pay.vertix.studio/assets/a.js', lineno: 12, colno: 3 }))
    expect(registrado).toHaveBeenCalledWith('erro', 'janela', 'excecao_nao_tratada', 'x is undefined', {
      detalhes: { nome: 'TypeError', mensagem: 'x is undefined', arquivo: '/assets/a.js', linha: 12, coluna: 3 },
    })
  })

  test('ruído conhecido (ResizeObserver, "Script error.") é ignorado', () => {
    window.dispatchEvent(new ErrorEvent('error', { message: 'ResizeObserver loop completed with undelivered notifications.' }))
    window.dispatchEvent(new ErrorEvent('error', { message: 'Script error.' }))
    expect(registrado).not.toHaveBeenCalled()
  })

  test('recurso que não carregou vira aviso com a URL', () => {
    const script = document.createElement('script')
    script.src = 'https://sdk.mercadopago.com/js/v2'
    document.head.appendChild(script)
    script.dispatchEvent(new Event('error'))
    expect(registrado).toHaveBeenCalledWith('aviso', 'recurso', 'recurso_nao_carregou', expect.stringContaining('script não carregou'), expect.objectContaining({ detalhes: expect.objectContaining({ externo: true }) }))
    script.remove()
  })

  test('promessa rejeitada vira erro', () => {
    const evento = new Event('unhandledrejection') as Event & { reason: unknown }
    evento.reason = new Error('sem catch')
    window.dispatchEvent(evento)
    expect(registrado).toHaveBeenCalledWith('erro', 'janela', 'promessa_rejeitada', 'sem catch', { detalhes: { nome: 'Error', mensagem: 'sem catch' } })
  })

  test('bloqueio de CSP vira erro com diretiva e URL bloqueada', () => {
    const evento = new Event('securitypolicyviolation') as Event & Record<string, unknown>
    Object.assign(evento, { violatedDirective: 'script-src', blockedURI: 'https://sdk.mercadopago.com/js/v2', sourceFile: '', lineNumber: 0, disposition: 'enforce' })
    window.dispatchEvent(evento)
    expect(registrado).toHaveBeenCalledWith('erro', 'csp', 'csp_bloqueou', 'script-src bloqueou https://sdk.mercadopago.com/js/v2', expect.objectContaining({ detalhes: expect.objectContaining({ diretiva: 'script-src' }) }))
  })

  test('console.error de terceiros vira erro; o espelho do próprio log não volta', () => {
    console.error('[checkout] Brick error:', new Error('brick'))
    expect(registrado).toHaveBeenCalledWith('erro', 'console', 'console_erro', '[checkout] Brick error: brick', { detalhes: { nome: 'Error', mensagem: 'brick' } })
    registrado.mockReset()
    console.error('[render] render_quebrou: TypeError', {})
    expect(registrado).not.toHaveBeenCalled()
  })

  test('console.warn só deixa migalha', () => {
    console.warn('atenção', 42)
    expect(migalha).toHaveBeenCalledWith('console', 'atenção 42')
    expect(registrado).not.toHaveBeenCalled()
  })

  test('clique e navegação deixam migalhas', () => {
    const botao = document.createElement('button')
    botao.textContent = 'Pagar'
    document.body.appendChild(botao)
    botao.click()
    expect(migalha).toHaveBeenCalledWith('clique', 'button: Pagar')
    window.history.pushState({}, '', '/admin/logs?t=segredo')
    expect(migalha).toHaveBeenCalledWith('navegacao', '/admin/logs?t=%5Boculto%5D')
    botao.remove()
  })

  test('saída da página descarrega com keepalive', () => {
    window.dispatchEvent(new Event('pagehide'))
    expect(descarregado).toHaveBeenCalledWith(true)
  })
})
