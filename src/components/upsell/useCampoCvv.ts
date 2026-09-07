import { useCallback, useEffect, useRef, useState } from 'react'
import { gerarCardToken, montarCampoCvv } from './cardToken'
import type { CampoMontado, ResultadoToken } from './cardToken'

/**
 * Ciclo de vida do campo seguro de CVV do Mercado Pago.
 *
 * O campo é um iframe do MP montado dentro de um container nosso, então ele
 * precisa ser criado DEPOIS que o container existe no DOM e destruído quando
 * ele sai — senão sobra um iframe órfão apontando para um nó que já não está
 * na página. Este hook é quem garante esse par.
 *
 * `chave` remonta o campo quando a oferta troca (upsell → downsell): o card é
 * recriado com um `key` novo, o container antigo some, e sem esta dependência
 * o campo ficaria pendurado no elemento que deixou de existir.
 */
export function useCampoCvv(ativo: boolean, chave: string) {
  const [pronto, setPronto] = useState(false)
  const [erroSdk, setErroSdk] = useState(false)
  const montadoRef = useRef<CampoMontado | null>(null)

  useEffect(() => {
    if (!ativo) return

    let cancelado = false
    setPronto(false)
    setErroSdk(false)

    montarCampoCvv(() => {
      if (!cancelado) setPronto(true)
    })
      .then((montado) => {
        // Desmontou antes de o SDK responder: descarta em vez de guardar um
        // campo preso a um container que já saiu da tela.
        if (cancelado) montado.desmontar()
        else montadoRef.current = montado
      })
      .catch(() => {
        if (!cancelado) setErroSdk(true)
      })

    return () => {
      cancelado = true
      montadoRef.current?.desmontar()
      montadoRef.current = null
    }
  }, [ativo, chave])

  /**
   * Troca o CVV digitado (que só o iframe do MP leu) por um token de uso
   * único. Sem campo montado não há o que tokenizar — devolvemos o mesmo
   * código de falha do SDK indisponível.
   */
  const gerarToken = useCallback(
    async (cardId: string): Promise<ResultadoToken> => {
      const montado = montadoRef.current
      if (!montado) return { ok: false, erro: 'sdk_indisponivel' }
      return gerarCardToken(montado, cardId)
    },
    []
  )

  return { pronto, erroSdk, gerarToken }
}
