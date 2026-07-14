import { describe, expect, test } from 'vitest'
import {
  breakdownForCampaign,
  buildUtmQuery,
  buildUtmUrl,
  groupByCampaign,
  isMetaPlaceholder,
  makeSnippet,
  UTM_META_DEFAULTS,
} from './utm'

describe('isMetaPlaceholder', () => {
  test('reconhece placeholders da Meta', () => {
    expect(isMetaPlaceholder('{{campaign.id}}')).toBe(true)
    expect(isMetaPlaceholder('{{adset.id}}')).toBe(true)
    expect(isMetaPlaceholder('{{ad.id}}')).toBe(true)
  })

  test('rejeita valores comuns', () => {
    expect(isMetaPlaceholder('facebook')).toBe(false)
    expect(isMetaPlaceholder('{{campaign.id}} extra')).toBe(false)
    expect(isMetaPlaceholder('')).toBe(false)
  })
})

describe('buildUtmQuery', () => {
  test('gera query no formato do campo "Parâmetros de URL" da Meta', () => {
    expect(buildUtmQuery(UTM_META_DEFAULTS)).toBe(
      'utm_source=facebook&utm_medium={{adset.id}}&utm_campaign={{campaign.id}}&utm_content={{ad.id}}'
    )
  })

  test('tudo vazio retorna vazio', () => {
    expect(
      buildUtmQuery({
        utm_source: '',
        utm_medium: '',
        utm_campaign: '',
        utm_content: '',
        utm_term: '',
      })
    ).toBe('')
  })
})

describe('buildUtmUrl', () => {
  test('placeholders da Meta ficam crus (sem URL-encode)', () => {
    const url = buildUtmUrl('https://loja.com', UTM_META_DEFAULTS)
    expect(url).toBe(
      'https://loja.com?utm_source=facebook&utm_medium={{adset.id}}&utm_campaign={{campaign.id}}&utm_content={{ad.id}}'
    )
  })

  test('valores comuns são encodados', () => {
    const url = buildUtmUrl('https://loja.com', {
      ...UTM_META_DEFAULTS,
      utm_campaign: 'verão 2026',
    })
    expect(url).toContain('utm_campaign=ver%C3%A3o%202026')
  })

  test('destino com query existente usa &', () => {
    const url = buildUtmUrl('https://loja.com/p?ref=a', UTM_META_DEFAULTS)
    expect(url).toContain('?ref=a&utm_source=facebook')
  })

  test('campos vazios são omitidos; destino vazio retorna vazio', () => {
    const url = buildUtmUrl('https://loja.com', {
      utm_source: 'facebook',
      utm_medium: '',
      utm_campaign: '',
      utm_content: '',
      utm_term: '',
    })
    expect(url).toBe('https://loja.com?utm_source=facebook')
    expect(buildUtmUrl('  ', UTM_META_DEFAULTS)).toBe('')
  })
})

describe('makeSnippet', () => {
  test('embute URL e anon key e expõe window.vtx', () => {
    const snippet = makeSnippet('https://x.supabase.co', 'chave-anon')
    expect(snippet).toContain("U='https://x.supabase.co'")
    expect(snippet).toContain("K='chave-anon'")
    expect(snippet).toContain('track_utm_visit')
    expect(snippet).toContain('track_utm_conversion')
    expect(snippet).toContain('window.vtx')
    expect(snippet.startsWith('<script>')).toBe(true)
    expect(snippet.endsWith('</script>')).toBe(true)
  })
})

describe('groupByCampaign', () => {
  test('agrupa sessões, conversões e receita por campanha', () => {
    const grupos = groupByCampaign([
      {
        utm_campaign: 'camp_a',
        utm_conversions: [{ tipo: 'purchase', valor: 100 }],
      },
      { utm_campaign: 'camp_a', utm_conversions: [] },
      { utm_campaign: 'camp_b', utm_conversions: [{ tipo: 'lead', valor: 0 }] },
      { utm_campaign: null, utm_conversions: [] },
      { utm_campaign: '  ', utm_conversions: [] },
    ])
    expect(grupos[0]).toEqual({
      campanha: 'camp_a',
      sessoes: 2,
      conversoes: 1,
      receita: 100,
    })
    const direto = grupos.find((g) => g.campanha === 'direto')
    expect(direto?.sessoes).toBe(2)
  })

  test('ordena por receita, depois sessões', () => {
    const grupos = groupByCampaign([
      { utm_campaign: 'sem_receita', utm_conversions: [] },
      { utm_campaign: 'sem_receita', utm_conversions: [] },
      {
        utm_campaign: 'com_receita',
        utm_conversions: [{ tipo: 'purchase', valor: 50 }],
      },
    ])
    expect(grupos.map((g) => g.campanha)).toEqual(['com_receita', 'sem_receita'])
  })
})

describe('breakdownForCampaign', () => {
  const rows = [
    {
      utm_campaign: 'camp_a',
      utm_medium: 'adset_1',
      utm_content: 'ad_1',
      utm_conversions: [{ tipo: 'purchase', valor: 100 }],
    },
    {
      utm_campaign: 'camp_a',
      utm_medium: 'adset_1',
      utm_content: 'ad_2',
      utm_conversions: [],
    },
    {
      utm_campaign: 'camp_a',
      utm_medium: null,
      utm_content: null,
      utm_conversions: [],
    },
    {
      utm_campaign: 'camp_b',
      utm_medium: 'adset_9',
      utm_content: 'ad_9',
      utm_conversions: [{ tipo: 'purchase', valor: 999 }],
    },
  ]

  test('agrupa por conjunto (utm_medium) só da campanha pedida', () => {
    const grupos = breakdownForCampaign(rows, 'camp_a', 'utm_medium')
    expect(grupos).toEqual([
      { campanha: 'adset_1', sessoes: 2, conversoes: 1, receita: 100 },
      { campanha: 'não informado', sessoes: 1, conversoes: 0, receita: 0 },
    ])
  })

  test('agrupa por anúncio (utm_content)', () => {
    const grupos = breakdownForCampaign(rows, 'camp_a', 'utm_content')
    expect(grupos.map((g) => g.campanha)).toEqual([
      'ad_1',
      'ad_2',
      'não informado',
    ])
  })

  test('campanha "direto" agrupa sessões sem utm_campaign', () => {
    const grupos = breakdownForCampaign(
      [{ utm_campaign: null, utm_medium: 'x', utm_conversions: [] }],
      'direto',
      'utm_medium'
    )
    expect(grupos).toHaveLength(1)
    expect(grupos[0].sessoes).toBe(1)
  })
})
