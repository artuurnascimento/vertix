import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import {
  ID_CAMPO_CVV,
  ID_CAMPO_NUMERO,
  ID_CAMPO_VALIDADE,
} from './mpCampos'
import type {
  CampoSeguro,
  InstanciaMp,
  RespostaMetodosPagamento,
  TipoCampo,
} from './mpTipos'
import { obterInstanciaMp } from './mpInstancia'
import { useCamposCartao } from './useCamposCartao'

vi.mock('./mpInstancia', () => ({ obterInstanciaMp: vi.fn() }))

const obterInstancia = vi.mocked(obterInstanciaMp)

// ---------------------------------------------------------------------------
// Dublê do SDK
// ---------------------------------------------------------------------------

type Ouvinte = (dado: unknown) => void

interface CampoDuplo {
  campo: CampoSeguro
  ouvintes: Map<string, Ouvinte[]>
  mount: ReturnType<typeof vi.fn>
  unmount: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
}

function campoDuplo(): CampoDuplo {
  const ouvintes = new Map<string, Ouvinte[]>()
  const mount = vi.fn()
  const unmount = vi.fn()
  const update = vi.fn()
  const campo = {
    mount,
    unmount,
    update,
    on: (evento: string, ouvinte: Ouvinte) => {
      const lista = ouvintes.get(evento) ?? []
      lista.push(ouvinte)
      ouvintes.set(evento, lista)
      return campo
    },
  } as unknown as CampoSeguro
  return { campo, ouvintes, mount, unmount, update }
}

interface SdkDuplo {
  mp: InstanciaMp
  criados: Map<TipoCampo, CampoDuplo>
  create: ReturnType<typeof vi.fn>
  getPaymentMethods: ReturnType<typeof vi.fn>
  getInstallments: ReturnType<typeof vi.fn>
  createCardToken: ReturnType<typeof vi.fn>
}

const SETTINGS_VISA = {
  security_code: { length: 3, card_location: 'back', mode: 'mandatory' },
  card_number: { length: 16, validation: 'standard' },
}
const SETTINGS_AMEX = {
  security_code: { length: 4, card_location: 'front', mode: 'mandatory' },
  card_number: { length: 15, validation: 'standard' },
}

function resposta(
  id: string,
  settings: typeof SETTINGS_VISA
): RespostaMetodosPagamento {
  return {
    results: [
      {
        id,
        name: id,
        payment_type_id: 'credit_card',
        status: 'active',
        settings: [settings],
        additional_info_needed: [],
      },
    ],
  }
}

function sdkDuplo(): SdkDuplo {
  const criados = new Map<TipoCampo, CampoDuplo>()
  const create = vi.fn((tipo: TipoCampo) => {
    const duplo = campoDuplo()
    criados.set(tipo, duplo)
    return duplo.campo
  })
  const getPaymentMethods = vi.fn(async () => resposta('visa', SETTINGS_VISA))
  const getInstallments = vi.fn(async () => [])
  const createCardToken = vi.fn(async () => ({ id: 'tok_1' }))
  const mp = {
    fields: { create, createCardToken },
    getPaymentMethods,
    getInstallments,
  } as unknown as InstanciaMp
  return { mp, criados, create, getPaymentMethods, getInstallments, createCardToken }
}

function prepararContainers(): void {
  document.body.innerHTML = [ID_CAMPO_NUMERO, ID_CAMPO_VALIDADE, ID_CAMPO_CVV]
    .map((id) => `<div id="${id}"></div>`)
    .join('')
}

/** Dispara um evento do SDK como o iframe faria, dentro de `act`. */
async function disparar(
  duplo: CampoDuplo,
  evento: string,
  dado: unknown
): Promise<void> {
  await act(async () => {
    for (const ouvinte of duplo.ouvintes.get(evento) ?? []) ouvinte(dado)
  })
}

let sdk: SdkDuplo

beforeEach(() => {
  sdk = sdkDuplo()
  obterInstancia.mockResolvedValue(sdk.mp)
  prepararContainers()
})

afterEach(() => {
  document.body.innerHTML = ''
  vi.useRealTimers()
  vi.clearAllMocks()
})

/** Renderiza e espera o SDK responder e os campos montarem. */
async function montarHook() {
  const resultado = renderHook(() => useCamposCartao())
  await waitFor(() => expect(sdk.create).toHaveBeenCalled())
  return resultado
}

// ---------------------------------------------------------------------------

describe('montagem e ciclo de vida', () => {
  test('cria os três campos e monta cada um no seu container', async () => {
    await montarHook()

    expect(sdk.create).toHaveBeenCalledTimes(3)
    expect(sdk.criados.get('cardNumber')?.mount).toHaveBeenCalledWith(
      ID_CAMPO_NUMERO
    )
    expect(sdk.criados.get('expirationDate')?.mount).toHaveBeenCalledWith(
      ID_CAMPO_VALIDADE
    )
    expect(sdk.criados.get('securityCode')?.mount).toHaveBeenCalledWith(
      ID_CAMPO_CVV
    )
  })

  test('nunca cria expirationMonth nem expirationYear', async () => {
    await montarHook()

    const tipos = sdk.create.mock.calls.map(([tipo]) => tipo)
    expect(tipos).not.toContain('expirationMonth')
    expect(tipos).not.toContain('expirationYear')
  })

  /**
   * O caso que o StrictMode do React 19 provoca em desenvolvimento: o efeito é
   * limpo antes de o SDK responder. Simulado à mão porque o double-invoke do
   * StrictMode não acontece sob o vitest — encenar a corrida é a única forma de
   * o teste realmente cobrir o guard.
   */
  test('instância que chega depois da limpeza não cria campo órfão', async () => {
    let entregar: (mp: InstanciaMp) => void = () => {}
    obterInstancia.mockReturnValue(
      new Promise<InstanciaMp>((resolve) => {
        entregar = resolve
      })
    )

    const { unmount } = renderHook(() => useCamposCartao())
    act(() => unmount())
    await act(async () => entregar(sdk.mp))

    // Campo criado aqui ficaria com um iframe que ninguém desmonta.
    expect(sdk.create).not.toHaveBeenCalled()
  })

  test('ciclo seguinte monta uma geração só de campos', async () => {
    const primeiro = renderHook(() => useCamposCartao())
    await waitFor(() => expect(sdk.create).toHaveBeenCalledTimes(3))
    act(() => primeiro.unmount())

    await montarHook()

    expect(sdk.create).toHaveBeenCalledTimes(6)
    // Cada campo, do seu ciclo, montou e desmontou uma vez só — o SDK lança em
    // `mount` repetido e em `unmount` repetido.
    for (const duplo of sdk.criados.values()) {
      expect(duplo.mount).toHaveBeenCalledTimes(1)
    }
  })

  test('desmonta os três campos ao sair da tela', async () => {
    const { unmount } = await montarHook()
    act(() => unmount())

    for (const duplo of sdk.criados.values()) {
      expect(duplo.unmount).toHaveBeenCalledTimes(1)
    }
  })

  test('SDK indisponível vira falha "sdk", sem derrubar a tela', async () => {
    obterInstancia.mockRejectedValue(new Error('sdk_indisponivel'))
    const { result } = renderHook(() => useCamposCartao())

    await waitFor(() => expect(result.current.falha).toBe('sdk'))
    expect(result.current.prontos).toBe(false)
  })

  test('container que ainda não existe é reesperado, não perdido', async () => {
    document.body.innerHTML = ''
    const { result } = renderHook(() => useCamposCartao())
    await waitFor(() => expect(sdk.create).toHaveBeenCalled())

    const numero = sdk.criados.get('cardNumber')
    expect(numero?.mount).not.toHaveBeenCalled()

    prepararContainers()
    await waitFor(() => expect(numero?.mount).toHaveBeenCalledWith(ID_CAMPO_NUMERO))
    expect(result.current.falha).toBeNull()
  })

  test('container que nunca aparece vira falha "montagem"', async () => {
    vi.useFakeTimers()
    document.body.innerHTML = ''
    const { result } = renderHook(() => useCamposCartao())

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000)
    })

    expect(result.current.falha).toBe('montagem')
  })

  test('ativo: false não toca no SDK', async () => {
    const { result } = renderHook(() => useCamposCartao({ ativo: false }))

    await act(async () => {})
    expect(obterInstancia).not.toHaveBeenCalled()
    expect(result.current.buscarParcelas).toBeNull()
  })
})

describe('estado por campo', () => {
  test('ready marca pronto e prontos só com os três', async () => {
    const { result } = await montarHook()
    expect(result.current.prontos).toBe(false)

    await disparar(sdk.criados.get('cardNumber')!, 'ready', {
      field: 'cardNumber',
    })
    expect(result.current.estados.numero.pronto).toBe(true)
    expect(result.current.prontos).toBe(false)

    await disparar(sdk.criados.get('expirationDate')!, 'ready', {
      field: 'expirationDate',
    })
    await disparar(sdk.criados.get('securityCode')!, 'ready', {
      field: 'securityCode',
    })
    expect(result.current.prontos).toBe(true)
  })

  test('foco sai de um campo e entra no outro sem apagar o destino', async () => {
    const { result } = await montarHook()
    const numero = sdk.criados.get('cardNumber')!
    const validade = sdk.criados.get('expirationDate')!

    await disparar(numero, 'focus', { field: 'cardNumber' })
    expect(result.current.campoFocado).toBe('numero')
    expect(result.current.estados.numero.focado).toBe(true)

    // O focus do destino chega antes do blur da origem — a ordem real do SDK.
    await disparar(validade, 'focus', { field: 'expirationDate' })
    await disparar(numero, 'blur', { field: 'cardNumber' })

    expect(result.current.campoFocado).toBe('validade')
    expect(result.current.estados.numero.focado).toBe(false)
    expect(result.current.estados.numero.tocado).toBe(true)
  })

  test('validityChange sem erros deixa o campo válido e sem mensagem', async () => {
    const { result } = await montarHook()

    await disparar(sdk.criados.get('cardNumber')!, 'validityChange', {
      field: 'cardNumber',
      errorMessages: [],
    })

    expect(result.current.estados.numero.valido).toBe(true)
    expect(result.current.estados.numero.erro).toBeNull()
  })

  test('validityChange com erro traduz a causa para pt-BR', async () => {
    const { result } = await montarHook()

    await disparar(sdk.criados.get('cardNumber')!, 'validityChange', {
      field: 'cardNumber',
      errorMessages: [{ message: 'invalid', cause: 'invalid_value' }],
    })

    expect(result.current.estados.numero.valido).toBe(false)
    expect(result.current.estados.numero.erro).toContain('dígito está trocado')
  })

  test('mensagem do CVV usa o comprimento vindo do BIN, não um chute', async () => {
    const { result } = await montarHook()
    sdk.getPaymentMethods.mockResolvedValue(resposta('amex', SETTINGS_AMEX))

    await disparar(sdk.criados.get('cardNumber')!, 'binChange', {
      field: 'cardNumber',
      bin: '37118030',
    })
    await waitFor(() => expect(result.current.digitosCvv).toBe(4))

    await disparar(sdk.criados.get('securityCode')!, 'validityChange', {
      field: 'securityCode',
      errorMessages: [{ message: 'invalid', cause: 'invalid_length' }],
    })

    expect(result.current.estados.cvv.erro).toContain('4 dígitos')
  })

  test('todosValidos exige os três', async () => {
    const { result } = await montarHook()

    for (const [tipo, field] of [
      ['cardNumber', 'cardNumber'],
      ['expirationDate', 'expirationDate'],
    ] as const) {
      await disparar(sdk.criados.get(tipo)!, 'validityChange', {
        field,
        errorMessages: [],
      })
    }
    expect(result.current.todosValidos).toBe(false)

    await disparar(sdk.criados.get('securityCode')!, 'validityChange', {
      field: 'securityCode',
      errorMessages: [],
    })
    expect(result.current.todosValidos).toBe(true)
  })

  test('error do SDK não desfaz a validade já conquistada', async () => {
    const { result } = await montarHook()
    const numero = sdk.criados.get('cardNumber')!

    await disparar(numero, 'validityChange', {
      field: 'cardNumber',
      errorMessages: [],
    })
    await disparar(numero, 'error', { field: 'cardNumber', error: 'boom' })

    expect(result.current.estados.numero.valido).toBe(true)
    expect(result.current.estados.numero.erro).toContain('Atualize a página')
  })

  test('marcarErro pendura e limpa a mensagem do campo', async () => {
    const { result } = await montarHook()

    act(() => result.current.marcarErro('cvv', 'Confira o código.'))
    expect(result.current.estados.cvv.erro).toBe('Confira o código.')
    expect(result.current.estados.cvv.tocado).toBe(true)

    act(() => result.current.marcarErro('cvv', null))
    expect(result.current.estados.cvv.erro).toBeNull()
  })
})

describe('binChange', () => {
  test('BIN repetido não gera consulta nova', async () => {
    const { result } = await montarHook()
    const numero = sdk.criados.get('cardNumber')!

    await disparar(numero, 'binChange', { field: 'cardNumber', bin: '45516600' })
    await waitFor(() => expect(result.current.bandeira).toBe('visa'))
    await disparar(numero, 'binChange', { field: 'cardNumber', bin: '45516600' })

    expect(sdk.getPaymentMethods).toHaveBeenCalledTimes(1)
    expect(result.current.bin).toBe('45516600')
  })

  test('aplica os settings do BIN nos campos — sem isso o Amex não passa', async () => {
    sdk.getPaymentMethods.mockResolvedValue(resposta('amex', SETTINGS_AMEX))
    const { result } = await montarHook()

    await disparar(sdk.criados.get('cardNumber')!, 'binChange', {
      field: 'cardNumber',
      bin: '37118030',
    })

    await waitFor(() => expect(result.current.bandeira).toBe('amex'))
    expect(sdk.criados.get('securityCode')?.update).toHaveBeenCalledWith({
      settings: { mode: 'mandatory', length: 4 },
    })
    expect(sdk.criados.get('cardNumber')?.update).toHaveBeenCalledWith({
      settings: { length: 15, validation: 'standard' },
    })
    expect(result.current.digitosCvv).toBe(4)
    expect(result.current.cvvNaFrente).toBe(true)
  })

  test('bandeira com CVV atrás não pede giro do cartão', async () => {
    const { result } = await montarHook()

    await disparar(sdk.criados.get('cardNumber')!, 'binChange', {
      field: 'cardNumber',
      bin: '45516600',
    })

    await waitFor(() => expect(result.current.cvvNaFrente).toBe(false))
    expect(result.current.digitosCvv).toBe(3)
  })

  test('BIN nulo limpa bandeira e settings sem consultar o MP', async () => {
    const { result } = await montarHook()
    const numero = sdk.criados.get('cardNumber')!

    await disparar(numero, 'binChange', { field: 'cardNumber', bin: '45516600' })
    await waitFor(() => expect(result.current.bandeira).toBe('visa'))

    await disparar(numero, 'binChange', { field: 'cardNumber', bin: null })

    expect(result.current.bin).toBeNull()
    expect(result.current.bandeira).toBeNull()
    expect(result.current.settings).toBeNull()
    expect(sdk.getPaymentMethods).toHaveBeenCalledTimes(1)
  })

  test('falha na consulta de BIN não trava nada', async () => {
    sdk.getPaymentMethods.mockRejectedValue(new Error('rede'))
    const { result } = await montarHook()

    await disparar(sdk.criados.get('cardNumber')!, 'binChange', {
      field: 'cardNumber',
      bin: '45516600',
    })

    await waitFor(() => expect(result.current.bin).toBe('45516600'))
    expect(result.current.bandeira).toBeNull()
    expect(result.current.falha).toBeNull()
  })

  test('resposta atrasada de um BIN antigo não sobrescreve o atual', async () => {
    const { result } = await montarHook()
    const numero = sdk.criados.get('cardNumber')!

    let liberarPrimeira: (valor: RespostaMetodosPagamento) => void = () => {}
    sdk.getPaymentMethods.mockImplementationOnce(
      () =>
        new Promise<RespostaMetodosPagamento>((resolve) => {
          liberarPrimeira = resolve
        })
    )
    sdk.getPaymentMethods.mockResolvedValueOnce(resposta('amex', SETTINGS_AMEX))

    await disparar(numero, 'binChange', { field: 'cardNumber', bin: '45516600' })
    await disparar(numero, 'binChange', { field: 'cardNumber', bin: '37118030' })
    await waitFor(() => expect(result.current.bandeira).toBe('amex'))

    await act(async () => {
      liberarPrimeira(resposta('visa', SETTINGS_VISA))
    })

    expect(result.current.bandeira).toBe('amex')
  })
})

describe('parcelas e tokens', () => {
  test('buscarParcelas só existe depois do SDK e chama getInstallments', async () => {
    const { result } = renderHook(() => useCamposCartao())
    expect(result.current.buscarParcelas).toBeNull()

    await waitFor(() => expect(result.current.buscarParcelas).not.toBeNull())
    const parametros = {
      amount: '197.00',
      bin: '45516600',
      locale: 'pt-BR',
      paymentTypeId: 'credit_card',
    }
    await result.current.buscarParcelas?.(parametros)

    expect(sdk.getInstallments).toHaveBeenCalledWith(parametros)
  })

  test('gerarTokens devolve o principal e o de salvar, nesta ordem', async () => {
    sdk.createCardToken
      .mockResolvedValueOnce({ id: 'tok_cobranca' })
      .mockResolvedValueOnce({ id: 'tok_salvar' })
    const { result } = await montarHook()

    const tokens = await result.current.gerarTokens({
      nomeTitular: 'Maria Souza',
      documento: '529.982.247-25',
    })

    expect(tokens).toEqual({ token: 'tok_cobranca', tokenSalvar: 'tok_salvar' })
    expect(sdk.createCardToken).toHaveBeenCalledTimes(2)
    expect(sdk.createCardToken).toHaveBeenNthCalledWith(1, {
      cardholderName: 'Maria Souza',
      identificationType: 'CPF',
      identificationNumber: '52998224725',
    })
  })

  test('falha do segundo token não derruba a venda', async () => {
    sdk.createCardToken
      .mockResolvedValueOnce({ id: 'tok_cobranca' })
      .mockRejectedValueOnce(new Error('recusado'))
    const { result } = await montarHook()

    const tokens = await result.current.gerarTokens({
      nomeTitular: 'Maria Souza',
      documento: '52998224725',
    })

    expect(tokens.token).toBe('tok_cobranca')
    expect(tokens.tokenSalvar).toBeNull()
  })

  test('falha do primeiro token sobe crua, com os códigos do SDK', async () => {
    const cru = { cause: [{ code: '224', description: 'invalid securityCode' }] }
    sdk.createCardToken.mockRejectedValueOnce(cru)
    const { result } = await montarHook()

    await expect(
      result.current.gerarTokens({
        nomeTitular: 'Maria Souza',
        documento: '52998224725',
      })
    ).rejects.toBe(cru)
    // O acessório nem chega a ser pedido: a venda já parou.
    expect(sdk.createCardToken).toHaveBeenCalledTimes(1)
  })

  test('gerarTokens antes do SDK falha explicitamente', async () => {
    obterInstancia.mockReturnValue(new Promise(() => {}))
    const { result } = renderHook(() => useCamposCartao())

    await expect(
      result.current.gerarTokens({ nomeTitular: 'Maria', documento: '1' })
    ).rejects.toThrow('sdk_indisponivel')
  })
})
