import { describe, expect, it } from 'vitest'
import { mensagemDoCorpo } from './pedidosData'

/**
 * Tradução da resposta da edge function `checkout-reembolsar`.
 *
 * O que se protege aqui é a diferença entre "o dinheiro voltou" e "o dinheiro
 * pode ter voltado": a function distingue os dois casos com cuidado, e o
 * painel só é útil se repassar a distinção inteira para quem está olhando.
 */
describe('mensagemDoCorpo', () => {
  it('não vê erro nenhum na resposta de sucesso', () => {
    expect(
      mensagemDoCorpo({
        pedido_id: 'ped-1',
        status: 'reembolsado',
        resultado: 'reembolsado',
      })
    ).toBeNull()
  })

  it('trata "já estava reembolsado" como sucesso, não como falha', () => {
    expect(
      mensagemDoCorpo({ status: 'reembolsado', resultado: 'ja_reembolsado' })
    ).toBeNull()
  })

  it('prefere a mensagem do servidor, que é quem sabe se o dinheiro saiu', () => {
    expect(
      mensagemDoCorpo({
        erro: 'reembolsado_sem_registro',
        mensagem:
          'O reembolso foi feito no Mercado Pago, mas o pedido não pôde ser atualizado. Não repita a operação.',
      })
    ).toMatch(/Não repita a operação/)
  })

  it('traduz o código quando a function não manda mensagem', () => {
    expect(mensagemDoCorpo({ erro: 'acesso_negado' })).toMatch(/permissão/)
    expect(mensagemDoCorpo({ erro: 'pedido_nao_encontrado' })).toMatch(/não existe/)
  })

  it('não engole um código novo do backend', () => {
    // Código que esta versão do painel não conhece ainda vira aviso de
    // dúvida, nunca sucesso silencioso.
    expect(mensagemDoCorpo({ erro: 'chargeback_em_disputa' })).toMatch(
      /confira no Mercado Pago/i
    )
  })

  it('aceita a chave `error` além de `erro`', () => {
    expect(mensagemDoCorpo({ error: 'acesso_negado' })).toMatch(/permissão/)
  })

  it('não inventa erro sem corpo', () => {
    expect(mensagemDoCorpo(null)).toBeNull()
  })
})
