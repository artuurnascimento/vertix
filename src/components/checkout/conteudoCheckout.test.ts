import { describe, expect, it } from 'vitest'
import {
  beneficiosDoResumo,
  destacarFinalDoTitulo,
  textoDoBump,
} from './conteudoCheckout'

describe('textoDoBump', () => {
  it('devolve tudo vazio quando não há descrição', () => {
    expect(textoDoBump(null)).toEqual({ paragrafo: null, beneficios: [] })
    expect(textoDoBump('   ')).toEqual({ paragrafo: null, beneficios: [] })
  })

  it('mantém parágrafo quando o texto é uma frase só', () => {
    const resultado = textoDoBump('Receba o plano completo da sua loja.')

    expect(resultado.beneficios).toEqual([])
    expect(resultado.paragrafo).toBe('Receba o plano completo da sua loja.')
  })

  it('quebra lista escrita com marcadores de linha', () => {
    const resultado = textoDoBump('- Checklist pronto\n- Vídeo guiado\n- Suporte')

    expect(resultado.beneficios).toEqual([
      'Checklist pronto',
      'Vídeo guiado',
      'Suporte',
    ])
    expect(resultado.paragrafo).toBeNull()
  })

  it('quebra lista separada por ponto e vírgula ou bolinha', () => {
    expect(textoDoBump('Um; Dois; Três').beneficios).toEqual([
      'Um',
      'Dois',
      'Três',
    ])
    expect(textoDoBump('Um • Dois').beneficios).toEqual(['Um', 'Dois'])
  })

  it('quebra frases curtas em benefícios', () => {
    const resultado = textoDoBump(
      'Entrego em 24 horas. Suporte por 30 dias. Modelos prontos.'
    )

    expect(resultado.beneficios).toEqual([
      'Entrego em 24 horas.',
      'Suporte por 30 dias.',
      'Modelos prontos.',
    ])
    expect(resultado.paragrafo).toBeNull()
  })

  it('não quebra frases longas: vira parágrafo', () => {
    const longa =
      'Este é um texto muito comprido que descreve com calma tudo o que o comprador recebe ao marcar a oferta adicional. E ainda continua explicando.'

    const resultado = textoDoBump(longa)

    expect(resultado.beneficios).toEqual([])
    expect(resultado.paragrafo).toBe(longa)
  })

  it('preserva o que passa de três itens no parágrafo', () => {
    const resultado = textoDoBump('Um\nDois\nTrês\nQuatro')

    expect(resultado.beneficios).toEqual(['Um', 'Dois', 'Três'])
    expect(resultado.paragrafo).toBe('Quatro')
  })

  it('não parte palavras hifenizadas', () => {
    const resultado = textoDoBump('Rotina dia-a-dia da loja.')

    expect(resultado.beneficios).toEqual([])
    expect(resultado.paragrafo).toBe('Rotina dia-a-dia da loja.')
  })
})

describe('beneficiosDoResumo', () => {
  it('não devolve nada sem garantia e sem selos', () => {
    expect(beneficiosDoResumo(null, null)).toEqual([])
    expect(beneficiosDoResumo({ depoimentos: [], selos: [] }, null)).toEqual([])
  })

  it('põe a garantia primeiro, com o texto configurado de apoio', () => {
    expect(beneficiosDoResumo(null, { dias: 7, texto: 'Devolvemos tudo.' })).toEqual(
      [{ titulo: 'Garantia de 7 dias', apoio: 'Devolvemos tudo.' }]
    )
  })

  it('usa singular na garantia de um dia', () => {
    expect(beneficiosDoResumo(null, { dias: 1, texto: null })[0].titulo).toBe(
      'Garantia de 1 dia'
    )
  })

  it('completa com selos até três benefícios', () => {
    const prova = {
      depoimentos: [],
      selos: ['Compra segura', 'Acesso imediato', 'Entrega em 24h'],
    }

    const beneficios = beneficiosDoResumo(prova, { dias: 7, texto: null })

    expect(beneficios.map((b) => b.titulo)).toEqual([
      'Garantia de 7 dias',
      'Compra segura',
      'Acesso imediato',
    ])
  })

  it('nunca passa de três, mesmo com muitos selos', () => {
    const prova = { depoimentos: [], selos: ['A', 'B', 'C', 'D', 'E'] }

    expect(beneficiosDoResumo(prova, null).map((b) => b.titulo)).toEqual([
      'A',
      'B',
      'C',
    ])
  })

  it('selo não ganha linha de apoio inventada', () => {
    const prova = { depoimentos: [], selos: ['Compra segura'] }

    expect(beneficiosDoResumo(prova, null)[0].apoio).toBeNull()
  })
})

describe('destacarFinalDoTitulo', () => {
  it('destaca as três últimas palavras em títulos longos', () => {
    expect(destacarFinalDoTitulo('O plano para corrigir a sua loja')).toEqual({
      inicio: 'O plano para corrigir',
      destaque: 'a sua loja',
    })
  })

  it('destaca só a última palavra em títulos de três ou quatro palavras', () => {
    expect(destacarFinalDoTitulo('Plano de Correção')).toEqual({
      inicio: 'Plano de',
      destaque: 'Correção',
    })
  })

  it('não destaca nada em títulos curtos', () => {
    expect(destacarFinalDoTitulo('Plano Vertix')).toEqual({
      inicio: 'Plano Vertix',
      destaque: '',
    })
  })

  it('não inventa nem perde palavras', () => {
    const titulo = 'Corrija a sua loja de uma vez por todas'
    const { inicio, destaque } = destacarFinalDoTitulo(titulo)

    expect(`${inicio} ${destaque}`.trim()).toBe(titulo)
  })

  it('aguenta espaços sobrando', () => {
    expect(destacarFinalDoTitulo('   ')).toEqual({ inicio: '', destaque: '' })
  })
})
