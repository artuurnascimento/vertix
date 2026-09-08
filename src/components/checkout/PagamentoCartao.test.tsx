/**
 * Testes do orquestrador do cartão.
 *
 * Este arquivo não estava na lista do agente E — foi criado porque a
 * verificação achou um bug de dinheiro que nenhum teste puro pegaria: dois
 * cliques no MESMO quadro produziam DUAS cobranças. `formDataCartao.test.ts`
 * prova que o payload está certo; só um teste de componente prova que ele é
 * enviado uma vez só, e com a parcela que a pessoa escolheu na tela.
 *
 * Cada asserção aqui foi confirmada por mutação (a mutação derruba o teste):
 *   - trocar a ref de envio por estado          → duplo clique vira 2 cobranças
 *   - fixar `installments: 1`                   → 12x escolhido vira à vista
 *   - remover a validação antes de tokenizar    → venda segue sem documento
 */

import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import PagamentoCartao from './PagamentoCartao'

type Handler = (payload: unknown) => void

/** Handlers que o hook registrou em cada campo, por tipo do SDK. */
const registrados = new Map<string, Map<string, Handler[]>>()

function campoFalso(tipo: string) {
  const mapa = new Map<string, Handler[]>()
  registrados.set(tipo, mapa)
  return {
    on: (evento: string, fn: Handler) => {
      const lista = mapa.get(evento) ?? []
      lista.push(fn)
      mapa.set(evento, lista)
      return undefined
    },
    mount: vi.fn(),
    unmount: vi.fn(),
    update: vi.fn(),
  }
}

function disparar(tipo: string, evento: string, payload: unknown) {
  for (const fn of registrados.get(tipo)?.get(evento) ?? []) fn(payload)
}

/** Ímpar = token da cobrança; par = token acessório (o que salva o cartão). */
let chamadasDeToken = 0
const createCardToken = vi.fn().mockImplementation(() => {
  chamadasDeToken += 1
  return Promise.resolve({
    id: chamadasDeToken % 2 === 1 ? 'tok_principal' : 'tok_salvar',
  })
})

/** Resposta real medida em R$ 197 (item 5.3 do plano), reduzida a duas opções. */
const mpFalso = {
  fields: { create: (tipo: string) => campoFalso(tipo), createCardToken },
  getPaymentMethods: vi.fn().mockResolvedValue({
    results: [
      {
        id: 'visa',
        settings: [
          {
            security_code: { length: 3, mode: 'mandatory', card_location: 'back' },
            card_number: { length: 16, validation: 'standard' },
          },
        ],
      },
    ],
  }),
  getInstallments: vi.fn().mockResolvedValue([
    {
      payment_method_id: 'visa',
      // String de propósito: `getInstallments` devolve "26" onde
      // `getPaymentMethods` devolve 26. O payload não pode converter.
      issuer: { id: '26' },
      payer_costs: [
        {
          installments: 1,
          installment_amount: 197,
          total_amount: 197,
          installment_rate: 0,
          recommended_message: '1x de R$ 197,00',
        },
        {
          installments: 12,
          installment_amount: 20.05,
          total_amount: 240.56,
          installment_rate: 22.11,
          recommended_message: '12 parcelas de R$ 20,05 (R$ 240,56)',
        },
      ],
    },
  ]),
}

vi.mock('./campos/mpInstancia', () => ({
  obterInstanciaMp: () => Promise.resolve(mpFalso),
  esquecerInstanciaMp: () => undefined,
}))

afterEach(() => {
  registrados.clear()
  chamadasDeToken = 0
  // O mock é compartilhado entre os testes: sem limpar, "não foi tokenizado"
  // passaria a contar as chamadas dos testes anteriores.
  createCardToken.mockClear()
})

const CPF_VALIDO = '123.456.789-09'

function montarTela(props: {
  onSubmit: (formData: unknown, tokenSalvar: string | null) => Promise<void>
  documento?: string
  totalCentavos?: number
}) {
  return render(
    <PagamentoCartao
      totalCentavos={props.totalCentavos ?? 19700}
      documento={props.documento ?? CPF_VALIDO}
      processando={false}
      onSubmit={props.onSubmit}
    />
  )
}

/** Espera os três campos existirem e registrarem seus handlers. */
async function esperarCampos() {
  await waitFor(() => expect(registrados.size).toBe(3))
}

/** Encena o que o SDK manda quando o cartão inteiro fica válido. */
function preencherCartao() {
  act(() => {
    for (const tipo of ['cardNumber', 'expirationDate', 'securityCode']) {
      disparar(tipo, 'ready', { field: tipo })
      disparar(tipo, 'validityChange', { field: tipo, errorMessages: [] })
    }
    disparar('cardNumber', 'binChange', { field: 'cardNumber', bin: '45516600' })
  })
}

function botaoPagar() {
  return screen.getByRole('button', { name: /Pagar/i })
}

describe('PagamentoCartao — montagem', () => {
  it('cria os três containers com os ids que o SDK monta', async () => {
    montarTela({ onSubmit: vi.fn().mockResolvedValue(undefined) })

    // `mount()` recebe id como STRING e lança se getElementById der null.
    await waitFor(() => {
      expect(document.getElementById('vtx-campo-numero')).not.toBeNull()
      expect(document.getElementById('vtx-campo-validade')).not.toBeNull()
      expect(document.getElementById('vtx-campo-cvv')).not.toBeNull()
    })
    await esperarCampos()
    expect(screen.getByLabelText(/Nome impresso no cartão/i)).toBeTruthy()
  })
})

describe('PagamentoCartao — envio', () => {
  it('manda o payload do contrato com a parcela escolhida', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    montarTela({ onSubmit })
    await esperarCampos()
    preencherCartao()

    await userEvent.type(
      screen.getByLabelText(/Nome impresso no cartão/i),
      'Maria Silva Santos'
    )
    await waitFor(
      () => expect(screen.getByRole('option', { name: /12 parcelas/i })).toBeTruthy(),
      { timeout: 3000 }
    )
    await userEvent.selectOptions(screen.getByLabelText(/Parcelas/i), '12')
    await userEvent.click(botaoPagar())

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    const [formData, tokenSalvar] = onSubmit.mock.calls[0]

    // O bug nº 1 do plano visto de fora: 12x escolhido na tela tem que chegar
    // como 12 no payload. Um `installments` ausente vira "1" no servidor, sem
    // erro e sem log, e o cliente é cobrado à vista.
    expect(formData).toEqual({
      payment_method_id: 'visa',
      token: 'tok_principal',
      installments: 12,
      issuer_id: '26',
      payer: { last_name: 'Silva Santos' },
    })
    expect(tokenSalvar).toBe('tok_salvar')
  })

  it('avisa que os juros são do emissor quando a parcela tem juros', async () => {
    // A partir daqui a tela mostra DOIS números (R$ 197,00 e R$ 240,56). Sem
    // esta linha, a diferença vira chamado de suporte.
    montarTela({ onSubmit: vi.fn().mockResolvedValue(undefined) })
    await esperarCampos()
    preencherCartao()

    await waitFor(
      () => expect(screen.getByRole('option', { name: /12 parcelas/i })).toBeTruthy(),
      { timeout: 3000 }
    )
    // À vista não tem o que avisar.
    expect(screen.queryByText(/juros do emissor/i)).toBeNull()

    await userEvent.selectOptions(screen.getByLabelText(/Parcelas/i), '12')

    expect(
      screen.getByText(/Parcelas com juros do emissor\. A Vertix cobra R\$ 197,00\./i)
    ).toBeTruthy()
  })

  it('duplo clique no mesmo quadro cobra uma vez só', async () => {
    // A chave de idempotência do servidor é o id do PEDIDO, e cada requisição
    // cria um pedido novo: dois envios não se anulam, viram duas cobranças.
    let liberar: (() => void) | null = null
    const onSubmit = vi
      .fn()
      .mockImplementation(() => new Promise<void>((r) => (liberar = () => r())))

    montarTela({ onSubmit })
    await esperarCampos()
    preencherCartao()
    await userEvent.type(
      screen.getByLabelText(/Nome impresso no cartão/i),
      'Maria Silva'
    )

    const botao = botaoPagar()
    // Sem `await` entre os dois: o React ainda não repintou o `disabled`, e é
    // essa fresta que só uma ref lida na hora fecha.
    await act(async () => {
      botao.click()
      botao.click()
    })

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    act(() => liberar?.())
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })
})

describe('PagamentoCartao — o que impede a venda de sair errada', () => {
  it('não tokeniza sem documento e explica o porquê', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    montarTela({ onSubmit, documento: '' })
    await esperarCampos()
    preencherCartao()
    await userEvent.type(
      screen.getByLabelText(/Nome impresso no cartão/i),
      'Maria Silva'
    )

    await userEvent.click(botaoPagar())

    expect(onSubmit).not.toHaveBeenCalled()
    // Sem esta mensagem a pessoa receberia o código 214 do Mercado Pago, em
    // inglês, depois de o SDK recusar a tokenização.
    expect(screen.getByText(/informe um CPF ou CNPJ válido/i)).toBeTruthy()
    expect(createCardToken).not.toHaveBeenCalled()
  })

  it('não envia com CPF inválido, mesmo completo', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    montarTela({ onSubmit, documento: '111.111.111-11' })
    await esperarCampos()
    preencherCartao()
    await userEvent.type(
      screen.getByLabelText(/Nome impresso no cartão/i),
      'Maria Silva'
    )

    await userEvent.click(botaoPagar())

    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('não envia sem nome do titular', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    montarTela({ onSubmit })
    await esperarCampos()
    preencherCartao()

    await userEvent.click(botaoPagar())

    expect(onSubmit).not.toHaveBeenCalled()
    expect(
      screen.getByText(/nome como está impresso no cartão/i)
    ).toBeTruthy()
  })

  it('não envia com campo do cartão inválido', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    montarTela({ onSubmit })
    await esperarCampos()
    act(() => {
      for (const tipo of ['cardNumber', 'expirationDate', 'securityCode']) {
        disparar(tipo, 'ready', { field: tipo })
      }
      // Número reprovado no Luhn; os outros dois nem foram preenchidos.
      disparar('cardNumber', 'validityChange', {
        field: 'cardNumber',
        errorMessages: [{ message: 'invalid', cause: 'invalid_value' }],
      })
    })
    await userEvent.type(
      screen.getByLabelText(/Nome impresso no cartão/i),
      'Maria Silva'
    )

    await userEvent.click(botaoPagar())

    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByText(/Confira os dados destacados acima/i)).toBeTruthy()
  })
})

describe('PagamentoCartao — falha da tokenização', () => {
  it('traduz o código do SDK para o campo certo, em português', async () => {
    // 224 = código de segurança vazio. O upsell trata `221` como CVV por
    // engano (item 10 do plano); aqui a tabela é por igualdade exata.
    createCardToken.mockRejectedValueOnce({ cause: [{ code: '224' }] })

    const onSubmit = vi.fn().mockResolvedValue(undefined)
    montarTela({ onSubmit })
    await esperarCampos()
    preencherCartao()
    await userEvent.type(
      screen.getByLabelText(/Nome impresso no cartão/i),
      'Maria Silva'
    )

    await userEvent.click(botaoPagar())

    // Texto exato: o rótulo do campo também contém "código de segurança".
    // Com o BIN respondido, `settings[0].security_code.length` é 3 e a
    // mensagem diz o número — é a diferença entre orientar e só reclamar.
    await waitFor(() =>
      expect(
        screen.getByText('Digite os 3 dígitos do código de segurança.')
      ).toBeTruthy()
    )
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('a recusa da cobrança não vira mensagem duplicada nossa', async () => {
    // A página já mostra a mensagem da recusa; a rejeição é absorvida para não
    // dizer duas coisas diferentes sobre a mesma tentativa.
    const onSubmit = vi.fn().mockRejectedValue(new Error('pagamento_recusado'))
    montarTela({ onSubmit })
    await esperarCampos()
    preencherCartao()
    await userEvent.type(
      screen.getByLabelText(/Nome impresso no cartão/i),
      'Maria Silva'
    )

    await userEvent.click(botaoPagar())

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    expect(screen.queryByText(/Confira os dados destacados acima/i)).toBeNull()
    // E o botão volta a funcionar: a pessoa precisa poder tentar de novo.
    await waitFor(() => expect(botaoPagar().hasAttribute('disabled')).toBe(false))
  })
})

describe('PagamentoCartao — pedido sem valor', () => {
  it('reproduz o caminho de hoje: formData nulo', async () => {
    // DELIBERADO: este caminho já está quebrado em produção (o servidor
    // responde 400 para formData nulo). Reproduzir sem consertar é o que
    // mantém esta migração sem mudança de comportamento.
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    montarTela({ onSubmit, totalCentavos: 0 })

    await userEvent.click(screen.getByRole('button', { name: /Finalizar pedido/i }))

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(null, null))
    // Sem campos montados: não há cartão para tokenizar num pedido sem valor.
    expect(registrados.size).toBe(0)
  })
})
