import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SecaoPagamento from './SecaoPagamento'
import type { MetodoPagamento } from './MetodoPagamento'

/**
 * O que estes testes protegem é a trava nº 1, agora do outro lado da migração:
 * **sem parâmetro nenhum, esta seção tem de renderizar o formulário novo.**
 *
 * O Secure Fields passou nos testes com cartão de verdade e virou o checkout.
 * Um `?` invertido aqui, ou uma flag lida com o valor errado, trocaria o
 * formulário de pagamento de 100% do tráfego sem ninguém pedir — e o sintoma
 * chegaria como queda de conversão, não como erro no console. O Brick continua
 * coberto porque continua alcançável: `?sf=0` é o link que o suporte manda.
 *
 * Os três formulários são dublês: quem testa o que cada um faz são
 * `PagamentoPix.test.tsx` e `PagamentoCartao.test.tsx`. Aqui só interessa
 * QUAL entra na tela, e com quais dados.
 */

vi.mock('./PagamentoBrick', () => ({
  default: (props: { metodo: string; emailInicial: string }) => (
    <div
      data-testid="brick"
      data-metodo={props.metodo}
      data-email={props.emailInicial}
    />
  ),
}))

/*
 * Os dublês RENDERIZAM o `seletor` que recebem, como os componentes reais
 * fazem. Sem isso a lista de métodos desapareceria do DOM assim que o
 * formulário monta, e nenhum teste conseguiria verificar o que acontece com
 * ela depois da escolha — que é metade do comportamento desta seção.
 */
vi.mock('./PagamentoCartao', () => ({
  default: (props: {
    documento: string
    totalCentavos: number
    seletor?: React.ReactNode
  }) => (
    <div
      data-testid="cartao"
      data-documento={props.documento}
      data-total={String(props.totalCentavos)}
    >
      {props.seletor}
    </div>
  ),
}))

vi.mock('./PagamentoPix', () => ({
  default: (props: { totalCentavos: number; seletor?: React.ReactNode }) => (
    <div data-testid="pix" data-total={String(props.totalCentavos)}>
      {props.seletor}
    </div>
  ),
}))

const TOTAL = 19700

function renderizar(
  opcoes: { busca?: string; metodo?: MetodoPagamento; erro?: string } = {}
) {
  window.history.replaceState({}, '', `/c/slug${opcoes.busca ?? ''}`)
  return render(
    <SecaoPagamento
      id="pagamento"
      totalCentavos={TOTAL}
      metodo={opcoes.metodo ?? 'cartao'}
      onMetodo={vi.fn()}
      descontoPixPercentual={null}
      emailInicial="comprador@exemplo.com"
      documento="123.456.789-09"
      processando={false}
      erro={opcoes.erro ?? null}
      onSubmit={vi.fn()}
      onErroCarregamento={vi.fn()}
    />
  )
}

describe('SecaoPagamento', () => {
  afterEach(() => {
    window.history.replaceState({}, '', '/')
  })

  describe('sem parâmetro — o checkout que está vendendo', () => {
    it('NÃO monta o Brick: o padrão agora é o formulário novo', () => {
      // Se este teste voltar a passar com o Brick na tela, a promoção foi
      // desfeita sem ninguém pedir — que é exatamente o acidente que a versão
      // anterior deste arquivo existia para impedir, na direção contrária.
      renderizar()

      expect(screen.queryByTestId('brick')).not.toBeInTheDocument()
    })

    it('o link do Scan (?a=<id>, sem sf) cai no formulário novo', async () => {
      // `scan-comprar` monta /c/plano-correcao?a=<id>. Nenhum `sf` na URL.
      renderizar({ busca: '?a=b0f1c2d3-0000-4000-8000-000000000000' })
      await userEvent.click(
        screen.getByRole('radio', { name: /cartão de crédito/i })
      )

      expect(screen.getByTestId('cartao')).toBeInTheDocument()
      expect(screen.queryByTestId('brick')).not.toBeInTheDocument()
    })
  })

  describe('?sf=0 — o Brick como caminho de volta', () => {
    it('renderiza o Brick no cartão, e nenhum formulário novo', () => {
      renderizar({ busca: '?sf=0' })

      expect(screen.getByTestId('brick')).toBeInTheDocument()
      expect(screen.queryByTestId('cartao')).not.toBeInTheDocument()
      expect(screen.queryByTestId('pix')).not.toBeInTheDocument()
    })

    it('renderiza o Brick TAMBÉM no Pix — quem desenha os dois é ele', () => {
      renderizar({ busca: '?sf=0', metodo: 'pix' })

      expect(screen.getByTestId('brick')).toHaveAttribute('data-metodo', 'pix')
      expect(screen.queryByTestId('pix')).not.toBeInTheDocument()
    })

    it('mantém o wrapper .vtx-checkout, que é quem escopa o botão do Brick', () => {
      const { container } = renderizar({ busca: '?sf=0' })

      const wrapper = container.querySelector('.vtx-checkout')
      expect(wrapper).not.toBeNull()
      expect(wrapper).toContainElement(screen.getByTestId('brick'))
    })

    it('continua pré-preenchendo o e-mail do pagador', () => {
      renderizar({ busca: '?sf=0' })

      expect(screen.getByTestId('brick')).toHaveAttribute(
        'data-email',
        'comprador@exemplo.com'
      )
    })
  })

  describe('formulário novo', () => {
    /**
     * Escolhe um método como a pessoa escolheria. Necessário em quase todo
     * teste daqui porque a tela abre SEM seleção — o formulário só existe
     * depois da decisão.
     */
    const escolher = async (rotulo: RegExp) => {
      await userEvent.click(screen.getByRole('radio', { name: rotulo }))
    }

    it('abre sem método marcado e sem formulário nenhum', () => {
      renderizar({ busca: '?sf=1' })

      // Opção pré-marcada faz a pessoa passar direto sem ler a lista, e passar
      // direto pelo Pix é passar direto pelo desconto.
      for (const radio of screen.getAllByRole('radio')) {
        expect(radio).not.toBeChecked()
      }
      expect(screen.queryByTestId('cartao')).not.toBeInTheDocument()
      expect(screen.queryByTestId('pix')).not.toBeInTheDocument()
    })

    it('troca o Brick pelo formulário de cartão depois da escolha', async () => {
      const { container } = renderizar({ busca: '?sf=1' })
      await escolher(/cartão de crédito/i)

      expect(screen.getByTestId('cartao')).toBeInTheDocument()
      expect(screen.queryByTestId('brick')).not.toBeInTheDocument()
      // Sem Brick não há botão do SDK para escopar — o wrapper sai junto.
      expect(container.querySelector('.vtx-checkout')).toBeNull()
    })

    it('entrega o documento ao cartão: sem ele não há token nem venda', async () => {
      renderizar({ busca: '?sf=1' })
      await escolher(/cartão de crédito/i)

      expect(screen.getByTestId('cartao')).toHaveAttribute(
        'data-documento',
        '123.456.789-09'
      )
    })

    it('no Pix monta o painel do Pix, não o do cartão', async () => {
      renderizar({ busca: '?sf=1', metodo: 'pix' })
      await escolher(/pix/i)

      expect(screen.getByTestId('pix')).toHaveAttribute(
        'data-total',
        String(TOTAL)
      )
      expect(screen.queryByTestId('cartao')).not.toBeInTheDocument()
      expect(screen.queryByTestId('brick')).not.toBeInTheDocument()
    })

    it('escolhido um método, o outro sai da lista', async () => {
      renderizar({ busca: '?sf=1' })
      await escolher(/cartão de crédito/i)

      expect(
        screen.getByRole('radio', { name: /cartão de crédito/i })
      ).toBeInTheDocument()
      expect(
        screen.queryByRole('radio', { name: /pix/i })
      ).not.toBeInTheDocument()
    })

    it('"escolher outra forma" devolve as duas opções e o formulário some', async () => {
      renderizar({ busca: '?sf=1' })
      await escolher(/cartão de crédito/i)

      await userEvent.click(
        screen.getByRole('button', { name: /escolher outra forma/i })
      )

      expect(screen.getAllByRole('radio')).toHaveLength(2)
      expect(screen.queryByTestId('cartao')).not.toBeInTheDocument()
    })
  })

  it.each(['?sf=0', undefined])(
    'mostra o erro da última tentativa nos dois caminhos (%j)',
    (busca) => {
      renderizar({ busca, erro: 'Cartão recusado pelo emissor.' })

      expect(screen.getByRole('alert')).toHaveTextContent(
        'Cartão recusado pelo emissor.'
      )
    }
  )
})
