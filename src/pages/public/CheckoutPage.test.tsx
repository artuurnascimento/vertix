import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import CheckoutPage from './CheckoutPage'
import type { CheckoutInfo } from '../../components/checkout/checkoutTypes'

/**
 * O único ponto desta migração que muda o PRODUTO: com o formulário novo, o
 * CPF/CNPJ deixa de ser opcional no cartão.
 *
 * É a mudança mais fácil de fazer errado sem ninguém perceber. Se ela vazar
 * para quem está com a flag desligada, o checkout que está vendendo passa a
 * barrar, hoje, gente que hoje compra sem documento — uma venda perdida por
 * um campo que o Brick nem pede. Estes testes existem para que essa
 * regressão não passe silenciosa.
 *
 * `SecaoPagamento` entra dublado: o que interessa aqui é o rótulo do campo e
 * a validação do envio, não montar o SDK do Mercado Pago no jsdom.
 */

const INFO: CheckoutInfo = {
  checkout: {
    slug: 'oferta',
    titulo: 'Oferta',
    subtitulo: null,
    exigeDocumento: false,
    temUpsell: false,
    descontoPixPercentual: null,
  },
  produto: {
    nome: 'Produto',
    descricao: null,
    imagemUrl: null,
    precoCentavos: 19700,
    ancoraCentavos: null,
  },
  bump: null,
  prova: null,
  garantia: null,
  cronometroAte: null,
}

const buscarCheckout = vi.fn()

vi.mock('../../components/checkout/checkoutApi', () => ({
  buscarCheckout: (slug: string) => buscarCheckout(slug),
  pagarCheckout: vi.fn(),
  validarCupom: vi.fn(),
  MP_PUBLIC_KEY: 'TEST',
}))

/**
 * Dublê da seção de pagamento. Expõe os dois fios que a página controla: a
 * troca de método e o envio — cada um num botão, para o teste poder puxá-los.
 */
vi.mock('../../components/checkout/SecaoPagamento', () => ({
  default: (props: {
    erro: string | null
    onMetodo: (m: 'cartao' | 'pix') => void
    onSubmit: (formData: unknown, token: string | null) => Promise<void>
  }) => (
    <div>
      {props.erro && <p role="alert">{props.erro}</p>}
      <button type="button" onClick={() => props.onMetodo('pix')}>
        trocar para pix
      </button>
      <button
        type="button"
        onClick={() => {
          // A página rejeita de propósito quando os dados estão inválidos; é
          // o contrato que mantinha o Brick utilizável.
          void props.onSubmit({ payment_method_id: 'visa' }, null).catch(
            () => undefined
          )
        }}
      >
        pagar
      </button>
    </div>
  ),
}))

function renderizar(busca = '') {
  window.history.replaceState({}, '', `/c/oferta${busca}`)
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/c/oferta']}>
        <Routes>
          <Route path="/c/:slug" element={<CheckoutPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

/** Espera a página sair do "Carregando checkout…". */
async function esperarForm() {
  await waitFor(() =>
    expect(screen.getByText('Seus dados')).toBeInTheDocument()
  )
}

const ROTULO_OPCIONAL = 'CPF ou CNPJ (opcional)'
const ROTULO_OBRIGATORIO = 'CPF ou CNPJ'
const ERRO_DOCUMENTO = 'Informe um CPF ou CNPJ válido.'

describe('CheckoutPage — documento obrigatório no cartão', () => {
  beforeEach(() => {
    // O jsdom não implementa matchMedia, e a página inteira depende dele
    // (ResumoPedido decide o layout, framer-motion lê prefers-reduced-motion).
    // Stub local: mexer no setup compartilhado mudaria as outras 28 suítes.
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
    buscarCheckout.mockResolvedValue(INFO)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
    window.history.replaceState({}, '', '/')
  })

  describe('flag desligada — o checkout de hoje, intacto', () => {
    it('mantém o documento OPCIONAL no cartão', async () => {
      renderizar()
      await esperarForm()

      expect(screen.getByText(ROTULO_OPCIONAL)).toBeInTheDocument()
    })

    it('deixa pagar de cartão sem documento — como hoje', async () => {
      renderizar()
      await esperarForm()

      await userEvent.click(screen.getByRole('button', { name: 'pagar' }))

      await waitFor(() =>
        expect(screen.getByText('Confira seus dados acima antes de pagar.'))
          .toBeInTheDocument()
      )
      // Nome, e-mail e WhatsApp reclamam (estão vazios); o documento, não.
      expect(screen.queryByText(ERRO_DOCUMENTO)).not.toBeInTheDocument()
    })

    it('continua obedecendo o checkout que já exigia documento', async () => {
      buscarCheckout.mockResolvedValue({
        ...INFO,
        checkout: { ...INFO.checkout, exigeDocumento: true },
      })
      renderizar()
      await esperarForm()

      expect(screen.getByText(ROTULO_OBRIGATORIO)).toBeInTheDocument()
    })
  })

  describe('flag ligada por ?sf=1', () => {
    it('rotula o documento como obrigatório no cartão', async () => {
      renderizar('?sf=1')
      await esperarForm()

      expect(screen.getByText(ROTULO_OBRIGATORIO)).toBeInTheDocument()
      expect(screen.queryByText(ROTULO_OPCIONAL)).not.toBeInTheDocument()
    })

    it('barra o envio de cartão sem documento', async () => {
      renderizar('?sf=1')
      await esperarForm()

      await userEvent.click(screen.getByRole('button', { name: 'pagar' }))

      await waitFor(() =>
        expect(screen.getByText(ERRO_DOCUMENTO)).toBeInTheDocument()
      )
    })

    it('volta a ser opcional no Pix, que não tokeniza nada', async () => {
      renderizar('?sf=1')
      await esperarForm()

      await userEvent.click(
        screen.getByRole('button', { name: 'trocar para pix' })
      )

      await waitFor(() =>
        expect(screen.getByText(ROTULO_OPCIONAL)).toBeInTheDocument()
      )
    })
  })
})
