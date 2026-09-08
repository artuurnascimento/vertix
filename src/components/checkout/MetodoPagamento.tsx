import { CreditCard, QrCode } from 'lucide-react'
import BandeirasCartao from './BandeirasCartao'

/** Método escolhido na tela. O Brick é montado só com o que está aqui. */
export type MetodoPagamento = 'cartao' | 'pix'

interface Props {
  metodo: MetodoPagamento
  onChange: (metodo: MetodoPagamento) => void
  /** Trava a troca enquanto o pagamento está em curso. */
  desabilitado: boolean
}

/**
 * Escolha do método de pagamento.
 *
 * São radios de verdade (não divs com onClick): setas do teclado navegam entre
 * as opções, espaço seleciona, e leitor de tela anuncia "1 de 2". A seleção
 * decide QUAL formulário o Brick monta — não é enfeite duplicando a lista
 * interna do Mercado Pago, que fica desligada.
 */
export default function SeletorMetodo({
  metodo,
  onChange,
  desabilitado,
}: Props) {
  return (
    <fieldset className="mt-4" disabled={desabilitado}>
      <legend className="sr-only">Forma de pagamento</legend>
      <div className="grid gap-2.5">
        <Opcao
          valor="cartao"
          selecionado={metodo === 'cartao'}
          onChange={onChange}
          icone={<CreditCard aria-hidden className="h-5 w-5" />}
          titulo="Cartão de crédito"
          selo="Parcelamento disponível"
          subtitulo="Pague com segurança e parcele no cartão."
          extra={<BandeirasCartao />}
        />
        <Opcao
          valor="pix"
          selecionado={metodo === 'pix'}
          onChange={onChange}
          icone={<QrCode aria-hidden className="h-5 w-5" />}
          titulo="Pix"
          subtitulo="Aprovação imediata. Mais rápido e prático."
        />
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
  subtitulo,
  extra,
}: {
  valor: MetodoPagamento
  selecionado: boolean
  onChange: (metodo: MetodoPagamento) => void
  icone: React.ReactNode
  titulo: string
  selo?: string
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
              {selo}
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
