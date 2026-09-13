import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { EsforcoDaRegra } from '../proposals/diagnostico'

const { estado, mutate } = vi.hoisted(() => ({
  estado: { linhas: [] as EsforcoDaRegra[] },
  mutate: vi.fn(),
}))
vi.mock('./esforcoData', async (importOriginal) => {
  const real = await importOriginal<typeof import('./esforcoData')>()
  return {
    ...real,
    useEsforcoPorRegra: () => ({ data: estado.linhas, isLoading: false, isError: false }),
    useAtualizarEsforco: () => ({ mutate, isPending: false }),
  }
})

import EsforcoPorRegraCard from './EsforcoPorRegraCard'
import { horasDoTexto } from './esforcoData'

const LINHAS: EsforcoDaRegra[] = [
  { regra: 'impacto_alto', titulo: 'Outro problema de impacto alto', horas: 3, ativo: true },
  { regra: 'sem_h1', titulo: 'Página sem H1', horas: 0.5, ativo: true },
  { regra: 'imagens_pesadas', titulo: 'Imagens pesadas', horas: 3, ativo: false },
]

beforeEach(() => {
  estado.linhas = LINHAS
  mutate.mockReset()
})

describe('horasDoTexto', () => {
  test('aceita vírgula e ponto, arredonda a um décimo, recusa lixo e negativo', () => {
    expect(horasDoTexto('1,5')).toBe(1.5)
    expect(horasDoTexto('2.25')).toBe(2.3)
    expect(horasDoTexto(' 0 ')).toBe(0)
    expect(horasDoTexto('')).toBeNull()
    expect(horasDoTexto('abc')).toBeNull()
    expect(horasDoTexto('-1')).toBeNull()
    expect(horasDoTexto('1000')).toBeNull()
  })
})

describe('EsforcoPorRegraCard', () => {
  test('lista as regras com as horas, fallbacks por último, e o switch reflete "ativo"', () => {
    render(<EsforcoPorRegraCard isAdmin />)
    const linhas = screen.getAllByRole('row').slice(1) // tira o cabeçalho
    expect(linhas.map((l) => l.getAttribute('data-testid'))).toEqual([
      'esforco-imagens_pesadas',
      'esforco-sem_h1',
      'esforco-impacto_alto',
    ])
    expect(within(screen.getByTestId('esforco-sem_h1')).getByRole('textbox')).toHaveValue('0,5')
    expect(within(screen.getByTestId('esforco-imagens_pesadas')).getByRole('switch')).toHaveAttribute(
      'aria-checked',
      'false'
    )
    expect(screen.getByTestId('esforco-impacto_alto')).toHaveTextContent('fallback · impacto_alto')
  })

  test('sair do campo salva as horas novas; valor igual não salva; lixo mostra erro', () => {
    render(<EsforcoPorRegraCard isAdmin />)
    const campo = within(screen.getByTestId('esforco-sem_h1')).getByRole('textbox')

    fireEvent.change(campo, { target: { value: '1,5' } })
    fireEvent.blur(campo)
    expect(mutate).toHaveBeenCalledWith({ regra: 'sem_h1', horas: 1.5 }, expect.anything())

    mutate.mockReset()
    fireEvent.change(campo, { target: { value: '0.5' } })
    fireEvent.blur(campo)
    expect(mutate).not.toHaveBeenCalled()

    fireEvent.change(campo, { target: { value: 'muito' } })
    fireEvent.blur(campo)
    expect(mutate).not.toHaveBeenCalled()
    expect(screen.getByText('Use um número de horas, como 1,5.')).toBeInTheDocument()
  })

  test('o switch liga e desliga a regra na proposta automática', () => {
    render(<EsforcoPorRegraCard isAdmin />)
    fireEvent.click(within(screen.getByTestId('esforco-imagens_pesadas')).getByRole('switch'))
    expect(mutate).toHaveBeenCalledWith({ regra: 'imagens_pesadas', ativo: true }, expect.anything())
  })

  test('quem não é admin só lê', () => {
    render(<EsforcoPorRegraCard isAdmin={false} />)
    expect(screen.getByRole('status')).toHaveTextContent('Apenas administradores podem editar as horas.')
    expect(within(screen.getByTestId('esforco-sem_h1')).getByRole('textbox')).toBeDisabled()
    expect(within(screen.getByTestId('esforco-sem_h1')).getByRole('switch')).toBeDisabled()
  })
})
