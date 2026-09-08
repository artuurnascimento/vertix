import { CreditCard } from 'lucide-react'
import IconePix from './IconePix'
import BandeirasCartao from './BandeirasCartao'
import { formatarPercentual } from './checkoutTotal'

/** Método escolhido na tela. O Brick é montado só com o que está aqui. */
export type MetodoPagamento = 'cartao' | 'pix'

interface Props {
  metodo: MetodoPagamento
  onChange: (metodo: MetodoPagamento) => void
  /** Trava a troca enquanto o pagamento está em curso. */
  desabilitado: boolean
  /** Percentual abatido ao pagar no Pix; `null` = sem desconto por método. */
  descontoPixPercentual: number | null
  /**
   * Mostra só o método escolhido, com um link para reabrir a lista.
   *
   * Opcional e falso por padrão porque o Payment Brick usa este mesmo seletor
   * e não pode mudar de comportamento. Quem liga é o formulário novo, e só
   * DEPOIS que a pessoa escolheu: colapsar já na abertura esconderia o selo
   * de desconto do Pix, que é justamente o convite para o método que custa
   * menos taxa para a loja.
   */
  colapsado?: boolean
  /** Reabre a lista. Necessário sempre que `colapsado` for true. */
  onTrocar?: () => void
  /**
   * Nenhuma opção marcada, à espera de uma escolha de verdade.
   *
   * `metodo` continua valendo para o resto da página (é ele que decide o total
   * exibido), mas nenhum radio aparece marcado: o padrão pré-selecionado faz a
   * pessoa passar direto sem ler as opções — e passar direto pelo Pix é passar
   * direto pelo desconto.
   */
  semSelecao?: boolean
}

/**
 * Escolha do método de pagamento.
 *
 * São radios de verdade (não divs com onClick): setas do teclado navegam entre
 * as opções, espaço seleciona, e leitor de tela anuncia "1 de 2". A seleção
 * decide QUAL formulário o Brick monta — não é enfeite duplicando a lista
 * interna do Mercado Pago, que fica desligada.
 *
 * Quando há desconto no Pix, o selo verde do card fica visível TAMBÉM com o
 * cartão selecionado: é assim que ele funciona como convite para trocar. O
 * total muda de verdade ao selecionar — o selo não promete nada que a próxima
 * linha do resumo não confirme.
 */
export default function SeletorMetodo({
  metodo,
  onChange,
  desabilitado,
  descontoPixPercentual,
  colapsado = false,
  onTrocar,
  semSelecao = false,
}: Props) {
  const seloPix =
    descontoPixPercentual === null
      ? undefined
      : `${formatarPercentual(descontoPixPercentual)}% OFF`

  const descricaoSeloPix =
    descontoPixPercentual === null
      ? undefined
      : `${formatarPercentual(descontoPixPercentual)}% de desconto pagando no Pix`

  const cartao = (
    <Opcao
      valor="cartao"
      selecionado={!semSelecao && metodo === 'cartao'}
      onChange={onChange}
      icone={<CreditCard aria-hidden className="h-5 w-5" />}
      titulo="Cartão de crédito"
      selo="Parcelamento disponível"
      subtitulo="Pague com segurança e parcele no cartão."
      extra={<BandeirasCartao />}
    />
  )

  const pix = (
    <Opcao
      valor="pix"
      selecionado={!semSelecao && metodo === 'pix'}
      onChange={onChange}
      icone={<IconePix className="h-5 w-5 text-[#32BCAD]" />}
      titulo="Pix"
      selo={seloPix}
      // "10% OFF" lido em voz alta não diz de quê. O texto curto fica na
      // tela; o leitor de tela ouve a frase inteira.
      seloDescricao={descricaoSeloPix}
      subtitulo="Aprovação imediata. Mais rápido e prático."
    />
  )

  if (colapsado) {
    return (
      <fieldset className="mt-4" disabled={desabilitado}>
        <legend className="sr-only">Forma de pagamento escolhida</legend>
        <div className="grid gap-2">
          {metodo === 'cartao' ? cartao : pix}
          <button
            type="button"
            onClick={onTrocar}
            className="justify-self-center rounded-lg px-2 py-1 text-xs font-light text-muted underline decoration-white/20 underline-offset-4 transition-colors hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          >
            Escolher outra forma de pagamento
          </button>
        </div>
      </fieldset>
    )
  }

  return (
    <fieldset className="mt-4" disabled={desabilitado}>
      <legend className="sr-only">Forma de pagamento</legend>
      <div className="grid gap-2.5">
        {cartao}
        {pix}
      </div>
    </fieldset>
  )
}

function Opcao({
  valor,
  selecionado,
  onChange,
  icone,
  titulo,
  selo,
  seloDescricao,
  subtitulo,
  extra,
}: {
  valor: MetodoPagamento
  selecionado: boolean
  onChange: (metodo: MetodoPagamento) => void
  icone: React.ReactNode
  titulo: string
  selo?: string
  /** Frase completa para leitor de tela quando o selo é abreviado. */
  seloDescricao?: string
  subtitulo: string
  extra?: React.ReactNode
}) {
  const id = `metodo-${valor}`

  return (
    <label
      htmlFor={id}
      className={[
        'flex cursor-pointer items-center gap-3.5 rounded-xl border p-4 transition-colors duration-150',
        selecionado
          ? 'border-accent bg-accent/[0.09]'
          : 'border-white/10 bg-surface-2/60 hover:border-white/25',
        'focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent',
      ].join(' ')}
    >
      <span className="relative flex h-[18px] w-[18px] shrink-0 items-center justify-center">
        <input
          id={id}
          type="radio"
          name="metodo-pagamento"
          value={valor}
          checked={selecionado}
          onChange={() => onChange(valor)}
          // `onChange` não dispara ao clicar na opção JÁ selecionada, e cartão
          // vem marcado desde a abertura: sem este `onClick`, confirmar o
          // cartão não seria registrado como escolha e a lista nunca
          // encolheria. Chamar com o mesmo valor é inofensivo — quem recebe só
          // regrava o método atual.
          onClick={() => onChange(valor)}
          className="peer h-[18px] w-[18px] cursor-pointer appearance-none rounded-full border-2 border-white/25 transition-colors checked:border-accent"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute h-2 w-2 rounded-full bg-accent opacity-0 peer-checked:opacity-100"
        />
      </span>

      <span
        aria-hidden
        className={[
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors',
          selecionado ? 'bg-accent/25 text-accent' : 'bg-white/[0.06] text-muted',
        ].join(' ')}
      >
        {icone}
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-bold text-ink">{titulo}</span>
          {selo && (
            <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
              {seloDescricao ? (
                <>
                  <span aria-hidden>{selo}</span>
                  <span className="sr-only">{seloDescricao}</span>
                </>
              ) : (
                selo
              )}
            </span>
          )}
        </span>
        <span className="mt-0.5 block text-xs font-light text-muted">
          {subtitulo}
        </span>
      </span>

      {extra && <span className="hidden shrink-0 sm:block">{extra}</span>}
    </label>
  )
}
