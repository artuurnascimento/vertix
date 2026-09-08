import { useRef, useState, type ReactNode } from 'react'
import { CreditCard, Lock } from 'lucide-react'
import BotaoPagar from './BotaoPagar'
import FormularioCartao from './FormularioCartao'
import { documentoValido } from './clienteForm'
import { campoDoErro, mensagemDeToken } from './campos/errosCampos'
import { useCamposCartao, type CampoIframe } from './campos/useCamposCartao'
import { useParcelamento } from './campos/useParcelamento'
import {
  ERRO_PARCELAMENTO_INDEFINIDO,
  montarFormDataCartao,
  type FormDataCartao,
} from './formDataCartao'

/**
 * Pagamento com cartão sem o Payment Brick: Secure Fields + submit nosso.
 *
 * É este componente que monta o `formData` e chama o `onSubmit` da página —
 * mesmo contrato do Brick, para a `CheckoutPage` não precisar saber qual dos
 * dois está na tela.
 *
 * A sequência do envio, e o motivo de cada passo estar onde está:
 *
 *   1. **Validar antes de tokenizar.** Titular vazio, documento em branco ou
 *      campo inválido viram mensagem nossa aqui. Se deixássemos o SDK reprovar,
 *      a pessoa receberia um código do Mercado Pago (`214`, `221`) em inglês.
 *   2. **Tokenizar.** Dois tokens em sequência: o que cobra e o que salva o
 *      cartão para o upsell de um clique. O segundo é acessório e devolve
 *      `null` em qualquer tropeço — a venda principal vale mais que o upsell.
 *   3. **Montar o payload.** `montarFormDataCartao` aborta se `installments`
 *      não for inteiro ≥ 1. É a trava do bug de dinheiro nº 1: sem ela, quem
 *      escolhe 12x é cobrado à vista, em silêncio.
 *   4. **Cobrar.** A rejeição do `onSubmit` é da página, que já mostra a
 *      mensagem da recusa; duplicá-la aqui diria duas coisas sobre o mesmo
 *      problema.
 *
 * O botão continua clicável com o formulário incompleto, de propósito:
 * desabilitar um botão de pagar sem dizer o que falta é o jeito mais rápido de
 * perder uma venda sem nem saber que ela existiu.
 */

interface Props {
  /** Total já com bump, cupom e desconto de método. Prévia — quem cobra é o servidor. */
  totalCentavos: number
  /**
   * CPF/CNPJ digitado em "Seus dados". OBRIGATÓRIO no cartão: o
   * `createCardToken` exige `identificationType` + `identificationNumber` para
   * tokenizar, e sem eles não existe venda. Mudança de produto declarada no
   * item 1 do plano.
   */
  documento: string
  /** Cobrança em curso na página (depois que o `onSubmit` foi aceito). */
  processando: boolean
  /**
   * Mesmo contrato do Brick: `formData` e o segundo token. Rejeita quando a
   * cobrança falha — a `CheckoutPage` é quem mostra a mensagem da recusa.
   */
  onSubmit: (formData: unknown, cardTokenSalvar: string | null) => Promise<void>
  /** Escolha do método, posicionada abaixo do cartão 3D pelo formulário. */
  seletor?: ReactNode
}

const CAMPOS: readonly CampoIframe[] = ['numero', 'validade', 'cvv']

/** Mensagem quando o campo nunca foi preenchido e o SDK não tem o que reclamar. */
const FALTANDO: Record<CampoIframe, string> = {
  numero: 'Digite o número do cartão.',
  validade: 'Preencha a validade do cartão.',
  cvv: 'Digite o código de segurança.',
}

const ERRO_TITULAR = 'Digite o nome como está impresso no cartão.'

const ERRO_DOCUMENTO =
  'Para pagar com cartão, informe um CPF ou CNPJ válido em "Seus dados" — o Mercado Pago exige a identificação de quem paga.'

const ERRO_CONFIRA_ACIMA = 'Confira os dados destacados acima e tente de novo.'

const ERRO_PARCELAS =
  'Não conseguimos confirmar o parcelamento. Escolha novamente em quantas vezes você quer pagar.'

const ERRO_SDK =
  'O formulário de pagamento não respondeu. Recarregue a página e tente de novo.'

/** Id do campo de documento em `DadosCliente`, para levar a pessoa até ele. */
const ID_DOCUMENTO = 'cliente-documento'

export default function PagamentoCartao({
  totalCentavos,
  documento,
  processando,
  onSubmit,
  seletor,
}: Props) {
  const gratuito = totalCentavos <= 0

  const campos = useCamposCartao({ ativo: !gratuito })
  const parcelamento = useParcelamento({
    bin: campos.bin,
    totalCentavos,
    buscar: campos.buscarParcelas,
    ativo: !gratuito,
  })

  const [titular, setTitular] = useState('')
  const [erroTitular, setErroTitular] = useState<string | null>(null)
  const [erroDocumento, setErroDocumento] = useState<string | null>(null)
  const [erroEnvio, setErroEnvio] = useState<string | null>(null)
  /**
   * Trava local, separada do `processando` da página: entre o clique e o
   * `onSubmit` existe a tokenização, que leva quase um segundo, e nesse
   * intervalo a página ainda acha que nada começou. Este estado é o que pinta
   * o botão como ocupado.
   */
  const [enviando, setEnviando] = useState(false)

  /**
   * A trava DE VERDADE contra a cobrança dobrada.
   *
   * Estado não serve aqui: dois cliques no mesmo quadro rodam no MESMO render,
   * onde `enviando` ainda é `false` e o `disabled` do botão ainda não foi
   * pintado. Os dois handlers passariam, e o resultado seriam dois tokens,
   * dois pedidos e duas cobranças — a chave de idempotência é o id do pedido, e
   * pedidos diferentes não se anulam. Medido: sem esta ref, dois `click()` no
   * mesmo tick produzem dois `onSubmit`.
   */
  const enviandoRef = useRef(false)

  const ocupado = enviando || processando

  const alterarTitular = (valor: string) => {
    setTitular(valor)
    // Erro some quando a pessoa mexe no campo: corrigir e continuar vendo
    // vermelho é o atrito que faz abandonar carrinho.
    if (erroTitular !== null) setErroTitular(null)
  }

  /** Traduz a falha do `createCardToken` e pendura no campo certo. */
  const aplicarErroDeToken = (erro: unknown) => {
    if (erro instanceof Error && erro.message === 'sdk_indisponivel') {
      setErroEnvio(ERRO_SDK)
      return
    }

    const mensagem = mensagemDeToken(erro, campos.digitosCvv ?? undefined)
    const campo = campoDoErro(erro)

    if (campo === 'numero' || campo === 'validade' || campo === 'cvv') {
      campos.marcarErro(campo, mensagem)
      setErroEnvio(ERRO_CONFIRA_ACIMA)
      return
    }
    if (campo === 'titular') {
      setErroTitular(mensagem)
      setErroEnvio(ERRO_CONFIRA_ACIMA)
      return
    }
    if (campo === 'documento') {
      setErroDocumento(mensagem)
      setErroEnvio(ERRO_CONFIRA_ACIMA)
      focarDocumento()
      return
    }
    // Código que não conhecemos: a mensagem genérica em português vai para
    // baixo do botão, que é onde a pessoa está olhando.
    setErroEnvio(mensagem)
  }

  /**
   * O documento vive em outra seção da página. Levar a pessoa até ele é a
   * diferença entre "não deu certo" e "faltou isto, está aqui".
   */
  const focarDocumento = () => {
    const campo = document.getElementById(ID_DOCUMENTO)
    campo?.scrollIntoView({ block: 'center' })
    campo?.focus({ preventScroll: true })
  }

  /**
   * Bloqueia o envio e mostra tudo o que falta de uma vez. Marcar um problema
   * por tentativa faria a pessoa clicar em pagar quatro vezes para descobrir
   * quatro coisas.
   */
  const validar = (): boolean => {
    let ok = true

    if (titular.trim().length < 2) {
      setErroTitular(ERRO_TITULAR)
      ok = false
    }

    if (!documentoValido(documento)) {
      setErroDocumento(ERRO_DOCUMENTO)
      ok = false
    } else {
      setErroDocumento(null)
    }

    for (const campo of CAMPOS) {
      const estado = campos.estados[campo]
      if (estado.valido) continue
      // A mensagem específica do `validityChange` (quando existe) vale mais
      // que a nossa genérica; `marcarErro` só serve para forçá-la à tela.
      campos.marcarErro(campo, estado.erro ?? FALTANDO[campo])
      ok = false
    }

    return ok
  }

  const enviar = async () => {
    // Lido e escrito na hora, antes de qualquer `await`: é o único ponto do
    // fluxo em que um segundo clique do mesmo quadro ainda pode ser barrado.
    if (enviandoRef.current || processando) return
    enviandoRef.current = true
    setEnviando(true)

    try {
      setErroEnvio(null)

      if (!validar()) {
        setErroEnvio(ERRO_CONFIRA_ACIMA)
        // Os campos do cartão vivem em iframe e não aceitam foco programático
        // (item 3.8 do plano); o documento, que é nosso, aceita.
        if (!documentoValido(documento)) focarDocumento()
        return
      }

      let tokens: { token: string; tokenSalvar: string | null }
      try {
        tokens = await campos.gerarTokens({
          nomeTitular: titular,
          documento,
        })
      } catch (erro) {
        aplicarErroDeToken(erro)
        return
      }

      let formData: FormDataCartao
      try {
        formData = montarFormDataCartao({
          // A bandeira vem de `getPaymentMethods`; se aquela consulta falhou,
          // `getInstallments` traz o mesmo `payment_method_id` de brinde. Sem
          // nenhum dos dois o servidor devolveria 400, então abortamos aqui.
          paymentMethodId: campos.bandeira ?? parcelamento.paymentMethodId,
          token: tokens.token,
          installments: parcelamento.selecionada,
          issuerId: parcelamento.issuerId,
          nomeCompleto: titular,
        })
      } catch (erro) {
        setErroEnvio(
          erro instanceof Error && erro.message === ERRO_PARCELAMENTO_INDEFINIDO
            ? ERRO_PARCELAS
            : ERRO_SDK
        )
        return
      }

      /*
       * A rejeição aqui é o contrato da página: ela já trocou o estado e já
       * mostrou a mensagem da recusa logo abaixo. Absorver evita um unhandled
       * rejection no console do cliente e evita duas mensagens diferentes
       * sobre a mesma tentativa.
       */
      await onSubmit(formData, tokens.tokenSalvar).catch(() => undefined)
    } finally {
      enviandoRef.current = false
      setEnviando(false)
    }
  }

  /** Mesma trava do cartão, para o pedido sem valor não render dois pedidos. */
  const enviarGratuito = async () => {
    if (enviandoRef.current || processando) return
    enviandoRef.current = true
    setEnviando(true)
    try {
      await onSubmit(null, null).catch(() => undefined)
    } finally {
      enviandoRef.current = false
      setEnviando(false)
    }
  }

  if (gratuito) {
    /*
     * Cupom cobriu o pedido inteiro. Reproduz o caminho de hoje
     * (`PagamentoBrick.tsx:198-219`): `formData` nulo.
     *
     * DELIBERADO, e quebrado hoje: o servidor responde 400
     * `dados_pagamento_incompletos` para `formData` nulo
     * (`checkout-pagar/index.ts:311-314`) e `VALOR_MINIMO_CENTAVOS = 50`
     * barraria de novo. Não consertamos aqui — consertar mudaria o produto no
     * meio de uma migração que não pode mudar nada. Tarefa separada.
     *
     * Este ramo existe nos dois componentes (aqui e em `PagamentoPix`) porque
     * hoje ele vive dentro do Brick, que atende os dois métodos. O lugar certo
     * é `SecaoPagamento`, acima da escolha do método — é decisão de quem fizer
     * a integração.
     */
    return (
      <div className="mt-5 text-center">
        <p className="text-sm text-ink">
          Seu cupom cobre o pedido inteiro — nada a pagar.
        </p>
        <div className="mt-4">
          <BotaoPagar
            totalCentavos={null}
            rotulo="Finalizar pedido"
            processando={ocupado}
            onClick={() => void enviarGratuito()}
          />
        </div>
      </div>
    )
  }

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        void enviar()
      }}
    >
      <FormularioCartao
        estados={campos.estados}
        campoFocado={campos.campoFocado}
        prontos={campos.prontos}
        falha={campos.falha}
        bin={campos.bin}
        bandeira={campos.bandeira}
        digitosCvv={campos.digitosCvv}
        cvvNaFrente={campos.cvvNaFrente}
        titular={titular}
        onTitular={alterarTitular}
        erroTitular={erroTitular}
        erroDocumento={erroDocumento}
        parcelamento={parcelamento}
        totalCentavos={totalCentavos}
        desabilitado={ocupado}
        seletor={seletor}
      />

      <div className="mt-5">
        <BotaoPagar
          type="submit"
          totalCentavos={totalCentavos}
          processando={ocupado}
          // Sem os campos de pé não há o que tokenizar: aqui o botão desabilita
          // porque a mensagem de falha já está na tela, dizendo o motivo.
          desabilitado={campos.falha !== null}
          icone={<CreditCard aria-hidden className="h-5 w-5" />}
        />
      </div>

      {erroEnvio && (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-red-400/25 bg-red-500/10 px-3 py-2 text-center text-sm text-red-300"
        >
          {erroEnvio}
        </p>
      )}

      <p className="mt-4 flex items-center justify-center gap-1.5 text-[11px] font-light text-muted">
        <Lock aria-hidden className="h-3 w-3" />
        Não guardamos os dados do seu cartão.
      </p>
    </form>
  )
}
