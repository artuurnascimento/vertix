import { describe, expect, it } from 'vitest'
import {
  BANNER_MAX_BYTES,
  BANNER_VAZIO,
  bannerVazio,
  caminhoBanner,
  limparBanner,
  mensagemDeUpload,
  parseBanner,
  validarArquivoBanner,
} from './bannerUpload'

/**
 * O que estes testes protegem é o carregamento da página onde a venda
 * acontece — e o domínio do storage.
 *
 * Um PNG de 8 MB no topo do checkout atrasa exatamente a primeira coisa que a
 * pessoa vê. Um SVG aceito por engano vira XSS armazenado, servido do mesmo
 * domínio das imagens públicas. As duas coisas passam por `validarArquivoBanner`.
 */
describe('validarArquivoBanner', () => {
  const arquivo = (extras: Partial<{ type: string; size: number }> = {}) => ({
    name: 'banner.webp',
    type: 'image/webp',
    size: 200_000,
    ...extras,
  })

  it('aceita os formatos de imagem previstos', () => {
    for (const type of ['image/jpeg', 'image/png', 'image/webp', 'image/avif']) {
      expect(validarArquivoBanner(arquivo({ type }))).toBeNull()
    }
  })

  it('recusa SVG — script embutido servido do nosso domínio', () => {
    expect(validarArquivoBanner(arquivo({ type: 'image/svg+xml' }))).toMatch(
      /Formato não aceito/
    )
  })

  it('recusa qualquer coisa que não seja imagem', () => {
    expect(validarArquivoBanner(arquivo({ type: 'application/pdf' }))).not.toBeNull()
    expect(validarArquivoBanner(arquivo({ type: '' }))).not.toBeNull()
  })

  it('recusa acima de 1 MB e diz o tamanho que chegou', () => {
    const mensagem = validarArquivoBanner(
      arquivo({ size: BANNER_MAX_BYTES + 1 })
    )
    expect(mensagem).toContain('1 MB')
  })

  it('aceita exatamente no limite', () => {
    expect(validarArquivoBanner(arquivo({ size: BANNER_MAX_BYTES }))).toBeNull()
  })
})

describe('caminhoBanner', () => {
  it('separa por variante e usa a extensão do tipo, não o nome do arquivo', () => {
    expect(caminhoBanner('desktop', 'image/jpeg', 'abc')).toBe('desktop/abc.jpg')
    expect(caminhoBanner('mobile', 'image/webp', 'abc')).toBe('mobile/abc.webp')
  })

  it('não deixa dois envios se sobrescreverem', () => {
    const um = caminhoBanner('desktop', 'image/png')
    const outro = caminhoBanner('desktop', 'image/png')
    expect(um).not.toBe(outro)
  })
})

describe('parseBanner', () => {
  it('lê o formato completo', () => {
    expect(
      parseBanner({
        desktop: { url: ' https://cdn/a.webp ', largura: 1600, altura: 400 },
        mobile: { url: 'https://cdn/b.webp', largura: 780, altura: 600 },
        alt: ' Oferta ',
      })
    ).toEqual({
      desktop: { url: 'https://cdn/a.webp', largura: 1600, altura: 400 },
      mobile: { url: 'https://cdn/b.webp', largura: 780, altura: 600 },
      alt: 'Oferta',
    })
  })

  it('sobrevive a jsonb malformado sem derrubar o formulário', () => {
    expect(parseBanner(null)).toEqual(BANNER_VAZIO)
    expect(parseBanner('lixo')).toEqual(BANNER_VAZIO)
    expect(parseBanner([])).toEqual(BANNER_VAZIO)
    expect(parseBanner({})).toEqual(BANNER_VAZIO)
  })

  it('descarta imagem sem URL e medida que não é número positivo', () => {
    expect(
      parseBanner({
        desktop: { url: '', largura: 100, altura: 50 },
        mobile: { url: 'https://cdn/b.webp', largura: '780', altura: -1 },
      })
    ).toEqual({
      desktop: null,
      mobile: { url: 'https://cdn/b.webp', largura: null, altura: null },
      alt: '',
    })
  })
})

describe('limparBanner', () => {
  it('joga fora o alt órfão quando não sobrou imagem nenhuma', () => {
    expect(limparBanner({ ...BANNER_VAZIO, alt: 'texto sem imagem' })).toEqual(
      BANNER_VAZIO
    )
  })

  it('mantém as imagens e apara o alt', () => {
    const banner = {
      desktop: { url: 'https://cdn/a.webp', largura: 1600, altura: 400 },
      mobile: null,
      alt: '  Oferta  ',
    }
    expect(limparBanner(banner)).toEqual({ ...banner, alt: 'Oferta' })
  })
})

describe('bannerVazio', () => {
  it('é o que decide se a página desenha o topo ilustrado', () => {
    expect(bannerVazio(BANNER_VAZIO)).toBe(true)
    expect(
      bannerVazio({
        desktop: null,
        mobile: { url: 'https://cdn/b.webp', largura: null, altura: null },
        alt: '',
      })
    ).toBe(false)
  })
})

describe('mensagemDeUpload', () => {
  it('explica o bucket ausente em vez de mostrar erro de infra', () => {
    expect(mensagemDeUpload(new Error('Bucket not found'))).toMatch(
      /migração do banner/
    )
  })

  it('tem uma frase genérica para o que não reconhece', () => {
    expect(mensagemDeUpload({ coisa: 1 })).toBe(
      'Não foi possível enviar a imagem. Tente novamente.'
    )
  })
})
