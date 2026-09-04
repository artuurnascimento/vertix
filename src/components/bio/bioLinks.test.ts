import { describe, expect, test } from 'vitest'
import { agrupaPorFormato, destinoFinal, linksVisiveis } from './bioLinks'
import type { BioLink } from './bioLinks'

const AGORA = new Date('2026-09-04T12:00:00Z')

function botao(rotulo: string, extras?: Partial<BioLink>): BioLink {
  return {
    id: `id-${rotulo}`,
    rotulo,
    descricao: extras?.descricao ?? null,
    icone: extras?.icone ?? null,
    formato: extras?.formato ?? 'grade',
    tipo_destino: extras?.tipo_destino ?? 'url',
    destino: extras?.destino ?? 'https://www.vertix.studio',
    mensagem: extras?.mensagem ?? null,
    posicao: extras?.posicao ?? 0,
    ativo: extras?.ativo,
    inicia_em: extras?.inicia_em,
    termina_em: extras?.termina_em,
  }
}

describe('linksVisiveis', () => {
  test('ordena por posição, ignorando a ordem de entrada', () => {
    const visiveis = linksVisiveis(
      [botao('c', { posicao: 30 }), botao('a', { posicao: 10 }), botao('b', { posicao: 20 })],
      AGORA
    )
    expect(visiveis.map((l) => l.rotulo)).toEqual(['a', 'b', 'c'])
  })

  test('esconde botão desligado mesmo dentro da vigência', () => {
    const visiveis = linksVisiveis(
      [botao('ligado'), botao('desligado', { ativo: false })],
      AGORA
    )
    expect(visiveis.map((l) => l.rotulo)).toEqual(['ligado'])
  })

  test('esconde botão sem destino (campanha ainda não configurada)', () => {
    const visiveis = linksVisiveis([botao('sem destino', { destino: '' })], AGORA)
    expect(visiveis).toEqual([])
  })

  test('esconde vigência futura e vigência vencida', () => {
    const visiveis = linksVisiveis(
      [
        botao('futuro', { inicia_em: '2026-10-01T00:00:00Z' }),
        botao('vencido', { termina_em: '2026-08-01T00:00:00Z' }),
        botao('corrente', {
          inicia_em: '2026-09-01T00:00:00Z',
          termina_em: '2026-09-30T00:00:00Z',
        }),
      ],
      AGORA
    )
    expect(visiveis.map((l) => l.rotulo)).toEqual(['corrente'])
  })

  test('vigência sem limites aparece sempre', () => {
    const visiveis = linksVisiveis(
      [botao('sempre', { inicia_em: null, termina_em: null })],
      AGORA
    )
    expect(visiveis).toHaveLength(1)
  })

  test('não altera o array recebido', () => {
    const entrada = [botao('b', { posicao: 20 }), botao('a', { posicao: 10 })]
    linksVisiveis(entrada, AGORA)
    expect(entrada.map((l) => l.rotulo)).toEqual(['b', 'a'])
  })
})

describe('destinoFinal', () => {
  test('endereço comum passa intacto', () => {
    const link = botao('site', { destino: 'https://www.vertix.studio/#servicos' })
    expect(destinoFinal(link)).toBe('https://www.vertix.studio/#servicos')
  })

  test('número formatado vira link de conversa', () => {
    const link = botao('zap', {
      tipo_destino: 'whatsapp',
      destino: '(62) 99607-6194',
    })
    expect(destinoFinal(link)).toBe('https://wa.me/5562996076194')
  })

  test('sem mensagem não deixa parâmetro de texto vazio', () => {
    const link = botao('zap', { tipo_destino: 'whatsapp', destino: '5562996076194' })
    expect(destinoFinal(link)).not.toContain('text=')
  })

  test('mensagem com acento é codificada', () => {
    const link = botao('zap', {
      tipo_destino: 'whatsapp',
      destino: '5562996076194',
      mensagem: 'Oi, Vertix! Quero uma migração.',
    })
    expect(destinoFinal(link)).toBe(
      'https://wa.me/5562996076194?text=Oi%2C%20Vertix!%20Quero%20uma%20migra%C3%A7%C3%A3o.'
    )
  })

  test('número inválido devolve null em vez de link quebrado', () => {
    const link = botao('zap', { tipo_destino: 'whatsapp', destino: '123' })
    expect(destinoFinal(link)).toBeNull()
  })

  test('destino vazio devolve null', () => {
    expect(destinoFinal(botao('vazio', { destino: '   ' }))).toBeNull()
  })
})

describe('agrupaPorFormato', () => {
  test('separa os três formatos preservando a ordem', () => {
    const grupos = agrupaPorFormato([
      botao('scan', { formato: 'destaque' }),
      botao('zap', { formato: 'largo' }),
      botao('loja', { formato: 'grade' }),
      botao('sistemas', { formato: 'grade' }),
    ])
    expect(grupos.destaque.map((l) => l.rotulo)).toEqual(['scan'])
    expect(grupos.largos.map((l) => l.rotulo)).toEqual(['zap'])
    expect(grupos.grade.map((l) => l.rotulo)).toEqual(['loja', 'sistemas'])
  })

  test('lista vazia devolve os três grupos vazios', () => {
    expect(agrupaPorFormato([])).toEqual({ destaque: [], largos: [], grade: [] })
  })
})
