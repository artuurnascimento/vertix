import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import CheckoutPage from './CheckoutPage'
import type { CheckoutInfo } from '../../components/checkout/checkoutTypes'
import { pagarCheckout } from '../../components/checkout/checkoutApi'
import { buscarPrefill } from '../../components/checkout/prefillCliente'

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
    resumoAberto: false,
  },
  produto: {
    nome: 'Produto',
    descricao: null,
    imagemUrl: null,
    precoCentavos: 19700,
    ancoraCentavos: null,
  },
  bump: null,
  banner: null,
  prova: null,
  garantia: null,
  cronometroAte: null,
}

const BANNER = {
  desktop: { url: 'https://cdn/desktop.webp', largura: 1600, altura: 400 },
  mobile: { url: 'https://cdn/mobile.webp', largura: 780, altura: 600 },
  alt: 'Plano de correção em 7 dias',
}

const DEPOIMENTO = {
  nome: 'Ana',
  texto: 'Minha loja vendeu mais na primeira semana.',
  loja: 'Ateliê da Ana',
  nota: 5,
  fotoUrl: null,
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
/**
 * Só a busca entra dublada. `tokenValido` continua o de verdade: ele é quem
 * decide se a chamada acontece, e um dublê aqui apagaria justamente o teste
 * de que URL torta não vira requisição.
 */
vi.mock('../../components/checkout/prefillCliente', async (importarReal) => {
  const real = await importarReal<
    typeof import('../../components/checkout/prefillCliente')
  >()
  return { ...real, buscarPrefill: vi.fn() }
})

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
      {/* A busca vai também para o roteador: `useSearchParams` lê dele, não
          de window.location, e antes os dois discordavam no teste. */}
      <MemoryRouter initialEntries={[`/c/oferta${busca}`]}>
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

  describe('?sf=0 — o Brick, o caminho de volta', () => {
    it('mantém o documento OPCIONAL no cartão', async () => {
      renderizar('?sf=0')
      await esperarForm()

      expect(screen.getByText(ROTULO_OPCIONAL)).toBeInTheDocument()
    })

    it('deixa pagar sem documento, como o Brick sempre deixou', async () => {
      renderizar('?sf=0')
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

  describe('formulário novo — o padrão, conferido também por ?sf=1', () => {
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

/**
 * Banner e avaliações: as duas coisas que mudam o TOPO e a DIREITA da página.
 *
 * O que se protege aqui não é estética. Banner sem `width`/`height` faz a
 * página saltar quando a imagem chega — e o que salta é o botão de pagar,
 * debaixo do dedo de quem ia clicar. Avaliações no lugar errado no celular
 * empurram o formulário para fora da primeira tela. Nos dois casos o preço do
 * erro é a venda.
 */
describe('CheckoutPage — banner e avaliações', () => {
  beforeEach(() => {
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

  it('sem banner, não sobra moldura nem espaço no topo', async () => {
    renderizar()
    await esperarForm()

    expect(document.querySelector('picture')).toBeNull()
  })

  it('põe a arte de celular no <img> e a de desktop no <source media>', async () => {
    buscarCheckout.mockResolvedValue({ ...INFO, banner: BANNER })
    renderizar()
    await esperarForm()

    const imagem = screen.getByAltText(BANNER.alt) as HTMLImageElement
    // O <img> é o que carrega quando o <picture> não é entendido — e é do
    // celular que vem a maior parte das compras.
    expect(imagem.getAttribute('src')).toBe(BANNER.mobile.url)
    expect(imagem.getAttribute('width')).toBe('780')
    expect(imagem.getAttribute('height')).toBe('600')
    expect(imagem.getAttribute('loading')).toBe('eager')

    const fonte = document.querySelector('picture source')
    expect(fonte?.getAttribute('media')).toBe('(min-width: 768px)')
    expect(fonte?.getAttribute('srcSet') ?? fonte?.getAttribute('srcset')).toBe(
      BANNER.desktop.url
    )
    expect(fonte?.getAttribute('width')).toBe('1600')
  })

  it('com uma arte só, ela serve os dois tamanhos e não sobra <source>', async () => {
    buscarCheckout.mockResolvedValue({
      ...INFO,
      banner: { ...BANNER, mobile: null },
    })
    renderizar()
    await esperarForm()

    const imagem = screen.getByAltText(BANNER.alt) as HTMLImageElement
    expect(imagem.getAttribute('src')).toBe(BANNER.desktop.url)
    expect(document.querySelector('picture source')).toBeNull()
  })

  it('alt vazio marca a arte como decorativa em vez de sumir com o atributo', async () => {
    buscarCheckout.mockResolvedValue({
      ...INFO,
      banner: { ...BANNER, alt: '' },
    })
    renderizar()
    await esperarForm()

    const imagem = document.querySelector('picture img')
    expect(imagem?.getAttribute('alt')).toBe('')
  })

  it('sem depoimento cadastrado, nenhuma lista de avaliações é desenhada', async () => {
    renderizar()
    await esperarForm()

    expect(
      screen.queryAllByRole('list', { name: 'Depoimentos' })
    ).toHaveLength(0)
  })

  it('no desktop as avaliações ficam na coluna do resumo; no celular, no fluxo', async () => {
    buscarCheckout.mockResolvedValue({
      ...INFO,
      prova: { depoimentos: [DEPOIMENTO], selos: [] },
    })
    renderizar()
    await esperarForm()

    const resumo = screen.getByRole('region', { name: 'Seu pedido' })
    const colunaDireita = resumo.parentElement as HTMLElement
    // A cópia de desktop mora junto do resumo — é o vazio que sobrava ali.
    expect(
      within(colunaDireita).getByRole('list', { name: 'Depoimentos' })
    ).toBeInTheDocument()

    // E existe a cópia do celular, no fim do fluxo. Só uma das duas fica
    // visível por vez (o CSS esconde a outra, e `hidden` também a tira da
    // árvore de acessibilidade); no jsdom, sem CSS, as duas aparecem.
    expect(screen.getAllByRole('list', { name: 'Depoimentos' })).toHaveLength(2)
  })
})

/**
 * O vínculo entre a compra e o Raio-X da loja.
 *
 * O funil do Scan manda a pessoa para /c/<slug>?a=<analysis_id>. Esse valor é
 * o que diz ao worker de qual loja é o Plano de Correção: sem ele o pedido
 * nasce órfão e a entrega não tem o que gerar. A página só o repassava depois
 * desta mudança — antes ele chegava na URL e morria ali.
 */
describe('análise de origem na URL', () => {
  // O dublê é o mesmo módulo entre os testes: sem limpar, o segundo leria a
  // chamada do primeiro e passaria por engano.
  beforeEach(() => vi.mocked(pagarCheckout).mockClear())

  /**
   * Preenche o mínimo que a página exige e dispara o pagamento.
   *
   * O documento entra aqui porque o formulário novo — que hoje é o padrão —
   * exige CPF/CNPJ para tokenizar o cartão. Estes testes correm no caminho
   * que 100% do tráfego usa, não no `?sf=0`.
   */
  async function preencherEPagar() {
    await userEvent.type(screen.getByLabelText('Nome completo'), 'Artur Nascimento')
    await userEvent.type(screen.getByLabelText('E-mail'), 'artur@vertix.studio')
    await userEvent.type(screen.getByLabelText('WhatsApp'), '62999998888')
    await userEvent.type(screen.getByLabelText(ROTULO_OBRIGATORIO), '12345678909')
    await userEvent.click(screen.getByRole('button', { name: 'pagar' }))
    await waitFor(() => expect(pagarCheckout).toHaveBeenCalled())
  }

  it('repassa o ?a= e marca a origem como scan', async () => {
    vi.mocked(pagarCheckout).mockResolvedValue({
      pedidoId: 'ped-1',
      status: 'aprovado',
      totalCentavos: 19700,
      pix: null,
      cartaoSalvo: null,
      erro: null,
      mensagem: null,
    })

    renderizar('?a=11111111-2222-3333-4444-555555555555')
    await esperarForm()
    await preencherEPagar()

    const enviado = vi.mocked(pagarCheckout).mock.calls[0][0]
    expect(enviado.analysisId).toBe('11111111-2222-3333-4444-555555555555')
    expect(enviado.origem).toBe('scan')
  })

  /**
   * O `t` é o token da compra: é por ele que a checkout-pagar descobre QUAL
   * lead está pagando. A análise é compartilhada entre leads (o Scan a
   * reaproveita por domínio), então sem o token o pedido ficaria amarrado a
   * "alguém daquela análise", não a quem pagou.
   */
  it('repassa o ?t= como token da compra, para o pedido apontar para o lead certo', async () => {
    vi.mocked(pagarCheckout).mockResolvedValue({
      pedidoId: 'ped-1',
      status: 'aprovado',
      totalCentavos: 19700,
      pix: null,
      cartaoSalvo: null,
      erro: null,
      mensagem: null,
    })

    renderizar('?a=11111111-2222-3333-4444-555555555555&t=aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee')
    await esperarForm()
    await preencherEPagar()

    const enviado = vi.mocked(pagarCheckout).mock.calls[0][0]
    expect(enviado.tokenCompra).toBe('aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee')
  })

  it('sem ?a= a venda acontece igual, sem análise e sem origem', async () => {
    // Quem compra por link direto não veio do Scan. Recusar o pagamento por
    // falta de um parâmetro de rastreio seria trocar dinheiro por rigor.
    vi.mocked(pagarCheckout).mockResolvedValue({
      pedidoId: 'ped-2',
      status: 'aprovado',
      totalCentavos: 19700,
      pix: null,
      cartaoSalvo: null,
      erro: null,
      mensagem: null,
    })

    renderizar()
    await esperarForm()
    await preencherEPagar()

    const enviado = vi.mocked(pagarCheckout).mock.calls[0][0]
    expect(enviado.analysisId).toBeNull()
    expect(enviado.tokenCompra).toBeNull()
    expect(enviado.origem).toBeNull()
  })
})

/**
 * Preenchimento vindo da análise do Scan.
 *
 * Quem compra o Plano de Correção já entregou nome, e-mail e WhatsApp no
 * portão da análise profunda. O checkout recebe o payment_token em `?t=` e
 * devolve esses três campos prontos — do comprador sobra o CPF e o cartão.
 *
 * O teste que mais importa aqui é o do "não sobrescreve": a resposta é
 * assíncrona, e uma que chegue tarde reescreveria por cima do que a pessoa já
 * corrigiu. Não daria erro nenhum — o campo simplesmente voltaria ao valor
 * antigo, e a cobrança sairia com o dado errado.
 */
describe('CheckoutPage — dados que vêm da análise', () => {
  const TOKEN = '2f1c0a5e-7c3b-4a90-9c1d-6b0f5a8e4d21'
  const DA_ANALISE = {
    nome: 'Ana Souza',
    email: 'ana@loja.com.br',
    whatsapp: '(62) 99999-8888',
  }
  const AVISO = 'Preenchemos com o que você informou na análise.'
  /** CPF com dígitos verificadores válidos — o formulário confere. */
  const CPF = '52998224725'

  beforeEach(() => {
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
    vi.mocked(buscarPrefill).mockResolvedValue(DA_ANALISE)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
    window.history.replaceState({}, '', '/')
  })

  /** Valor atual de um campo do formulário, pelo rótulo. */
  function campo(rotulo: string): HTMLInputElement {
    return screen.getByLabelText(rotulo) as HTMLInputElement
  }

  it('preenche nome, e-mail e WhatsApp com o token da compra', async () => {
    renderizar(`?a=${TOKEN}&t=${TOKEN}`)
    await esperarForm()

    await waitFor(() => expect(campo('Nome completo').value).toBe('Ana Souza'))
    expect(campo('E-mail').value).toBe('ana@loja.com.br')
    expect(campo('WhatsApp').value).toBe('(62) 99999-8888')
    expect(vi.mocked(buscarPrefill)).toHaveBeenCalledWith(TOKEN)
  })

  it('deixa só o CPF em branco — é o que a análise não pediu', async () => {
    renderizar(`?t=${TOKEN}`)
    await esperarForm()

    await waitFor(() => expect(campo('Nome completo').value).toBe('Ana Souza'))
    // Obrigatório, porque o padrão é cartão em Secure Fields — e é o único
    // campo que ainda espera alguém digitar.
    expect(campo(ROTULO_OBRIGATORIO).value).toBe('')
    expect(
      screen.getByText('É o único dado que a análise não pediu.')
    ).toBeInTheDocument()
  })

  it('explica de onde vieram os dados', async () => {
    // Campo cheio sem explicação parece autofill errado do navegador — e num
    // formulário de pagamento isso é motivo para desconfiar e sair.
    renderizar(`?t=${TOKEN}`)
    await esperarForm()

    await waitFor(() => expect(screen.getByText(AVISO)).toBeInTheDocument())
  })

  it('sem token na URL, não busca nada e o aviso não aparece', async () => {
    renderizar()
    await esperarForm()

    expect(vi.mocked(buscarPrefill)).not.toHaveBeenCalled()
    expect(campo('Nome completo').value).toBe('')
    expect(screen.queryByText(AVISO)).not.toBeInTheDocument()
  })

  it('token de forma inválida não vira chamada', async () => {
    renderizar('?t=colado-torto')
    await esperarForm()

    expect(vi.mocked(buscarPrefill)).not.toHaveBeenCalled()
  })

  it('compra sem prefill (token velho) segue com o formulário vazio', async () => {
    vi.mocked(buscarPrefill).mockResolvedValue(null)

    renderizar(`?t=${TOKEN}`)
    await esperarForm()

    await waitFor(() => expect(vi.mocked(buscarPrefill)).toHaveBeenCalled())
    expect(campo('Nome completo').value).toBe('')
    expect(screen.queryByText(AVISO)).not.toBeInTheDocument()
  })

  it('resposta atrasada NÃO apaga o que a pessoa já digitou', async () => {
    let responder: (dados: typeof DA_ANALISE) => void = () => {}
    vi.mocked(buscarPrefill).mockReturnValue(
      new Promise((resolve) => {
        responder = resolve
      })
    )

    renderizar(`?t=${TOKEN}`)
    await esperarForm()

    await userEvent.type(campo('E-mail'), 'outro@meu.com.br')
    responder(DA_ANALISE)

    // O e-mail digitado fica; os campos que estavam vazios, esses sim, entram.
    await waitFor(() => expect(campo('Nome completo').value).toBe('Ana Souza'))
    expect(campo('E-mail').value).toBe('outro@meu.com.br')
  })

  it('paga com os dados preenchidos sem a pessoa tocar neles', async () => {
    vi.mocked(pagarCheckout).mockResolvedValue({
      pedidoId: 'ped-1',
      status: 'aprovado',
      totalCentavos: 19700,
      pix: null,
      cartaoSalvo: null,
      erro: null,
      mensagem: null,
    })

    renderizar(`?a=${TOKEN}&t=${TOKEN}`)
    await esperarForm()
    await waitFor(() => expect(campo('Nome completo').value).toBe('Ana Souza'))

    // Único campo digitado — é exatamente o que sobra para o comprador.
    await userEvent.type(campo(ROTULO_OBRIGATORIO), CPF)
    await userEvent.click(screen.getByRole('button', { name: 'pagar' }))

    await waitFor(() => expect(vi.mocked(pagarCheckout)).toHaveBeenCalled())
    // `clienteParaEnvio` limpa a máscara: o servidor recebe só os dígitos.
    expect(vi.mocked(pagarCheckout).mock.calls[0][0].cliente).toEqual({
      nome: 'Ana Souza',
      email: 'ana@loja.com.br',
      whatsapp: '62999998888',
      documento: CPF,
    })
  })
})
