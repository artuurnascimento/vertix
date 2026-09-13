import { describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import MapaAoVivo from './MapaAoVivo'
import type { Marcador } from './locais'

/** Testes do mapa pontilhado do Ao vivo (MapaAoVivo.tsx). Vitest + jsdom. */

const MARCADORES: Marcador[] = [
  {
    id: 'maria',
    lat: -25.43,
    lng: -49.27,
    tipo: 'agora',
    semente: 0.2,
    rotulo: 'Maria · Curitiba · PR',
  },
  {
    id: 'ana',
    lat: -19.92,
    lng: -43.94,
    tipo: 'pedido',
    semente: 0.5,
    rotulo: 'Ana · Belo Horizonte · MG',
  },
  {
    id: 'foi',
    lat: -8.05,
    lng: -34.9,
    tipo: 'passado',
    semente: 0.7,
    rotulo: 'Visitante · Recife · PE',
  },
  { id: 'polar', lat: 78.2, lng: 15.6, tipo: 'agora', semente: 0.1, rotulo: 'Visitante · Svalbard' },
]

function renderizar(over: Partial<Parameters<typeof MapaAoVivo>[0]> = {}) {
  const onSelecionar = vi.fn()
  const utils = render(
    <MapaAoVivo
      marcadores={MARCADORES}
      selecionadaId={null}
      idsDestacados={new Set()}
      onSelecionar={onSelecionar}
      {...over}
    />
  )
  return { ...utils, onSelecionar }
}

describe('MapaAoVivo', () => {
  test('desenha um marcador por visita dentro do mapa e um arco por visitante/pedido', () => {
    renderizar()
    const mapa = screen.getByRole('img', {
      name: 'Mapa das visitas: 1 na página agora, 1 pedidos',
    })
    const marcadores = within(mapa).getAllByRole('button')
    // Svalbard fica fora da região desenhada.
    expect(marcadores.map((m) => m.getAttribute('aria-label'))).toEqual([
      'Visitante · Recife · PE',
      'Maria · Curitiba · PR',
      'Ana · Belo Horizonte · MG',
    ])
    expect(within(mapa).getByTestId('arcos').querySelectorAll('path')).toHaveLength(2)
    // A visita que passou não pulsa; as vivas pulsam.
    expect(marcadores[0].querySelectorAll('animate')).toHaveLength(0)
    expect(marcadores[1].querySelectorAll('animate')).toHaveLength(2)
  })

  test('passar o mouse mostra quem é; clicar abre a visita', () => {
    const { onSelecionar } = renderizar()
    const maria = screen.getByRole('button', { name: 'Maria · Curitiba · PR' })
    fireEvent.pointerEnter(maria)
    expect(screen.getByRole('tooltip')).toHaveTextContent('Maria · Curitiba · PR')
    fireEvent.pointerLeave(maria)
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()

    fireEvent.click(maria)
    expect(onSelecionar).toHaveBeenCalledWith('maria')
    fireEvent.keyDown(maria, { key: 'Enter' })
    expect(onSelecionar).toHaveBeenCalledTimes(2)
  })

  test('a visita aberta e as destacadas ganham um anel', () => {
    renderizar({ selecionadaId: 'ana', idsDestacados: new Set(['maria']) })
    const ana = screen.getByRole('button', { name: 'Ana · Belo Horizonte · MG' })
    const maria = screen.getByRole('button', { name: 'Maria · Curitiba · PR' })
    const recife = screen.getByRole('button', { name: 'Visitante · Recife · PE' })
    expect(ana.querySelector('circle[stroke="#ffffff"]')).not.toBeNull()
    expect(maria.querySelector('circle[stroke="#34d399"]')).not.toBeNull()
    expect(recife.querySelector('circle[stroke]')).toBeNull()
  })

  test('a legenda nomeia as duas cores', () => {
    renderizar()
    const legenda = screen.getByRole('list', { name: 'Legenda' })
    expect(legenda).toHaveTextContent('Pedidos')
    expect(legenda).toHaveTextContent('Visitantes agora')
  })
})
