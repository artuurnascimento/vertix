import { describe, expect, test } from 'vitest'
import { BIO_HOSTS, PUBLIC_LINK_HOSTS, ehHostBio } from './publicUrls'

describe('ehHostBio', () => {
  test('reconhece o domínio raiz e o www do link de bio', () => {
    expect(ehHostBio('vertix.bio')).toBe(true)
    expect(ehHostBio('www.vertix.bio')).toBe(true)
  })

  test('recusa os outros hosts públicos e o painel', () => {
    expect(ehHostBio('pay.vertix.studio')).toBe(false)
    expect(ehHostBio('go.vertix.studio')).toBe(false)
    expect(ehHostBio('sistema.vertix.studio')).toBe(false)
    expect(ehHostBio('localhost')).toBe(false)
  })

  test('não aceita subdomínio parecido nem sufixo de outro domínio', () => {
    expect(ehHostBio('vertix.bio.evil.com')).toBe(false)
    expect(ehHostBio('bio.vertix.studio')).toBe(false)
    expect(ehHostBio('xvertix.bio')).toBe(false)
  })
})

describe('PUBLIC_LINK_HOSTS', () => {
  test('inclui os hosts do bio, para o painel não rodar neles', () => {
    for (const host of BIO_HOSTS) expect(PUBLIC_LINK_HOSTS).toContain(host)
  })
})
