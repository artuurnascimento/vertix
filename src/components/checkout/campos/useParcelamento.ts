import { useCallback, useEffect, useRef, useState } from 'react'
import {
  amountEmReais,
  escolherPadrao,
  mapearOpcoes,
  opcaoPorValor,
  parcelasDeFallback,
} from './parcelamento'
import type { OpcaoParcela, ResultadoParcelas } from './parcelamento'

/**
 * Busca das parcelas: debounce, cancelamento e fallback.
 *
 * A chamada ao SDK entra INJETADA (`buscar`) em vez de o hook importar a
 * instância do Mercado Pago. Dois motivos: o hook fica testável sem rede nem
 * iframe, e o dono da instância continua sendo um módulo só.
 *
 * Os dois gatilhos (item 5.2 do plano) são o BIN e o TOTAL. O ganho sobre o
 * Brick está no segundo: hoje mudar o valor remonta o formulário inteiro e
 * apaga o que a pessoa digitou; aqui só o select é repopulado.
 */

/** Parâmetros exatos de `mp.getInstallments`. `amount` e `bin` são obrigatórios. */
export interface ParametrosInstallments {
  /** REAIS, string, duas casas. */
  amount: string
  bin: string
  locale: string
  /**
   * A doc pt-BR manda; a tabela de `core-methods.md` não lista e o endpoint
   * REST não muda a resposta com ele. Mandamos, mas nada depende disso.
   */
  paymentTypeId: string
}

export type BuscarInstallments = (
  parametros: ParametrosInstallments
) => Promise<unknown>

/**
 * O cupom dispara em cadeia (digitar, validar, total novo) e o BIN reaparece a
 * cada correção do número. Sem esta janela, uma troca de cartão vira meia
 * dúzia de requisições e a última a responder pode não ser a última pedida.
 */
export const DEBOUNCE_PARCELAS_MS = 250

export interface EntradaParcelamento {
  /** `null` enquanto o número não é válido. Nesse estado não há o que perguntar. */
  bin: string | null
  /** Total do PEDIDO em centavos — o que a Vertix cobra, sem juros. */
  totalCentavos: number
  /** `null` enquanto o SDK não está pronto. */
  buscar: BuscarInstallments | null
  /** `false` desliga a busca (Pix, por exemplo). Padrão `true`. */
  ativo?: boolean
}

export interface Parcelamento {
  opcoes: OpcaoParcela[]
  selecionada: number
  opcaoSelecionada: OpcaoParcela | null
  selecionar: (valor: number) => void
  /**
   * Enquanto `true` as opções na tela são as do total ANTERIOR. O select deve
   * ficar desabilitado: valor velho num rótulo de dinheiro é pior que um
   * select cinza por meio segundo.
   */
  carregando: boolean
  fallback: boolean
  issuerId: string | number | null
  paymentMethodId: string | null
}

interface Estado extends ResultadoParcelas {
  selecionada: number
  carregando: boolean
}

function estadoInicial(totalCentavos: number): Estado {
  return {
    ...parcelasDeFallback(totalCentavos),
    selecionada: 1,
    carregando: false,
  }
}

export function useParcelamento({
  bin,
  totalCentavos,
  buscar,
  ativo = true,
}: EntradaParcelamento): Parcelamento {
  const [estado, setEstado] = useState<Estado>(() => estadoInicial(totalCentavos))

  /**
   * A função de busca vive numa ref e NÃO entra nas dependências: um chamador
   * que esqueça de memoizá-la criaria uma requisição por render. O que entra
   * é só o booleano "já dá para buscar".
   */
  const buscarRef = useRef<BuscarInstallments | null>(buscar)
  useEffect(() => {
    buscarRef.current = buscar
  }, [buscar])
  const temBusca = buscar !== null

  const aplicar = useCallback((resultado: ResultadoParcelas) => {
    setEstado((anterior) => ({
      ...resultado,
      carregando: false,
      // Regra da seleção órfã em um lugar só.
      selecionada: escolherPadrao(resultado.opcoes, anterior.selecionada),
    }))
  }, [])

  useEffect(() => {
    const semBin = bin === null || bin.trim() === ''
    // Total zerado ou negativo não é pergunta válida para o MP, e um pedido
    // sem valor não parcela.
    if (!ativo || !temBusca || semBin || totalCentavos <= 0) {
      aplicar(parcelasDeFallback(totalCentavos))
      return
    }

    let cancelado = false
    setEstado((anterior) => ({ ...anterior, carregando: true }))

    const id = window.setTimeout(() => {
      const buscarAgora = buscarRef.current
      if (buscarAgora === null) {
        aplicar(parcelasDeFallback(totalCentavos))
        return
      }

      buscarAgora({
        amount: amountEmReais(totalCentavos),
        bin: bin.trim(),
        locale: 'pt-BR',
        paymentTypeId: 'credit_card',
      })
        .then((resposta) => {
          // Resposta atrasada de um BIN ou total que não é mais o da tela não
          // pode reescrever o select.
          if (cancelado) return
          aplicar(mapearOpcoes(resposta, totalCentavos))
        })
        .catch(() => {
          // Rede caiu, chave errada, MP fora do ar: cai para 1x à vista e a
          // VENDA SEGUE. O select nunca é motivo para não vender.
          if (cancelado) return
          aplicar(parcelasDeFallback(totalCentavos))
        })
    }, DEBOUNCE_PARCELAS_MS)

    return () => {
      cancelado = true
      window.clearTimeout(id)
    }
  }, [ativo, bin, temBusca, totalCentavos, aplicar])

  const selecionar = useCallback((valor: number) => {
    // Passa pela mesma regra da lista: nada entra no estado que não esteja no
    // select, porque daqui sai o `installments` da cobrança.
    setEstado((anterior) => ({
      ...anterior,
      selecionada: escolherPadrao(anterior.opcoes, valor),
    }))
  }, [])

  return {
    opcoes: estado.opcoes,
    selecionada: estado.selecionada,
    opcaoSelecionada: opcaoPorValor(estado.opcoes, estado.selecionada),
    selecionar,
    carregando: estado.carregando,
    fallback: estado.fallback,
    issuerId: estado.issuerId,
    paymentMethodId: estado.paymentMethodId,
  }
}
