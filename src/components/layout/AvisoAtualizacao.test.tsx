import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'

const { estado } = vi.hoisted(() => ({
  estado: { nova: null as null | { versao: string; data: string; titulo: string; itens: string[] } },
}))
vi.mock('../../lib/versao', () => ({ useVersaoNova: () => estado.nova }))

import AvisoAtualizacao from './AvisoAtualizacao'

describe('AvisoAtualizacao', () => {
  test('sem versão nova não aparece', () => {
    estado.nova = null
    const { container } = render(<AvisoAtualizacao />)
    expect(container).toBeEmptyDOMElement()
  })

  test('mostra a faixa, abre a descrição do que mudou e recarrega ao atualizar', () => {
    estado.nova = { versao: 'b2c3d4', data: '', titulo: 'Cronômetro e imagens', itens: ['Cronômetro no topo', 'Imagens otimizadas'] }
    const reload = vi.fn()
    Object.defineProperty(window, 'location', { value: { ...window.location, reload }, writable: true })
    render(<AvisoAtualizacao />)

    expect(screen.getByRole('status')).toHaveTextContent('Uma versão nova está pronta.')
    expect(screen.queryByText('Cronômetro no topo')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Cronômetro e imagens/ }))
    expect(screen.getByText('Cronômetro no topo')).toBeInTheDocument()
    expect(screen.getByText('Imagens otimizadas')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Atualizar' }))
    expect(reload).toHaveBeenCalledTimes(1)
  })

  test('adiar esconde esta versão', () => {
    estado.nova = { versao: 'b2c3d4', data: '', titulo: 'x', itens: [] }
    render(<AvisoAtualizacao />)
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar depois' }))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
