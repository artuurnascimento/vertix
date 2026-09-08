import { useId, useState, type ReactNode } from 'react'
import { AlertCircle, Check, ChevronDown, IdCard } from 'lucide-react'
import CartaoTresD, {
  type CampoCartao as CampoDoCartao,
  type EstadoCampo as EstadoVisual,
} from './CartaoTresD'
import {
  ID_CAMPO_CVV,
  ID_CAMPO_NUMERO,
  ID_CAMPO_VALIDADE,
} from './campos/mpCampos'
import { avisoDeJuros } from './campos/parcelamento'
import type { CampoIframe, EstadoCampo, FalhaCampos } from './campos/useCamposCartao'
import type { Parcelamento } from './campos/useParcelamento'

/**
 * A tela do cartão: cartão 3D, os três containers dos campos seguros, o input
 * de titular (que é NOSSO), o select de parcelas e as mensagens.
 *
 * Componente de apresentação. Não fala com o SDK, não monta payload, não
 * decide quando mostrar erro — recebe tudo pronto de `PagamentoCartao`. Essa
 * fronteira existe porque a parte difícil desta migração é o dinheiro, e
 * dinheiro não pode estar misturado com layout.
 *
 * Duas coisas que parecem detalhe e não são:
 *
 *  - **Os containers dos campos são divs vazias com id fixo.** O SDK monta o
 *    iframe dentro delas pelo `document.getElementById`, então elas precisam
 *    existir no DOM ANTES de o SDK responder e não podem ser desmontadas
 *    enquanto o formulário estiver na tela. É por isso que a falha de
 *    carregamento troca o bloco inteiro em vez de esconder os campos: meia
 *    tela com caixas vazias é pior que uma mensagem clara.
 *
 *  - **Borda, fundo, raio e anel de foco são nossos.** A lista de estilos que
 *    o SDK aceita dentro do iframe não tem `background`, `border` nem
 *    pseudo-classe nenhuma. Todo o estado visual de foco vive aqui, reagindo
 *    aos eventos `focus`/`blur` — é literalmente para isso que esses eventos
 *    existem.
 *
 * Só pode existir UM destes por página: os ids dos containers são fixos e
 * globais, porque `mount()` recebe id como string.
 */

interface Props {
  /** Estado por campo, vindo de `useCamposCartao`. */
  estados: Record<CampoIframe, EstadoCampo>
  /** Campo com o cursor agora — alimenta o brilho e o giro do cartão 3D. */
  campoFocado: CampoIframe | null
  /** Os três iframes subiram. Enquanto `false`, cada caixa mostra esqueleto. */
  prontos: boolean
  /** `null` = tudo de pé. Qualquer outro valor troca o formulário por um aviso. */
  falha: FalhaCampos | null
  bin: string | null
  bandeira: string | null
  /** 3 na maioria, 4 no Amex. `null` enquanto não há BIN. */
  digitosCvv: number | null
  /** Amex imprime o código na frente: o cartão não deve girar. */
  cvvNaFrente: boolean

  titular: string
  onTitular: (valor: string) => void
  /** Mensagem do campo de titular, ou `null`. */
  erroTitular: string | null

  /**
   * Mensagem sobre o CPF/CNPJ de "Seus dados". O documento é obrigatório no
   * cartão (o Mercado Pago exige para tokenizar) mas mora em outra seção da
   * página — sem este aviso a pessoa clica em pagar e não descobre o porquê.
   */
  erroDocumento: string | null

  parcelamento: Parcelamento
  /** Total do PEDIDO, sem juros. Só para a linha de aviso. */
  totalCentavos: number
  /** Cobrança em curso: congela o que dá para congelar. */
  desabilitado: boolean
  /**
   * A escolha do método, renderizada logo abaixo do cartão 3D. Chega pronta
   * de fora porque o método é estado da seção de pagamento — este formulário
   * só existe quando cartão já é o escolhido.
   */
  seletor?: ReactNode
}

const MENSAGEM_FALHA: Record<FalhaCampos, string> = {
  sdk: 'Não foi possível carregar o formulário de pagamento. Recarregue a página e tente de novo.',
  montagem:
    'O formulário de cartão não abriu. Recarregue a página — se persistir, pague com Pix.',
}

/** Estado visual que o cartão 3D entende, a partir do estado do campo. */
function visual(estado: EstadoCampo, mostrarErro: boolean): EstadoVisual {
  if (mostrarErro) return 'erro'
  return estado.valido ? 'valido' : 'neutro'
}

/**
 * Erro só aparece depois que a pessoa saiu do campo (ou depois de tentar
 * pagar, que é quando `marcarErro` liga o `tocado`). O `validityChange` chega
 * a cada tecla: pintar de vermelho quem digitou dois dígitos é acusar de erro
 * quem ainda está digitando.
 */
function deveMostrarErro(estado: EstadoCampo): boolean {
  return estado.tocado && !estado.focado && estado.erro !== null
}

export default function FormularioCartao({
  estados,
  campoFocado,
  prontos,
  falha,
  bin,
  bandeira,
  digitosCvv,
  cvvNaFrente,
  titular,
  onTitular,
  erroTitular,
  erroDocumento,
  parcelamento,
  totalCentavos,
  desabilitado,
  seletor,
}: Props) {
  const idTitular = useId()
  const idParcelas = useId()
  const [titularFocado, setTitularFocado] = useState(false)

  const focoNoCartao: CampoDoCartao | null = titularFocado
    ? 'titular'
    : campoFocado

  const estadosDoCartao: Partial<Record<CampoDoCartao, EstadoVisual>> = {
    numero: visual(estados.numero, deveMostrarErro(estados.numero)),
    validade: visual(estados.validade, deveMostrarErro(estados.validade)),
    cvv: visual(estados.cvv, deveMostrarErro(estados.cvv)),
    titular:
      erroTitular !== null
        ? 'erro'
        : titular.trim().length >= 2
          ? 'valido'
          : 'neutro',
  }

  const opcaoSelecionada = parcelamento.opcaoSelecionada

  if (falha !== null) {
    return (
      <div className="mt-5">
        <p
          role="alert"
          className="flex items-start gap-2.5 rounded-xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm text-red-200"
        >
          <AlertCircle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
          {MENSAGEM_FALHA[falha]}
        </p>
      </div>
    )
  }

  return (
    <div className="mt-5">
      <div className="flex justify-center">
        <CartaoTresD
          titular={titular}
          bin={bin}
          bandeira={bandeira}
          focado={focoNoCartao}
          estados={estadosDoCartao}
          cvvNoVerso={!cvvNaFrente}
          digitosCvv={digitosCvv === 4 ? 4 : 3}
        />
      </div>

      {/* O seletor entra AQUI, entre o cartão e os campos, e não acima de
          tudo: o cartão é o que identifica a seção de relance, e a linha do
          método escolhido lê melhor como legenda dele do que como cabeçalho
          solto. Vem de fora porque quem manda no método é a seção de
          pagamento, não este formulário. */}
      {seletor}

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {/* O titular é o único campo do cartão que é input nosso de verdade —
            e o único que o cartão 3D consegue escrever ao vivo. */}
        <div className="sm:col-span-2">
          <label htmlFor={idTitular} className="text-xs font-light text-muted">
            Nome impresso no cartão
          </label>
          <input
            id={idTitular}
            name="cardholderName"
            type="text"
            value={titular}
            // O navegador preenche pelo mesmo token que usaria no Brick.
            autoComplete="cc-name"
            autoCapitalize="characters"
            spellCheck={false}
            placeholder="COMO ESTÁ NO CARTÃO"
            disabled={desabilitado}
            aria-invalid={erroTitular !== null}
            aria-describedby={erroTitular ? `${idTitular}-erro` : undefined}
            onChange={(e) => onTitular(e.target.value)}
            onFocus={() => setTitularFocado(true)}
            onBlur={() => setTitularFocado(false)}
            className={[
              'mt-1.5 w-full rounded-xl border bg-surface-2 px-4 py-3 text-sm uppercase tracking-wide text-ink transition-colors placeholder:normal-case placeholder:tracking-normal placeholder:text-muted/60 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-60',
              erroTitular
                ? 'border-red-400/50'
                : 'border-white/10 focus:border-accent/60',
            ].join(' ')}
          />
          {erroTitular && (
            <p
              id={`${idTitular}-erro`}
              role="alert"
              className="mt-1.5 text-xs text-red-300"
            >
              {erroTitular}
            </p>
          )}
        </div>

        <CaixaCampo
          className="sm:col-span-2"
          rotulo="Número do cartão"
          containerId={ID_CAMPO_NUMERO}
          estado={estados.numero}
          pronto={prontos}
        />

        <CaixaCampo
          rotulo="Validade"
          containerId={ID_CAMPO_VALIDADE}
          estado={estados.validade}
          pronto={prontos}
        />

        <CaixaCampo
          rotulo="Código de segurança"
          containerId={ID_CAMPO_CVV}
          estado={estados.cvv}
          pronto={prontos}
          // Só aparece quando o BIN respondeu: inventar "3 dígitos" antes de
          // saber a bandeira manda o dono de um Amex procurar um dígito a menos.
          dica={digitosCvv !== null ? `${digitosCvv} dígitos` : undefined}
        />

        <div className="sm:col-span-2">
          <label htmlFor={idParcelas} className="text-xs font-light text-muted">
            Parcelas
          </label>
          <div className="relative mt-1.5">
            <select
              id={idParcelas}
              name="installments"
              value={parcelamento.selecionada}
              /* Enquanto carrega, as opções na tela ainda são as do total
                 anterior. Select cinza por meio segundo é melhor que um rótulo
                 de dinheiro velho que a pessoa pode escolher. */
              disabled={desabilitado || parcelamento.carregando}
              onChange={(e) => parcelamento.selecionar(Number(e.target.value))}
              /* Faz o menu nativo do sistema abrir escuro, no lugar de um
                 retângulo branco no meio de um checkout preto. */
              style={{ colorScheme: 'dark' }}
              className="w-full appearance-none rounded-xl border border-white/10 bg-surface-2 py-3 pl-4 pr-11 text-sm text-ink transition-colors focus:border-accent/60 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-60"
            >
              {parcelamento.opcoes.map((opcao) => (
                <option key={opcao.valor} value={opcao.valor}>
                  {opcao.rotulo}
                  {opcao.valor > 1 && !opcao.temJuros ? ' · sem juros' : ''}
                </option>
              ))}
            </select>
            <ChevronDown
              aria-hidden
              className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
            />
          </div>

          {/* A linha que evita chamado de suporte: a partir daqui a tela tem
              dois números diferentes, e quem não explica o segundo recebe
              ligação. */}
          {opcaoSelecionada?.temJuros && (
            <p className="mt-1.5 text-xs font-light text-muted">
              {avisoDeJuros(totalCentavos)}
            </p>
          )}
        </div>
      </div>

      {erroDocumento && (
        <p
          role="alert"
          className="mt-4 flex items-start gap-2.5 rounded-xl border border-amber-400/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-200"
        >
          <IdCard aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{erroDocumento}</span>
        </p>
      )}
    </div>
  )
}

/**
 * Caixa de um campo seguro: rótulo, container do iframe e mensagem.
 *
 * O `<div>` do meio fica VAZIO de propósito — é o alvo do `mount()`. Nada
 * pode ser renderizado dentro dele: o SDK substitui o conteúdo por um iframe
 * e o React perderia a referência do que colocou lá.
 *
 * O rótulo visível é decorativo para leitor de tela (`aria-hidden`): quem
 * anuncia o campo é o `srLabel` que o SDK escreve dentro do iframe, e ter os
 * dois faria o leitor dizer "Número do cartão" duas vezes. A mensagem de erro,
 * essa sim, é anunciada — em `role="alert"`, no momento em que a pessoa sai do
 * campo com algo errado.
 */
function CaixaCampo({
  rotulo,
  containerId,
  estado,
  pronto,
  dica,
  className,
}: {
  rotulo: string
  containerId: string
  estado: EstadoCampo
  pronto: boolean
  dica?: string
  className?: string
}) {
  const mostrarErro = deveMostrarErro(estado)

  return (
    <div className={className}>
      <span aria-hidden className="text-xs font-light text-muted">
        {rotulo}
      </span>
      <div className="relative mt-1.5">
        <div
          className={[
            'flex h-[46px] items-center rounded-xl border bg-surface-2 px-4 transition-colors',
            mostrarErro
              ? 'border-red-400/50'
              : estado.focado
                ? 'border-accent/60 outline outline-2 outline-accent'
                : 'border-white/10',
          ].join(' ')}
        >
          {/* Alvo do mount(). Vazio, e tem de continuar vazio. */}
          <div id={containerId} className="h-full w-full" />
        </div>

        {estado.valido && !mostrarErro && (
          <Check
            aria-hidden
            className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-400"
          />
        )}

        {!pronto && (
          // Esqueleto por cima, não no lugar: o container precisa existir no
          // DOM para o SDK ter onde montar.
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 animate-pulse rounded-xl bg-surface-2"
          />
        )}
      </div>

      {mostrarErro ? (
        <p role="alert" className="mt-1.5 text-xs text-red-300">
          {estado.erro}
        </p>
      ) : (
        dica && (
          <p className="mt-1.5 text-xs font-light text-muted/70">{dica}</p>
        )
      )}
    </div>
  )
}
