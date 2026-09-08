import { useId } from 'react'

interface Props {
  /** Ícone do cabeçalho. Decorativo — o título já nomeia a seção. */
  icone: React.ReactNode
  titulo: string
  /** Texto miúdo alinhado à direita do cabeçalho. */
  aside?: React.ReactNode
  id?: string
  className?: string
  children: React.ReactNode
}

/**
 * Moldura das seções do fluxo de compra: cartão escuro, cabeçalho com ícone,
 * rótulo em maiúsculas espaçadas e uma nota discreta à direita.
 *
 * Existe para as quatro seções terem a MESMA altura de cabeçalho e o mesmo
 * respiro interno. Repetir esse desenho em cada arquivo é como as páginas
 * começam a desalinhar sozinhas com o tempo.
 */
export default function CartaoSecao({
  icone,
  titulo,
  aside,
  id,
  className,
  children,
}: Props) {
  const tituloId = useId()

  return (
    <section
      id={id}
      // tabIndex −1: a barra fixa do celular manda o foco para cá.
      tabIndex={id ? -1 : undefined}
      aria-labelledby={tituloId}
      className={[
        'scroll-mt-6 rounded-2xl border border-white/[0.07] bg-surface-1/80 p-4 focus:outline-none sm:p-6',
        className ?? '',
      ].join(' ')}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h2
          id={tituloId}
          className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.22em] text-muted"
        >
          <span aria-hidden className="text-accent">
            {icone}
          </span>
          {titulo}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  )
}
