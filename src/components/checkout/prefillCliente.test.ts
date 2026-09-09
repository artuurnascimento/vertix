import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buscarPrefill,
  telefoneParaCampo,
  tokenValido,
} from './prefillCliente'
import { supabase } from '../../lib/supabase'

/**
 * Preenchimento do formulário do comprador. Arquivo de teste: sem
 * importadores, rodado pelo Vitest.
 *
 * O que se protege aqui é a diferença entre "campo preenchido" e "campo
 * preenchido CERTO". Ninguém confere um formulário que já veio cheio — é o
 * ponto dele. Então um telefone truncado, um e-mail de outra pessoa ou um
 * silêncio virando objeto vazio não são incômodos de tela: viram cobrança no
 * cartão com dado errado, ou recibo indo para o endereço errado.
 */

vi.mock('../../lib/supabase', () => ({
  supabase: { rpc: vi.fn() },
}))

const rpc = vi.mocked(supabase.rpc)
const TOKEN = '2f1c0a5e-7c3b-4a90-9c1d-6b0f5a8e4d21'

function responde(data: unknown, error: unknown = null) {
  rpc.mockResolvedValue({ data, error } as never)
}

beforeEach(() => rpc.mockReset())

describe('telefoneParaCampo', () => {
  it('tira o +55 do E.164 e devolve mascarado', () => {
    expect(telefoneParaCampo('+5562999998888')).toBe('(62) 99999-8888')
  })

  it('aceita número já sem código do país', () => {
    expect(telefoneParaCampo('62999998888')).toBe('(62) 99999-8888')
  })

  it('preserva o DDD 55 de quem é do Rio Grande do Sul', () => {
    // 55 + 9 dígitos = 11: é DDD, não código do país. Cortar aqui daria
    // (99) 9999-8888 — outro estado, e o comprador não repara.
    expect(telefoneParaCampo('55999998888')).toBe('(55) 99999-8888')
    // Com o código do país junto (13 dígitos), aí sim o primeiro 55 sai.
    expect(telefoneParaCampo('+5555999998888')).toBe('(55) 99999-8888')
  })

  it('aceita fixo de oito dígitos', () => {
    expect(telefoneParaCampo('+556232221100')).toBe('(62) 3222-1100')
  })

  it('devolve vazio para o que não cabe em número brasileiro', () => {
    // Campo em branco é honesto; campo com número cortado parece preenchido
    // e passa direto pela conferência de quem está pagando.
    expect(telefoneParaCampo('+1 415 555 0000')).toBe('')
    expect(telefoneParaCampo('0899999888')).toBe('')
    expect(telefoneParaCampo('999')).toBe('')
    expect(telefoneParaCampo(null)).toBe('')
    expect(telefoneParaCampo(undefined)).toBe('')
    expect(telefoneParaCampo(62999998888)).toBe('')
  })
})

describe('tokenValido', () => {
  it('exige forma de uuid', () => {
    expect(tokenValido(TOKEN)).toBe(true)
    expect(tokenValido(TOKEN.toUpperCase())).toBe(true)
    expect(tokenValido('abc')).toBe(false)
    expect(tokenValido('')).toBe(false)
    expect(tokenValido(null)).toBe(false)
  })
})

describe('buscarPrefill', () => {
  it('devolve os campos prontos para a tela', async () => {
    responde({
      nome: ' Ana Souza ',
      email: ' ANA@Loja.com.BR ',
      whatsapp: '+5562999998888',
    })

    await expect(buscarPrefill(TOKEN)).resolves.toEqual({
      nome: 'Ana Souza',
      email: 'ana@loja.com.br',
      whatsapp: '(62) 99999-8888',
    })
    expect(rpc).toHaveBeenCalledWith('get_checkout_prefill', {
      p_token: TOKEN,
    })
  })

  it('não sai pela rede com token de forma errada', async () => {
    await expect(buscarPrefill('nao-e-uuid')).resolves.toBeNull()
    expect(rpc).not.toHaveBeenCalled()
  })

  it('erro da RPC não vira exceção — vira formulário vazio', async () => {
    // O preenchimento é conveniência. Se ele derrubar a página, o custo de um
    // banco indisponível deixa de ser "digitar de novo" e passa a ser "não
    // consigo pagar".
    responde(null, { message: 'boom' })
    await expect(buscarPrefill(TOKEN)).resolves.toBeNull()
  })

  it('token sem cobrança correspondente devolve null', async () => {
    responde(null)
    await expect(buscarPrefill(TOKEN)).resolves.toBeNull()
  })

  it('linha sem nome e sem e-mail não conta como preenchimento', async () => {
    // Senão a tela anunciaria "preenchemos com os dados da sua análise" com
    // três campos vazios embaixo.
    responde({ nome: null, email: null, whatsapp: null })
    await expect(buscarPrefill(TOKEN)).resolves.toBeNull()
  })

  it('telefone impróprio não impede o resto do preenchimento', async () => {
    responde({ nome: 'Ana', email: 'ana@loja.com.br', whatsapp: 'sem número' })

    await expect(buscarPrefill(TOKEN)).resolves.toEqual({
      nome: 'Ana',
      email: 'ana@loja.com.br',
      whatsapp: '',
    })
  })
})
