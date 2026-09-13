import { useId } from 'react'
import { Check, Plus } from 'lucide-react'
import { formatarCentavos } from './checkoutTotal'
import { textoDoBump } from './conteudoCheckout'
import ImagemResponsiva from './ImagemResponsiva'
import type { BumpCheckout } from './checkoutTypes'

interface Props {
  bump: BumpCheckout
  marcado: boolean
  onChange: (marcado: boolean) => void
}

/**
 * Oferta adicional marcável — o bloco mais chamativo da página, e o primeiro
 * do fluxo. Borda roxa cheia e fundo arroxeado dão o destaque; a copy continua
 * sendo só a que o dono do checkout escreveu.
 *
 * Duas formas, decididas no painel:
 *
 * - SEM imagem: título, texto e a lista de benefícios (recorte do texto
 *   configurado, ver `textoDoBump`; quando ele não se deixa quebrar em itens,
 *   a coluna some e o texto vira parágrafo). Nenhum benefício é inventado.
 * - COM imagem: a arte É o card. Ela substitui título, texto e lista — a copy
 *   está desenhada nela —, e embaixo fica só o que a arte não pode carregar:
 *   a caixa de marcar e o preço. Título e texto continuam no DOM como
 *   descrição acessível, para quem não vê a arte saber o que está marcando.
 *
 * O <label> envolve tudo, então o card inteiro é o alvo do clique — no celular
 * isso é a diferença entre marcar e errar o quadradinho.
 */
export default function OrderBump({ bump, marcado, onChange }: Props) {
  const id = useId()
  const descricaoId = `${id}-descricao`
  const { paragrafo, beneficios } = textoDoBump(bump.descricao)

  const classeCard = [
    'group relative block cursor-pointer overflow-hidden rounded-2xl border-2 p-4 transition-colors duration-150 sm:p-5',
    marcado
      ? 'border-accent bg-accent/[0.12]'
      : 'border-accent/60 bg-accent/[0.05] hover:border-accent hover:bg-accent/[0.09]',
    'focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent',
  ].join(' ')

  const caixa = (descritoPor: string | undefined) => (
    <span className="relative mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center">
      <input
        id={id}
        type="checkbox"
        checked={marcado}
        onChange={(e) => onChange(e.target.checked)}
        aria-describedby={descritoPor}
        className="peer h-6 w-6 cursor-pointer appearance-none rounded-md border-2 border-accent/70 bg-transparent transition-colors checked:border-accent checked:bg-accent"
      />
      <Check
        aria-hidden
        strokeWidth={3}
        className="pointer-events-none absolute h-4 w-4 text-white opacity-0 transition-opacity peer-checked:opacity-100"
      />
    </span>
  )

  const preco = (
    <p className="flex flex-wrap items-baseline gap-2">
      {bump.ancoraCentavos !== null && (
        <>
          <span className="text-xs font-light text-muted line-through">
            {formatarCentavos(bump.ancoraCentavos)}
          </span>
          <span aria-hidden className="text-accent">
            ·
          </span>
        </>
      )}
      <span className="text-lg font-extrabold tabular-nums text-ink">
        {formatarCentavos(bump.precoCentavos)}
      </span>
    </p>
  )

  if (bump.imagem !== null) {
    return (
      <label htmlFor={id} className={classeCard}>
        <span
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-20 h-40 w-40 rounded-full bg-accent/20 blur-3xl"
        />
        <ImagemResponsiva
          imagem={bump.imagem}
          className="relative block h-auto w-full rounded-xl object-cover"
        />
        {/* O que a arte não carrega: a caixa e o preço. O rótulo "Adicione ao
            pedido" fica ao lado da caixa para ela nunca ser um quadrado solto. */}
        <div className="relative mt-3 flex items-center justify-between gap-3">
          <span className="flex items-center gap-3">
            {caixa(descricaoId)}
            <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-accent">
              <Plus aria-hidden className="h-3 w-3" />
              Adicione ao pedido
            </span>
          </span>
          {preco}
        </div>
        {/* Título e texto continuam aqui, só para leitores de tela: é o que
            diz O QUE está sendo adicionado quando a arte não é vista. */}
        <span id={descricaoId} className="sr-only">
          {bump.titulo}
          {paragrafo ? `. ${paragrafo}` : ''}
          {beneficios.length > 0 ? `. ${beneficios.join('. ')}` : ''}
        </span>
      </label>
    )
  }

  return (
    <label htmlFor={id} className={classeCard}>
      {/* Brilho de canto: dá volume ao card sem competir com o texto. */}
      <span
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-20 h-40 w-40 rounded-full bg-accent/20 blur-3xl"
      />

      <div className="relative grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-5">
        <div className="flex items-start gap-3.5">
          {caixa(paragrafo ? descricaoId : undefined)}

          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-accent">
              <Plus aria-hidden className="h-3 w-3" />
              Adicione ao pedido
            </p>
            <p className="mt-2 text-[15px] font-bold leading-snug text-ink sm:text-base">
              {bump.titulo}
            </p>
            {paragrafo && (
              <p
                id={descricaoId}
                className="mt-2 text-xs font-light leading-relaxed text-muted"
              >
                {paragrafo}
              </p>
            )}
            <div className="mt-3">{preco}</div>
          </div>
        </div>

        {beneficios.length > 0 && (
          <ul className="flex flex-col justify-center gap-2.5 border-t border-accent/20 pt-4 sm:max-w-[15rem] sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0">
            {beneficios.map((beneficio, indice) => (
              <li
                key={`${beneficio}-${indice}`}
                className="flex items-start gap-2.5 text-xs font-light leading-snug text-ink/85"
              >
                <span
                  aria-hidden
                  className="mt-px flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-accent/25"
                >
                  <Check strokeWidth={3} className="h-2.5 w-2.5 text-accent" />
                </span>
                {beneficio}
              </li>
            ))}
          </ul>
        )}
      </div>
    </label>
  )
}
