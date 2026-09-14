import { describe, expect, test } from 'vitest'
import { criarMigalhas, rotuloDoAlvo } from './migalhas'

describe('criarMigalhas', () => {
  test('guarda as últimas N, na ordem, com o tempo do relógio', () => {
    let t = 0
    const m = criarMigalhas(3, () => (t += 10))
    m.deixar('navegacao', '/a')
    m.deixar('clique', 'button: Pagar', { x: 1 })
    m.deixar('rede', '500 checkout-pagar')
    m.deixar('estado', 'offline')
    expect(m.listar()).toEqual([
      { t: 20, tipo: 'clique', texto: 'button: Pagar', dados: { x: 1 } },
      { t: 30, tipo: 'rede', texto: '500 checkout-pagar' },
      { t: 40, tipo: 'estado', texto: 'offline' },
    ])
  })
  test('texto longo é cortado; listar devolve cópia', () => {
    const m = criarMigalhas(5, () => 1)
    m.deixar('console', 'x'.repeat(500))
    const lista = m.listar()
    expect(lista[0].texto).toHaveLength(120)
    lista.push({ t: 0, tipo: 'estado', texto: 'intruso' })
    expect(m.listar()).toHaveLength(1)
  })
})

describe('rotuloDoAlvo', () => {
  test('botão: o texto visível; sobe até o interativo mais próximo', () => {
    const botao = document.createElement('button')
    botao.innerHTML = '<span>Pagar  agora</span>'
    document.body.appendChild(botao)
    expect(rotuloDoAlvo(botao.firstElementChild)).toBe('button: Pagar agora')
    botao.remove()
  })
  test('campo de texto: só o id, nunca o valor', () => {
    const input = document.createElement('input')
    input.id = 'cliente-email'
    input.value = 'segredo@x.com'
    expect(rotuloDoAlvo(input)).toBe('input#cliente-email')
  })
  test('aria-label vence o texto; sem nada, cai na tag', () => {
    const a = document.createElement('a')
    a.setAttribute('aria-label', 'Abrir menu')
    a.textContent = '≡'
    expect(rotuloDoAlvo(a)).toBe('a: Abrir menu')
    expect(rotuloDoAlvo(document.createElement('div'))).toBe('div: div')
    expect(rotuloDoAlvo(null)).toBeNull()
  })
})
