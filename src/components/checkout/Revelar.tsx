interface Props {
  aberto: boolean
  /** Alvo do `aria-controls` do botão que abre e fecha. */
  id?: string
  /** Some do fluxo de leitura enquanto está fechado. */
  children: React.ReactNode
  className?: string
}

/**
 * Recolhe e revela um trecho SEM animar altura em pixels.
 *
 * O truque é `grid-template-rows: 0fr → 1fr`: o navegador interpola a fração
 * da linha, o conteúdo mantém a altura natural (nada de medir com JS, nada de
 * `max-height` chutado que corta texto longo) e a transição roda sem forçar
 * relayout a cada quadro como `height: auto → 400px` faria.
 *
 * `visibility` fechada tira o conteúdo do foco por tabulação e da leitura de
 * tela — recolhido precisa significar ausente, não "invisível mas focável".
 */
export default function Revelar({ aberto, id, children, className }: Props) {
  return (
    <div
      id={id}
      className={[
        'grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none',
        aberto ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        className ?? '',
      ].join(' ')}
    >
      <div
        className={[
          'overflow-hidden transition-opacity duration-200 motion-reduce:transition-none',
          aberto ? 'opacity-100' : 'invisible opacity-0',
        ].join(' ')}
      >
        {children}
      </div>
    </div>
  )
}
