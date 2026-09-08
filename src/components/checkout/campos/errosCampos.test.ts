import { describe, expect, test } from 'vitest'
import {
  campoDoCodigo,
  campoDoErro,
  campoDoSdk,
  extrairCodigos,
  mensagemDeToken,
  mensagemDeValidade,
  type CampoCartao,
} from './errosCampos'

/**
 * Tabela do item 3.6 do plano, extraída do bundle do SDK v2. Um caso por
 * código: se algum par sair do lugar, a pessoa é mandada corrigir o campo
 * errado — o mesmo defeito que existe hoje em `upsell/cardToken.ts`.
 */
const TABELA: ReadonlyArray<readonly [string, CampoCartao, 'vazio' | 'invalido']> = [
  ['205', 'numero', 'vazio'],
  ['E301', 'numero', 'invalido'],
  ['208', 'validade', 'vazio'],
  ['325', 'validade', 'invalido'],
  ['209', 'validade', 'vazio'],
  ['326', 'validade', 'invalido'],
  ['212', 'documento', 'vazio'],
  ['322', 'documento', 'invalido'],
  ['214', 'documento', 'vazio'],
  ['324', 'documento', 'invalido'],
  ['221', 'titular', 'vazio'],
  ['316', 'titular', 'invalido'],
  ['224', 'cvv', 'vazio'],
  ['E302', 'cvv', 'invalido'],
]

describe('campoDoCodigo', () => {
  for (const [codigo, campo] of TABELA) {
    test(`${codigo} destaca o campo ${campo}`, () => {
      expect(campoDoCodigo(codigo)).toBe(campo)
    })
  }

  test('221 é nome do titular vazio, NÃO é CVV', () => {
    expect(campoDoCodigo('221')).toBe('titular')
    expect(campoDoCodigo('221')).not.toBe('cvv')
  })

  test('E301 é número inválido, NÃO é CVV', () => {
    expect(campoDoCodigo('E301')).toBe('numero')
    expect(campoDoCodigo('E301')).not.toBe('cvv')
  })

  test('os códigos de CVV são 224 e E302', () => {
    expect(campoDoCodigo('224')).toBe('cvv')
    expect(campoDoCodigo('E302')).toBe('cvv')
  })

  test('não casa por substring: 1221 e 2210 não são o 221', () => {
    expect(campoDoCodigo('1221')).toBeNull()
    expect(campoDoCodigo('2210')).toBeNull()
    expect(campoDoCodigo('E3011')).toBeNull()
  })

  test('código desconhecido e lixo não viram campo', () => {
    expect(campoDoCodigo('999')).toBeNull()
    expect(campoDoCodigo('')).toBeNull()
    expect(campoDoCodigo('toString')).toBeNull()
    expect(campoDoCodigo('constructor')).toBeNull()
  })

  test('aceita o código em minúsculas', () => {
    expect(campoDoCodigo('e302')).toBe('cvv')
  })
})

describe('mensagemDeToken', () => {
  for (const [codigo, campo, tipo] of TABELA) {
    test(`${codigo} vira mensagem de ${campo} (${tipo})`, () => {
      const mensagem = mensagemDeToken({ cause: [{ code: codigo }] })
      expect(mensagem).not.toBe('')
      expect(mensagem.endsWith('.')).toBe(true)
      // Vazio pede para digitar/informar; inválido pede para conferir.
      expect(/^(Digite|Preencha|Informe)/.test(mensagem)).toBe(tipo === 'vazio')
    })
  }

  test('cada campo tem mensagem própria — nenhum par se repete', () => {
    const mensagens = TABELA.map(([codigo]) =>
      mensagemDeToken({ cause: [{ code: codigo }] })
    )
    // 14 códigos → 5 campos × 2 estados = 10 textos distintos.
    expect(new Set(mensagens).size).toBe(10)
  })

  test('código desconhecido cai na genérica, em português', () => {
    const mensagem = mensagemDeToken({ cause: [{ code: '999' }] })
    expect(mensagem).toBe(
      'Não foi possível validar o cartão. Confira os dados e tente de novo.'
    )
  })

  test('erro sem nenhum código cai na genérica', () => {
    expect(mensagemDeToken(new Error('token_vazio'))).toContain(
      'Não foi possível validar'
    )
    expect(mensagemDeToken(null)).toContain('Não foi possível validar')
    expect(mensagemDeToken(undefined)).toContain('Não foi possível validar')
  })

  test('não repassa a descrição em inglês do SDK', () => {
    const mensagem = mensagemDeToken({
      cause: [{ code: '999', description: 'invalid parameter cardNumber' }],
    })
    expect(mensagem).not.toContain('invalid')
    expect(mensagem).not.toContain('cardNumber')
  })

  test('CVV do Amex: a mensagem diz 4 dígitos', () => {
    expect(mensagemDeToken({ cause: [{ code: '224' }] }, 4)).toBe(
      'Digite os 4 dígitos do código de segurança.'
    )
    expect(mensagemDeToken({ cause: [{ code: 'E302' }] }, 4)).toBe(
      'Confira o código de segurança: são 4 dígitos.'
    )
  })

  test('CVV comum: a mensagem diz 3 dígitos', () => {
    expect(mensagemDeToken({ cause: [{ code: '224' }] }, 3)).toContain(
      '3 dígitos'
    )
  })

  test('sem o comprimento do CVV, a mensagem não inventa um número', () => {
    const mensagem = mensagemDeToken({ cause: [{ code: '224' }] })
    expect(mensagem).toBe('Digite o código de segurança do cartão.')
    expect(mensagem).not.toMatch(/\d/)
  })

  test('comprimento de CVV absurdo é ignorado', () => {
    for (const digitos of [0, 1, 2, 99, 3.5, Number.NaN]) {
      expect(mensagemDeToken({ cause: [{ code: '224' }] }, digitos)).toBe(
        'Digite o código de segurança do cartão.'
      )
    }
  })

  test('o primeiro código reconhecido manda na mensagem e no campo', () => {
    const erro = { cause: [{ code: '999' }, { code: '224' }, { code: '205' }] }
    expect(campoDoErro(erro)).toBe('cvv')
    expect(mensagemDeToken(erro)).toContain('código de segurança')
  })
})

describe('extrairCodigos — tolerante ao formato do erro', () => {
  test('lista crua de causas', () => {
    expect(extrairCodigos([{ code: '205' }, { code: 'E302' }])).toEqual([
      '205',
      'E302',
    ])
  })

  test('objeto com cause', () => {
    expect(extrairCodigos({ cause: [{ code: '324' }] })).toEqual(['324'])
  })

  test('Error com cause não enumerável', () => {
    const erro = new Error('createCardToken', { cause: [{ code: '316' }] })
    expect(extrairCodigos(erro)).toEqual(['316'])
    expect(campoDoErro(erro)).toBe('titular')
  })

  test('lista de códigos soltos', () => {
    expect(extrairCodigos({ cause: ['221', 'E301'] })).toEqual(['221', 'E301'])
  })

  test('código cru como string ou número', () => {
    expect(extrairCodigos('E302')).toEqual(['E302'])
    expect(extrairCodigos(205)).toEqual(['205'])
    expect(extrairCodigos({ code: 214 })).toEqual(['214'])
  })

  test('aninhado em error/errors/response', () => {
    expect(extrairCodigos({ response: { errors: [{ code: '208' }] } })).toEqual([
      '208',
    ])
  })

  test('texto solto NUNCA vira código — nada de casar por substring', () => {
    expect(
      extrairCodigos({ message: 'invalid parameter 221 in cardholderName' })
    ).toEqual([])
    expect(extrairCodigos({ description: '221' })).toEqual([])
    expect(mensagemDeToken({ message: 'security_code 221 E301' })).toContain(
      'Não foi possível validar'
    )
  })

  test('sem código nenhum devolve lista vazia', () => {
    expect(extrairCodigos(null)).toEqual([])
    expect(extrairCodigos(undefined)).toEqual([])
    expect(extrairCodigos({})).toEqual([])
    expect(extrairCodigos([])).toEqual([])
  })

  test('não repete o mesmo código', () => {
    expect(extrairCodigos({ cause: [{ code: '205' }, { code: '205' }] })).toEqual(
      ['205']
    )
  })

  test('normaliza espaços e caixa', () => {
    expect(extrairCodigos({ cause: [{ code: ' e301 ' }] })).toEqual(['E301'])
  })

  test('erro com referência cíclica não trava', () => {
    const erro: Record<string, unknown> = { code: '224' }
    erro.cause = erro
    expect(extrairCodigos(erro)).toEqual(['224'])
  })

  test('aninhamento fundo demais é ignorado em vez de varrer sem fim', () => {
    let fundo: Record<string, unknown> = { code: '205' }
    for (let i = 0; i < 40; i += 1) fundo = { cause: fundo }
    expect(extrairCodigos(fundo)).toEqual([])
  })
})

describe('campoDoSdk', () => {
  test('traduz os nomes de campo do SDK', () => {
    expect(campoDoSdk('cardNumber')).toBe('numero')
    expect(campoDoSdk('securityCode')).toBe('cvv')
    expect(campoDoSdk('expirationDate')).toBe('validade')
    expect(campoDoSdk('expirationMonth')).toBe('validade')
    expect(campoDoSdk('expirationYear')).toBe('validade')
  })

  test('nome desconhecido não vira campo', () => {
    expect(campoDoSdk('cardholderName')).toBeNull()
    expect(campoDoSdk('toString')).toBeNull()
    expect(campoDoSdk('')).toBeNull()
  })
})

describe('mensagemDeValidade', () => {
  test('número incompleto pede para conferir, sem acusar dígito trocado', () => {
    const mensagem = mensagemDeValidade('invalid_length', 'cardNumber')
    expect(mensagem).toBe('Confira o número do cartão.')
    expect(mensagem).not.toContain('trocado')
  })

  test('invalid_type do número cai no mesmo texto', () => {
    expect(mensagemDeValidade('invalid_type', 'cardNumber')).toBe(
      'Confira o número do cartão.'
    )
  })

  test('número reprovado no Luhn aponta o dígito trocado', () => {
    expect(mensagemDeValidade('invalid_value', 'cardNumber')).toBe(
      'Confira o número do cartão — algum dígito está trocado.'
    )
  })

  test('CVV curto diz quantos dígitos são', () => {
    expect(mensagemDeValidade('invalid_length', 'securityCode', 4)).toBe(
      'Digite os 4 dígitos do código de segurança.'
    )
    expect(mensagemDeValidade('invalid_length', 'securityCode', 3)).toBe(
      'Digite os 3 dígitos do código de segurança.'
    )
  })

  test('CVV sem comprimento conhecido não cita número', () => {
    expect(mensagemDeValidade('invalid_length', 'securityCode')).toBe(
      'Digite o código de segurança do cartão.'
    )
  })

  test('validade inválida cita formato e vencimento', () => {
    const mensagem = mensagemDeValidade('invalid_value', 'expirationDate')
    expect(mensagem).toContain('MM/AA')
    expect(mensagem).toContain('venceu')
  })

  test('mês e ano herdam o texto da validade', () => {
    expect(mensagemDeValidade('invalid_value', 'expirationMonth')).toBe(
      mensagemDeValidade('invalid_value', 'expirationDate')
    )
    expect(mensagemDeValidade('invalid_value', 'expirationYear')).toBe(
      mensagemDeValidade('invalid_value', 'expirationDate')
    )
  })

  test('validade incompleta pede o formato', () => {
    expect(mensagemDeValidade('invalid_length', 'expirationDate')).toBe(
      'Preencha a validade do cartão, no formato MM/AA.'
    )
  })

  test('cause ausente ou desconhecida ainda dá mensagem útil', () => {
    expect(mensagemDeValidade(null, 'cardNumber')).toBe(
      'Confira o número do cartão.'
    )
    expect(mensagemDeValidade(undefined, 'securityCode', 3)).toBe(
      'Confira o código de segurança: são 3 dígitos.'
    )
    expect(mensagemDeValidade('causa_nova_do_sdk', 'expirationDate')).toBe(
      'Preencha a validade do cartão, no formato MM/AA.'
    )
  })

  test('campo desconhecido cai na genérica em vez de mentir', () => {
    expect(mensagemDeValidade('invalid_value', 'campoQueNaoExiste')).toBe(
      'Confira os dados do cartão.'
    )
  })
})
