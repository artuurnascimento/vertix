import { afterEach, describe, expect, test, vi } from 'vitest'
import {
  ESTILO_CAMPO,
  FONTES_CAMPO,
  ID_CAMPO_CVV,
  ID_CAMPO_NUMERO,
  ID_CAMPO_VALIDADE,
  atualizarSettings,
  criarCampos,
  criarToken,
  criarTokenAcessorio,
  dadosNaoPci,
  desmontarTudo,
  montar,
  primeiroMetodo,
  settingsDoMetodo,
  tipoDeDocumento,
  type CamposCartao,
} from './mpCampos'
import type {
  CampoSeguro,
  CardTokenResponse,
  InstanciaMp,
  RespostaMetodosPagamento,
  SettingsCartao,
} from './mpTipos'

// ---------------------------------------------------------------------------
// Dublês do SDK
// ---------------------------------------------------------------------------

interface CampoFalso {
  campo: CampoSeguro
  mount: ReturnType<typeof vi.fn>
  unmount: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
}

function campoFalso(): CampoFalso {
  const mount = vi.fn()
  const unmount = vi.fn()
  const update = vi.fn()
  const campo = { mount, unmount, update, on: vi.fn() } as unknown as CampoSeguro
  return { campo, mount, unmount, update }
}

function camposFalsos(): { campos: CamposCartao; partes: CampoFalso[] } {
  const partes = [campoFalso(), campoFalso(), campoFalso()]
  return {
    campos: {
      numero: partes[0].campo,
      validade: partes[1].campo,
      cvv: partes[2].campo,
    },
    partes,
  }
}

function instanciaFalsa(
  createCardToken: InstanciaMp['fields']['createCardToken'] = vi.fn()
): { mp: InstanciaMp; create: ReturnType<typeof vi.fn> } {
  const create = vi.fn(() => campoFalso().campo)
  const mp = {
    fields: { create, createCardToken },
    getPaymentMethods: vi.fn(),
    getInstallments: vi.fn(),
  } as unknown as InstanciaMp
  return { mp, create }
}

function prepararContainers(): void {
  document.body.innerHTML = [
    ID_CAMPO_NUMERO,
    ID_CAMPO_VALIDADE,
    ID_CAMPO_CVV,
  ]
    .map((id) => `<div id="${id}"></div>`)
    .join('')
}

afterEach(() => {
  document.body.innerHTML = ''
  vi.useRealTimers()
})

const TITULAR = { nomeTitular: '  Maria Souza  ', documento: '529.982.247-25' }

// ---------------------------------------------------------------------------

describe('ESTILO_CAMPO e FONTES_CAMPO', () => {
  test('não carrega propriedade fora da lista aceita pelo iframe', () => {
    const aceitas = new Set([
      'color',
      'fontFamily',
      'fontSize',
      'fontStyle',
      'fontVariant',
      'fontWeight',
      'height',
      'margin',
      'marginBottom',
      'marginLeft',
      'marginRight',
      'marginTop',
      'padding',
      'paddingBottom',
      'paddingLeft',
      'paddingRight',
      'paddingTop',
      'placeholderColor',
      'textAlign',
      'width',
    ])
    for (const chave of Object.keys(ESTILO_CAMPO)) {
      expect(aceitas.has(chave)).toBe(true)
    }
  })

  test('fontFamily só vale acompanhado de customFonts', () => {
    expect(ESTILO_CAMPO.fontFamily).toBeTruthy()
    expect(FONTES_CAMPO.length).toBeGreaterThan(0)
    expect(FONTES_CAMPO[0].src).toContain(String(ESTILO_CAMPO.fontFamily))
  })
})

describe('criarCampos', () => {
  test('cria exatamente número, validade única e CVV', () => {
    const { mp, create } = instanciaFalsa()
    criarCampos(mp)

    const tipos = create.mock.calls.map((chamada) => chamada[0])
    expect(tipos).toEqual(['cardNumber', 'expirationDate', 'securityCode'])
    // expirationDate não pode coexistir com mês/ano — o SDK lança e o
    // formulário inteiro cai.
    expect(tipos).not.toContain('expirationMonth')
    expect(tipos).not.toContain('expirationYear')
  })

  test('todo campo nasce com estilo, fonte e rótulo de leitor de tela', () => {
    const { mp, create } = instanciaFalsa()
    criarCampos(mp)

    for (const [, opcoes] of create.mock.calls) {
      expect(opcoes.style).toBe(ESTILO_CAMPO)
      expect(opcoes.customFonts).toBe(FONTES_CAMPO)
      expect(opcoes.srLabel).toBeTruthy()
      expect(opcoes.ariaRequired).toBe(true)
    }
  })

  test('não monta nada por conta própria', () => {
    const { mp } = instanciaFalsa()
    const campos = criarCampos(mp)
    expect(campos.numero).toBeDefined()
    expect(document.body.innerHTML).toBe('')
  })
})

describe('montar', () => {
  test('monta os três nos ids certos quando os containers existem', () => {
    prepararContainers()
    const { campos, partes } = camposFalsos()

    expect(montar(campos)).toBe(true)
    expect(partes[0].mount).toHaveBeenCalledWith(ID_CAMPO_NUMERO)
    expect(partes[1].mount).toHaveBeenCalledWith(ID_CAMPO_VALIDADE)
    expect(partes[2].mount).toHaveBeenCalledWith(ID_CAMPO_CVV)
  })

  test('não monta NENHUM se faltar um container', () => {
    document.body.innerHTML = `<div id="${ID_CAMPO_NUMERO}"></div>`
    const { campos, partes } = camposFalsos()

    expect(montar(campos)).toBe(false)
    // Meio formulário montado é pior que nenhum: o SDK lança em mount() com
    // container nulo e deixaria número e validade órfãos.
    for (const parte of partes) expect(parte.mount).not.toHaveBeenCalled()
  })

  test('engole "already mounted" e segue montando os demais', () => {
    prepararContainers()
    const { campos, partes } = camposFalsos()
    partes[0].mount.mockImplementation(() => {
      throw new Error('already mounted')
    })

    expect(() => montar(campos)).not.toThrow()
    expect(partes[1].mount).toHaveBeenCalledOnce()
    expect(partes[2].mount).toHaveBeenCalledOnce()
  })
})

describe('desmontarTudo', () => {
  test('desmonta os três', () => {
    const { campos, partes } = camposFalsos()
    desmontarTudo(campos)
    for (const parte of partes) expect(parte.unmount).toHaveBeenCalledOnce()
  })

  test('um "already unmounted" não impede os outros de sair', () => {
    const { campos, partes } = camposFalsos()
    partes[0].unmount.mockImplementation(() => {
      throw new Error("Field 'cardNumber' already unmounted")
    })

    expect(() => desmontarTudo(campos)).not.toThrow()
    expect(partes[1].unmount).toHaveBeenCalledOnce()
    expect(partes[2].unmount).toHaveBeenCalledOnce()
  })
})

// ---------------------------------------------------------------------------

const SETTINGS_AMEX: SettingsCartao = {
  security_code: { length: 4, card_location: 'front', mode: 'mandatory' },
  card_number: { length: 15, validation: 'standard' },
}

function resposta(settings: SettingsCartao[]): RespostaMetodosPagamento {
  return {
    results: [
      {
        id: 'amex',
        name: 'American Express',
        payment_type_id: 'credit_card',
        status: 'active',
        settings,
        additional_info_needed: ['cardholder_name'],
      },
    ],
  }
}

describe('primeiroMetodo e settingsDoMetodo', () => {
  test('lê o método e o settings pelo índice zero do ARRAY', () => {
    const metodo = primeiroMetodo(resposta([SETTINGS_AMEX]))
    expect(metodo?.id).toBe('amex')
    expect(settingsDoMetodo(metodo)?.security_code.length).toBe(4)
  })

  test('devolve null sem quebrar quando não há resultado nem settings', () => {
    expect(primeiroMetodo(null)).toBeNull()
    expect(primeiroMetodo({ results: [] })).toBeNull()
    expect(settingsDoMetodo(primeiroMetodo(resposta([])))).toBeNull()
    expect(settingsDoMetodo(null)).toBeNull()
  })
})

describe('atualizarSettings', () => {
  test('manda modo e comprimento no CVV e comprimento e validação no número', () => {
    const { campos, partes } = camposFalsos()
    atualizarSettings(campos, SETTINGS_AMEX)

    expect(partes[2].update).toHaveBeenCalledWith({
      settings: { mode: 'mandatory', length: 4 },
    })
    expect(partes[0].update).toHaveBeenCalledWith({
      settings: { length: 15, validation: 'standard' },
    })
  })

  test('não manda card_location — update() não aceita', () => {
    const { campos, partes } = camposFalsos()
    atualizarSettings(campos, SETTINGS_AMEX)

    const enviado = JSON.stringify(partes[2].update.mock.calls)
    expect(enviado).not.toContain('card_location')
    expect(enviado).not.toContain('front')
  })

  test('campo desmontado no meio da resposta do BIN não derruba a tela', () => {
    const { campos, partes } = camposFalsos()
    partes[2].update.mockImplementation(() => {
      throw new Error('field is not mounted')
    })

    expect(() => atualizarSettings(campos, SETTINGS_AMEX)).not.toThrow()
    expect(partes[0].update).toHaveBeenCalledOnce()
  })
})

// ---------------------------------------------------------------------------

describe('tipoDeDocumento', () => {
  test('até onze dígitos é CPF, acima é CNPJ', () => {
    expect(tipoDeDocumento('529.982.247-25')).toBe('CPF')
    expect(tipoDeDocumento('52998224725')).toBe('CPF')
    expect(tipoDeDocumento('54.203.421/0001-49')).toBe('CNPJ')
    expect(tipoDeDocumento('54203421000149')).toBe('CNPJ')
  })
})

describe('dadosNaoPci', () => {
  test('produz apenas os três campos não-PCI, com documento só em dígitos', () => {
    expect(dadosNaoPci(TITULAR)).toEqual({
      cardholderName: 'Maria Souza',
      identificationType: 'CPF',
      identificationNumber: '52998224725',
    })
  })

  test('nunca inclui dado de cartão — o SDK lê isso dos iframes', () => {
    const chaves = Object.keys(dadosNaoPci(TITULAR))
    for (const proibida of [
      'cardNumber',
      'securityCode',
      'expirationMonth',
      'expirationYear',
      'expirationDate',
    ]) {
      expect(chaves).not.toContain(proibida)
    }
  })
})

describe('criarToken', () => {
  test('devolve o id e envia só o nonPCIData', async () => {
    const createCardToken = vi.fn(
      async (): Promise<CardTokenResponse> => ({ id: 'tok_1' })
    )
    const { mp } = instanciaFalsa(createCardToken)

    await expect(criarToken(mp, TITULAR)).resolves.toBe('tok_1')
    expect(createCardToken).toHaveBeenCalledWith(dadosNaoPci(TITULAR))
  })

  test('lança token_vazio quando o SDK resolve sem nada', async () => {
    const { mp } = instanciaFalsa(vi.fn(async () => undefined))
    await expect(criarToken(mp, TITULAR)).rejects.toThrow('token_vazio')
  })

  test('lança token_vazio quando vem resposta sem id', async () => {
    const { mp } = instanciaFalsa(vi.fn(async () => ({ last_four_digits: '4321' })))
    await expect(criarToken(mp, TITULAR)).rejects.toThrow('token_vazio')
  })

  test('propaga o erro cru do SDK — é dele que sai o código do campo', async () => {
    const cru = { cause: [{ code: '224', description: 'invalid securityCode' }] }
    const { mp } = instanciaFalsa(
      vi.fn(() => Promise.reject(cru)) as unknown as InstanciaMp['fields']['createCardToken']
    )
    await expect(criarToken(mp, TITULAR)).rejects.toBe(cru)
  })
})

describe('criarTokenAcessorio', () => {
  test('devolve o token quando dá certo', async () => {
    const { mp } = instanciaFalsa(vi.fn(async () => ({ id: 'tok_2' })))
    await expect(criarTokenAcessorio(mp, TITULAR)).resolves.toBe('tok_2')
  })

  test('devolve null em vez de lançar — a venda principal segue', async () => {
    const { mp } = instanciaFalsa(
      vi.fn(() =>
        Promise.reject(new Error('falhou'))
      ) as unknown as InstanciaMp['fields']['createCardToken']
    )
    await expect(criarTokenAcessorio(mp, TITULAR)).resolves.toBeNull()
  })

  test('devolve null no teto de tempo em vez de pendurar o botão de pagar', async () => {
    vi.useFakeTimers()
    const { mp } = instanciaFalsa(
      vi.fn(() => new Promise<CardTokenResponse>(() => {}))
    )

    const promessa = criarTokenAcessorio(mp, TITULAR, 5000)
    await vi.advanceTimersByTimeAsync(5000)
    await expect(promessa).resolves.toBeNull()
  })
})
