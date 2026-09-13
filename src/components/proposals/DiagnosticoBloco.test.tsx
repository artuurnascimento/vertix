import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { EsforcoDaRegra } from './diagnostico'
import type { DiagnosticoDoProjeto } from './diagnosticoData'

const { estado } = vi.hoisted(() => ({
  estado: {
    diagnostico: null as DiagnosticoDoProjeto | null,
    esforcos: [] as EsforcoDaRegra[],
    carregandoEsforcos: false,
  },
}))
vi.mock('./diagnosticoData', () => ({
  useDiagnosticoDoProjeto: () => ({ data: estado.diagnostico, isLoading: false }),
}))
vi.mock('../settings/esforcoData', () => ({
  useEsforcoPorRegra: () => ({ data: estado.esforcos, isLoading: estado.carregandoEsforcos }),
}))

import DiagnosticoBloco from './DiagnosticoBloco'

const DIAGNOSTICO: DiagnosticoDoProjeto = {
  analysisId: 'a1',
  dominio: 'minhaloja.com.br',
  score: 5.4,
  fonte: 'deep',
  valorHora: 150,
  problemas: [
    { title: 'Página sem H1', category: 'seo', impact: 'baixo', regra: 'sem_h1' },
    { title: 'Imagens pesadas na home', category: 'velocidade', impact: 'alto', regra: 'imagens_pesadas' },
    { title: 'Banner desalinhado', category: 'identidade', impact: 'medio' },
  ],
}

const ESFORCOS: EsforcoDaRegra[] = [
  { regra: 'imagens_pesadas', titulo: 'Imagens pesadas', horas: 3, ativo: true },
  { regra: 'sem_h1', titulo: 'Sem H1', horas: 0.5, ativo: true },
  { regra: 'impacto_medio', titulo: 'Outro médio', horas: 2, ativo: true },
]

beforeEach(() => {
  estado.diagnostico = DIAGNOSTICO
  estado.esforcos = ESFORCOS
  estado.carregandoEsforcos = false
})

describe('DiagnosticoBloco', () => {
  test('sem diagnóstico ligado ao projeto, não aparece', () => {
    estado.diagnostico = null
    const { container } = render(
      <DiagnosticoBloco projectId="p1" temItensPreenchidos={false} onAplicar={vi.fn()} />
    )
    expect(container).toBeEmptyDOMElement()
  })

  test('resume o diagnóstico e monta os itens em ordem de impacto com horas × valor da hora', () => {
    const onAplicar = vi.fn()
    render(<DiagnosticoBloco projectId="p1" temItensPreenchidos={false} onAplicar={onAplicar} />)

    const bloco = screen.getByTestId('diagnostico-bloco')
    expect(bloco).toHaveTextContent('minhaloja.com.br · nota 5,4 · 3 problemas no Raio-X')
    expect(bloco).toHaveTextContent('3 itens · 5,5 h ×')
    expect(bloco).toHaveTextContent('825,00')

    fireEvent.click(screen.getByRole('button', { name: /montar itens do diagnóstico/i }))

    expect(onAplicar).toHaveBeenCalledTimes(1)
    const [itens, titulo] = onAplicar.mock.calls[0]
    expect(titulo).toBe('Correção da loja minhaloja.com.br')
    expect(itens).toEqual([
      { descricao: 'Velocidade · Imagens pesadas na home', quantidade: '3', valor_unitario: '150' },
      { descricao: 'Identidade · Banner desalinhado', quantidade: '2', valor_unitario: '150' },
      { descricao: 'SEO · Página sem H1', quantidade: '0.5', valor_unitario: '150' },
    ])
  })

  test('com itens já digitados pede confirmação antes de substituir', () => {
    const onAplicar = vi.fn()
    render(<DiagnosticoBloco projectId="p1" temItensPreenchidos={true} onAplicar={onAplicar} />)

    fireEvent.click(screen.getByRole('button', { name: /montar itens do diagnóstico/i }))
    expect(onAplicar).not.toHaveBeenCalled()
    expect(screen.getByText('Substituir itens atuais?')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(onAplicar).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: /montar itens do diagnóstico/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Substituir itens' }))
    expect(onAplicar).toHaveBeenCalledTimes(1)
  })

  test('sem valor da hora, avisa e não deixa montar', () => {
    estado.diagnostico = { ...DIAGNOSTICO, valorHora: 0 }
    render(<DiagnosticoBloco projectId="p1" temItensPreenchidos={false} onAplicar={vi.fn()} />)
    expect(screen.getByText(/defina o valor da hora/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /montar itens do diagnóstico/i })).toBeDisabled()
  })

  test('regras desativadas ficam de fora e o bloco conta quantas', () => {
    estado.esforcos = ESFORCOS.map((e) => (e.regra === 'sem_h1' ? { ...e, ativo: false } : e))
    render(<DiagnosticoBloco projectId="p1" temItensPreenchidos={false} onAplicar={vi.fn()} />)
    expect(screen.getByTestId('diagnostico-bloco')).toHaveTextContent('2 itens · 5 h ×')
    expect(screen.getByTestId('diagnostico-bloco')).toHaveTextContent('1 problema fica de fora')
  })

  test('problemas grátis (sem Raio-X completo) são apresentados como tal', () => {
    estado.diagnostico = { ...DIAGNOSTICO, fonte: 'light', problemas: DIAGNOSTICO.problemas.slice(0, 1) }
    render(<DiagnosticoBloco projectId="p1" temItensPreenchidos={false} onAplicar={vi.fn()} />)
    expect(screen.getByTestId('diagnostico-bloco')).toHaveTextContent('1 problema grátis (sem Raio-X completo)')
  })

  test('o X esconde o bloco', () => {
    render(<DiagnosticoBloco projectId="p1" temItensPreenchidos={false} onAplicar={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Ignorar diagnóstico' }))
    expect(screen.queryByTestId('diagnostico-bloco')).not.toBeInTheDocument()
  })
})
