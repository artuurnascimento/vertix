import { describe, expect, test } from 'vitest'
import { BIO_HOST, PUBLIC_LINK_HOSTS, ehHostBio } from './publicUrls'

describe('ehHostBio', () => {
  test('reconhece o host do link de bio', () => {
    expect(ehHostBio(BIO_HOST)).toBe(true)
  })

  test('recusa os outros hosts públicos e o painel', () => {
    expect(ehHostBio('pay.vertix.studio')).toBe(false)
    expect(ehHostBio('go.vertix.studio')).toBe(false)
    expect(ehHostBio('sistema.vertix.studio')).toBe(false)
    expect(ehHostBio('localhost')).toBe(false)
  })

  test('não aceita subdomínio parecido nem sufixo de outro domínio', () => {
    expect(ehHostBio('bio.vertix.studio.evil.com')).toBe(false)
    expect(ehHostBio('xbio.vertix.studio')).toBe(false)
  })
})

describe('PUBLIC_LINK_HOSTS', () => {
  test('inclui o bio, para o painel não rodar nele', () => {
    expect(PUBLIC_LINK_HOSTS).toContain(BIO_HOST)
  })
})
