import { describe, expect, it } from 'vitest'
import {
  LARGURA_MINIMA,
  descreverOtimizacao,
  formatarTamanho,
  primeiraTentativa,
  proximaTentativa,
} from './otimizarImagem'

describe('primeiraTentativa', () => {
  it('reduz para a largura da página, mas nunca amplia', () => {
    expect(primeiraTentativa(4000, 1400)).toEqual({ qualidade: 0.9, largura: 1400 })
    expect(primeiraTentativa(900, 1400)).toEqual({ qualidade: 0.9, largura: 900 })
  })
})

describe('proximaTentativa', () => {
  it('baixa a qualidade de 0,1 em 0,1 até 0,5 antes de mexer na largura', () => {
    let t = { qualidade: 0.9, largura: 1400 }
    const qualidades: number[] = []
    for (let i = 0; i < 4; i++) {
      t = proximaTentativa(t)!
      qualidades.push(t.qualidade)
      expect(t.largura).toBe(1400)
    }
    expect(qualidades).toEqual([0.8, 0.7, 0.6, 0.5])
  })

  it('depois de 0,5 reduz a largura em 15% e volta a 0,8', () => {
    expect(proximaTentativa({ qualidade: 0.5, largura: 1400 })).toEqual({ qualidade: 0.8, largura: 1190 })
  })

  it('desiste quando a largura ficaria abaixo do mínimo', () => {
    expect(proximaTentativa({ qualidade: 0.5, largura: LARGURA_MINIMA })).toBeNull()
    expect(proximaTentativa({ qualidade: 0.5, largura: 380 })).not.toBeNull()
  })
})

describe('formatarTamanho', () => {
  it('KB abaixo de 1 MB, MB com uma casa acima', () => {
    expect(formatarTamanho(180 * 1024)).toBe('180 KB')
    expect(formatarTamanho(1.4 * 1024 * 1024)).toBe('1,4 MB')
    expect(formatarTamanho(10)).toBe('1 KB')
  })
})

describe('descreverOtimizacao', () => {
  const base = {
    deBytes: 1.4 * 1024 * 1024,
    paraBytes: 180 * 1024,
    deLargura: 2800,
    paraLargura: 1400,
    deTipo: 'image/png',
    paraTipo: 'image/webp',
  }

  it('conta o que mudou: peso, largura e formato', () => {
    expect(descreverOtimizacao(base)).toBe('Otimizada: 1,4 MB → 180 KB · 2800 → 1400 px · WebP')
  })

  it('omite o que ficou igual', () => {
    expect(descreverOtimizacao({ ...base, paraLargura: 2800 })).toBe('Otimizada: 1,4 MB → 180 KB · WebP')
    expect(descreverOtimizacao({ ...base, paraLargura: 2800, paraTipo: 'image/png' })).toBe('Otimizada: 1,4 MB → 180 KB')
  })

  it('nada mudou = sem mensagem', () => {
    expect(
      descreverOtimizacao({ ...base, paraBytes: base.deBytes, paraLargura: 2800, paraTipo: 'image/png' })
    ).toBeNull()
  })
})
