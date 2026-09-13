import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { parseAntesDepois, variacao } from './antesDepoisData'
import PortalAntesDepois from './PortalAntesDepois'

const PAYLOAD = {
  dominio: 'minhaloja.com.br',
  antes: { nota: 5.4, lcp_s: 4.1, medido_em: '2026-08-10T12:00:00.000Z' },
  depois: { nota: 6.9, lcp_s: 2.3, medido_em: '2026-09-11T12:00:00.000Z' },
  resolvidos: ['Imagens pesadas na home', 'Página sem H1'],
  novos: ['Fontes demais carregadas'],
  abertos: 3,
}

describe('parseAntesDepois', () => {
  test('aceita o payload da RPC; null e shape torto viram null', () => {
    expect(parseAntesDepois(PAYLOAD)).toEqual(PAYLOAD)
    expect(parseAntesDepois(null)).toBeNull()
    expect(parseAntesDepois({ ...PAYLOAD, abertos: -1 })).toBeNull()
    expect(parseAntesDepois({ ...PAYLOAD, resolvidos: 'x' })).toBeNull()
  })
})

describe('variacao', () => {
  test('um décimo com sinal; null quando falta nota', () => {
    expect(variacao(5.4, 6.9)).toBe('+1,5')
    expect(variacao(6.9, 5.4)).toBe('−1,5')
    expect(variacao(5.4, 5.44)).toBe('0,0')
    expect(variacao(null, 6)).toBeNull()
  })
})

describe('PortalAntesDepois', () => {
  test('nota antes/agora com a variação, LCP, contagem e lista dos resolvidos, com a ressalva', () => {
    render(<PortalAntesDepois dados={PAYLOAD} />)
    const bloco = screen.getByTestId('portal-antes-depois')
    expect(bloco).toHaveTextContent('5,4')
    expect(bloco).toHaveTextContent('6,9')
    expect(bloco).toHaveTextContent('+1,5')
    expect(bloco).toHaveTextContent('4,1 s')
    expect(bloco).toHaveTextContent('2,3 s')
    expect(bloco).toHaveTextContent('2 resolvidos')
    expect(bloco).toHaveTextContent('3 abertos · 1 novo')
    expect(screen.getByRole('list', { name: 'Problemas resolvidos' })).toHaveTextContent('Imagens pesadas na home')
    expect(bloco).toHaveTextContent('não atribuem vendas')
  })

  test('sem resolvidos não desenha a lista; nota ausente vira travessão', () => {
    render(
      <PortalAntesDepois
        dados={{ ...PAYLOAD, resolvidos: [], novos: [], abertos: 0, depois: { nota: null, lcp_s: null, medido_em: PAYLOAD.depois.medido_em } }}
      />
    )
    expect(screen.queryByRole('list', { name: 'Problemas resolvidos' })).not.toBeInTheDocument()
    expect(screen.getByTestId('portal-antes-depois')).toHaveTextContent('0 resolvidos')
    expect(screen.getByTestId('portal-antes-depois')).toHaveTextContent('0 abertos')
  })
})
