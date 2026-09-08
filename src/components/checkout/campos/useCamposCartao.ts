/**
 * Ciclo de vida dos três campos seguros do cartão dentro do React.
 *
 * Este hook é a fronteira entre um SDK imperativo, que cria iframes e dispara
 * eventos, e uma árvore React que remonta quando quer. Ele existe para que a
 * tela nunca precise saber que existe um `mp.fields`.
 *
 * O que ele resolve, e por que cada coisa está aqui:
 *
 *  - **StrictMode do React 19.** Em desenvolvimento o efeito roda duas vezes.
 *    O SDK lança `already mounted` na segunda montagem e
 *    `Field '<tipo>' already unmounted` na segunda desmontagem. O guard `vivo`
 *    faz o primeiro ciclo terminar antes de criar qualquer coisa, e
 *    `desmontarTudo` protege cada campo no seu próprio try/catch.
 *
 *  - **A instância do MP é assíncrona.** Ela depende do `<script>` carregar.
 *    Entre pedir e receber, o componente pode ter saído da tela — daí o guard
 *    antes de criar os campos.
 *
 *  - **O `binChange` repete.** O evento dispara na transição válido↔inválido e
 *    reaparece com o mesmo BIN. Sem o guard `bin !== binAtual`, cada repetição
 *    vira duas requisições ao MP.
 *
 *  - **`updatePCIFieldsSettings` não é opcional.** Sem aplicar o `settings` do
 *    BIN, o campo de CVV valida 3 dígitos para sempre e nenhum Amex — 4
 *    dígitos, 15 no número — consegue comprar.
 *
 * O que ele deliberadamente NÃO faz: desenhar, decidir texto de botão, montar
 * o payload da cobrança ou traduzir erro de tokenização. Isso é de quem monta
 * o formulário.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { mensagemDeValidade } from './errosCampos'
import {
  atualizarSettings,
  criarCampos,
  criarToken,
  criarTokenAcessorio,
  desmontarTudo,
  montar,
  primeiroMetodo,
  settingsDoMetodo,
  type CamposCartao,
  type DadosTitular,
} from './mpCampos'
import { obterInstanciaMp } from './mpInstancia'
import type { CampoSeguro, InstanciaMp, SettingsCartao } from './mpTipos'
import type { BuscarInstallments } from './useParcelamento'

// ---------------------------------------------------------------------------
// Vocabulário
// ---------------------------------------------------------------------------

/** Os três campos que vivem dentro de iframe. Titular e documento são nossos. */
export type CampoIframe = 'numero' | 'validade' | 'cvv'

const CAMPOS: readonly CampoIframe[] = ['numero', 'validade', 'cvv']

/**
 * Nome do campo do lado do SDK. Serve de reserva quando o payload do evento
 * chega sem `field` — o mapa de mensagens depende desse nome para saber de que
 * campo está falando.
 */
const NOME_SDK: Record<CampoIframe, string> = {
  numero: 'cardNumber',
  validade: 'expirationDate',
  cvv: 'securityCode',
}

/** Por que a montagem não aconteceu. `null` = está tudo de pé. */
export type FalhaCampos = 'sdk' | 'montagem'

/**
 * Estado de um campo.
 *
 * `valido` só vira `true` quando o SDK manda um `validityChange` com a lista de
 * erros vazia — não existe getter síncrono para perguntar depois.
 *
 * `tocado` existe para a tela não pintar de vermelho quem digitou dois dígitos
 * e ainda está digitando: o `validityChange` chega a cada tecla, mas a pessoa
 * só errou de fato quando saiu do campo. Quem decide mostrar é o formulário.
 */
export interface EstadoCampo {
  /** O iframe subiu e está pronto para receber dígitos (evento `ready`). */
  pronto: boolean
  focado: boolean
  valido: boolean
  /** Mensagem em pt-BR, ou `null` quando não há nada a corrigir. */
  erro: string | null
  /** Já perdeu o foco pelo menos uma vez, ou foi marcado no envio. */
  tocado: boolean
}

/** O par de tokens de uma venda: o que cobra, e o que salva o cartão. */
export interface TokensCartao {
  token: string
  /** `null` quando o cartão não pôde ser salvo. Nunca motivo para não vender. */
  tokenSalvar: string | null
}

export interface EntradaCamposCartao {
  /**
   * `false` desmonta os campos e solta os iframes.
   *
   * Cuidado: voltar para `true` cria campos NOVOS e vazios. Para esconder o
   * formulário sem perder o que a pessoa digitou, esconda por CSS e deixe isto
   * em `true` — preservar o que já foi digitado é justamente o ganho desta
   * migração sobre o Brick.
   */
  ativo?: boolean
}

export interface CamposCartaoHook {
  estados: Record<CampoIframe, EstadoCampo>
  /** Qual campo está com o cursor agora. Alimenta o cartão 3D. */
  campoFocado: CampoIframe | null
  /** Os três iframes subiram. */
  prontos: boolean
  /** Os três passaram no `validityChange`. */
  todosValidos: boolean
  falha: FalhaCampos | null
  /** BIN do cartão digitado — 8 dígitos, medido ao vivo. `null` até o número
   *  ficar válido. */
  bin: string | null
  /**
   * `payment_method_id` da bandeira (`visa`, `master`, `elo`, `amex`, …) vindo
   * de `getPaymentMethods`. É o campo obrigatório do payload da cobrança; se
   * vier `null` por falha de rede, `useParcelamento` traz o mesmo dado de
   * `getInstallments` e serve de reserva.
   */
  bandeira: string | null
  settings: SettingsCartao | null
  /** 3 na maioria das bandeiras, 4 no Amex. `null` enquanto não há BIN. */
  digitosCvv: number | null
  /** Amex imprime o código na frente — o cartão 3D não deve girar. */
  cvvNaFrente: boolean
  /**
   * `mp.getInstallments` amarrado à instância. `null` até o SDK responder.
   * Vai direto para `useParcelamento({ buscar })`.
   */
  buscarParcelas: BuscarInstallments | null
  gerarTokens: (titular: DadosTitular) => Promise<TokensCartao>
  /** Pendura (ou limpa, com `null`) uma mensagem num campo — é por aqui que o
   *  erro de tokenização vira borda vermelha na caixa certa. */
  marcarErro: (campo: CampoIframe, mensagem: string | null) => void
}

// ---------------------------------------------------------------------------
// Estado interno
// ---------------------------------------------------------------------------

/** `focado` fica de fora: ele é derivado de `campoFocado`, que é a única fonte
 *  da verdade sobre foco e não pode divergir de si mesma. */
type EstadoBase = Omit<EstadoCampo, 'focado'>
type EstadosBase = Record<CampoIframe, EstadoBase>

const CAMPO_ZERADO: EstadoBase = {
  pronto: false,
  valido: false,
  erro: null,
  tocado: false,
}

function estadosZerados(): EstadosBase {
  return { numero: CAMPO_ZERADO, validade: CAMPO_ZERADO, cvv: CAMPO_ZERADO }
}

/** Cópia nova com um campo alterado — nada é mutado no lugar. */
function comMudanca(
  anterior: EstadosBase,
  campo: CampoIframe,
  mudanca: Partial<EstadoBase>
): EstadosBase {
  return { ...anterior, [campo]: { ...anterior[campo], ...mudanca } }
}

/**
 * O `error` do SDK é falha interna do iframe, não erro de digitação — mandar
 * "confira o número" aqui seria culpar a pessoa por um problema nosso.
 */
const ERRO_INTERNO_CAMPO =
  'Não foi possível carregar este campo. Atualize a página e tente de novo.'

/**
 * O container só existe depois que o React pinta o formulário, e o SDK pode
 * responder antes disso. 20 × 50ms = 1s de paciência antes de desistir — acima
 * disso é falha de verdade, e insistir calado esconde o problema.
 */
const TENTATIVAS_MONTAGEM = 20
const INTERVALO_MONTAGEM_MS = 50

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useCamposCartao({
  ativo = true,
}: EntradaCamposCartao = {}): CamposCartaoHook {
  const [base, setBase] = useState<EstadosBase>(estadosZerados)
  const [campoFocado, setCampoFocado] = useState<CampoIframe | null>(null)
  const [falha, setFalha] = useState<FalhaCampos | null>(null)
  const [bin, setBin] = useState<string | null>(null)
  const [bandeira, setBandeira] = useState<string | null>(null)
  const [settings, setSettings] = useState<SettingsCartao | null>(null)
  const [sdkPronto, setSdkPronto] = useState(false)

  const mpRef = useRef<InstanciaMp | null>(null)

  /**
   * O comprimento do CVV precisa ser lido DENTRO do handler de
   * `validityChange`, que é uma função registrada uma vez só. Um `useState`
   * ali estaria sempre congelado no valor de quando o campo foi criado — e a
   * mensagem diria "3 dígitos" para um Amex.
   */
  const digitosCvvRef = useRef<number | null>(null)

  const marcarErro = useCallback(
    (campo: CampoIframe, mensagem: string | null) => {
      // `tocado` junto: uma mensagem que a tela decide não mostrar é pior que
      // mensagem nenhuma — a pessoa fica sem saber por que o botão não anda.
      setBase((anterior) =>
        comMudanca(anterior, campo, { erro: mensagem, tocado: true })
      )
    },
    []
  )

  useEffect(() => {
    if (!ativo) return

    // Ciclo novo, campos novos: o que ficou do anterior não vale mais.
    setBase(estadosZerados())
    setCampoFocado(null)
    setFalha(null)
    setBin(null)
    setBandeira(null)
    setSettings(null)
    digitosCvvRef.current = null

    let vivo = true
    let campos: CamposCartao | null = null
    let timerMontagem = 0

    const alterar = (campo: CampoIframe, mudanca: Partial<EstadoBase>) => {
      setBase((anterior) => comMudanca(anterior, campo, mudanca))
    }

    const escutar = (campo: CampoSeguro, chave: CampoIframe) => {
      campo.on('ready', () => alterar(chave, { pronto: true }))

      campo.on('focus', () => setCampoFocado(chave))

      campo.on('blur', () => {
        // Só solta o foco se ainda for este campo: ao pular do número para a
        // validade, o `focus` do destino pode chegar antes do `blur` da origem.
        setCampoFocado((atual) => (atual === chave ? null : atual))
        alterar(chave, { tocado: true })
      })

      campo.on('validityChange', ({ field, errorMessages }) => {
        const problemas = errorMessages ?? []
        const valido = problemas.length === 0
        alterar(chave, {
          valido,
          erro: valido
            ? null
            : mensagemDeValidade(
                problemas[0]?.cause,
                field || NOME_SDK[chave],
                digitosCvvRef.current ?? undefined
              ),
        })
      })

      campo.on('error', () => {
        // `valido` fica como está de propósito: uma falha interna do iframe
        // não desfaz um número que o próprio SDK já declarou válido.
        alterar(chave, { erro: ERRO_INTERNO_CAMPO, tocado: true })
      })
    }

    /**
     * Guard de corrida das consultas de BIN: a resposta de um cartão que a
     * pessoa já apagou não pode reescrever a bandeira do cartão atual.
     */
    let binAtual: string | null = null
    let consulta = 0

    const escutarBin = (mp: InstanciaMp, criados: CamposCartao) => {
      criados.numero.on('binChange', ({ bin: recebido }) => {
        const novo = recebido && recebido.trim() !== '' ? recebido.trim() : null
        // O evento repete com o mesmo BIN. Sem este guard, cada repetição custa
        // duas requisições ao MP e um repopular do select de parcelas.
        if (novo === binAtual) return
        binAtual = novo
        setBin(novo)

        const minha = ++consulta
        if (novo === null) {
          digitosCvvRef.current = null
          setBandeira(null)
          setSettings(null)
          return
        }

        mp.getPaymentMethods({ bin: novo })
          .then((resposta) => {
            if (!vivo || minha !== consulta) return
            const metodo = primeiroMetodo(resposta)
            const settingsDoBin = settingsDoMetodo(metodo)
            digitosCvvRef.current =
              settingsDoBin?.security_code.length ?? null
            setBandeira(metodo?.id ?? null)
            setSettings(settingsDoBin)
            // Sem isto o Amex é recusado pelo próprio campo, antes de o MP ver
            // a compra.
            if (settingsDoBin !== null) {
              atualizarSettings(criados, settingsDoBin)
            }
          })
          .catch(() => {
            // Consulta de BIN é enriquecimento, não pré-requisito: sem ela a
            // bandeira não aparece, mas a tokenização e a venda seguem.
            if (!vivo || minha !== consulta) return
            digitosCvvRef.current = null
            setBandeira(null)
            setSettings(null)
          })
      })
    }

    const tentarMontar = (restantes: number) => {
      if (!vivo || campos === null) return
      if (montar(campos)) return
      if (restantes <= 0) {
        setFalha('montagem')
        return
      }
      timerMontagem = window.setTimeout(
        () => tentarMontar(restantes - 1),
        INTERVALO_MONTAGEM_MS
      )
    }

    obterInstanciaMp()
      .then((mp) => {
        // O componente saiu da tela enquanto o SDK carregava. Criar campos aqui
        // deixaria iframes órfãos que ninguém desmonta — e é exatamente o que
        // acontece no primeiro ciclo do StrictMode.
        if (!vivo) return
        mpRef.current = mp
        setSdkPronto(true)

        const criados = criarCampos(mp)
        campos = criados
        for (const chave of CAMPOS) escutar(criados[chave], chave)
        escutarBin(mp, criados)
        tentarMontar(TENTATIVAS_MONTAGEM)
      })
      .catch(() => {
        if (!vivo) return
        setFalha('sdk')
      })

    return () => {
      vivo = false
      window.clearTimeout(timerMontagem)
      if (campos !== null) desmontarTudo(campos)
      campos = null
    }
  }, [ativo])

  const estados = useMemo<Record<CampoIframe, EstadoCampo>>(
    () => ({
      numero: { ...base.numero, focado: campoFocado === 'numero' },
      validade: { ...base.validade, focado: campoFocado === 'validade' },
      cvv: { ...base.cvv, focado: campoFocado === 'cvv' },
    }),
    [base, campoFocado]
  )

  const buscarParcelas = useMemo<BuscarInstallments | null>(() => {
    if (!sdkPronto) return null
    return (parametros) => {
      const mp = mpRef.current
      if (mp === null) return Promise.reject(new Error('sdk_indisponivel'))
      return mp.getInstallments(parametros)
    }
  }, [sdkPronto])

  /**
   * Os dois tokens, em sequência.
   *
   * O principal primeiro porque a falha dele aborta a venda — gastar tempo com
   * o acessório antes disso seria segurar quem já clicou em pagar. O segundo é
   * o que permite salvar o cartão para o upsell de um clique e devolve `null`
   * em qualquer tropeço, inclusive demora: a venda principal vale mais que o
   * upsell.
   *
   * O erro do principal sobe CRU de propósito. É dele que a camada de
   * mensagens tira os códigos (`205`, `E301`, `224`, `E302`, …) para dizer qual
   * campo corrigir.
   */
  const gerarTokens = useCallback(
    async (titular: DadosTitular): Promise<TokensCartao> => {
      const mp = mpRef.current
      if (mp === null) throw new Error('sdk_indisponivel')
      const token = await criarToken(mp, titular)
      const tokenSalvar = await criarTokenAcessorio(mp, titular)
      return { token, tokenSalvar }
    },
    []
  )

  return {
    estados,
    campoFocado,
    prontos: CAMPOS.every((chave) => base[chave].pronto),
    todosValidos: CAMPOS.every((chave) => base[chave].valido),
    falha,
    bin,
    bandeira,
    settings,
    digitosCvv: settings?.security_code.length ?? null,
    cvvNaFrente: settings?.security_code.card_location === 'front',
    buscarParcelas,
    gerarTokens,
    marcarErro,
  }
}
