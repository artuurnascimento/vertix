import { motion, useReducedMotion } from 'framer-motion'
import { formatarCentavos } from './checkoutTotal'
import type { ResultadoTotal } from './checkoutTotal'
import type { BumpCheckout, ProdutoCheckout } from './checkoutTypes'

interface Props {
  produto: ProdutoCheckout
  bump: BumpCheckout | null
  bumpMarcado: boolean
  cupomCodigo: string | null
  total: ResultadoTotal
}

/**
 * Resumo do pedido. Recalcula ao vivo conforme bump e cupom, e diz em letras
 * miúdas que o valor definitivo é o do servidor — porque é: nada que o
 * navegador some aqui muda o que vai ser cobrado.
 */
export default function ResumoPedido({
  produto,
  bump,
  bumpMarcado,
  cupomCodigo,
  total,
}: Props) {
  const semMovimento = useReducedMotion()

  return (
    <section
      aria-labelledby="resumo-titulo"
      className="rounded-2xl border border-white/5 bg-surface-1 p-5 sm:p-6"
    >
      <h2
        id="resumo-titulo"
        className="text-[11px] font-medium uppercase tracking-[0.25em] text-muted"
      >
        Seu pedido
      </h2>

      <div className="mt-4 flex items-start gap-3">
        {produto.imagemUrl && (
          <img
            src={produto.imagemUrl}
            alt=""
            width={56}
            height={56}
            className="h-14 w-14 shrink-0 rounded-lg border border-white/5 object-cover"
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-ink">{produto.nome}</p>
          {produto.descricao && (
            <p className="mt-1 text-xs font-light leading-relaxed text-muted">
              {produto.descricao}
            </p>
          )}
        </div>
        <div className="shrink-0 text-right">
          {produto.ancoraCentavos !== null && (
            <p className="text-xs font-light text-muted line-through">
              {formatarCentavos(produto.ancoraCentavos)}
            </p>
          )}
          <p className="text-sm font-semibold tabular-nums text-ink">
            {formatarCentavos(produto.precoCentavos)}
          </p>
        </div>
      </div>

      {bumpMarcado && bump && (
        <Linha
          semMovimento={semMovimento}
          rotulo={bump.titulo}
          etiqueta="adicional"
          valor={`+ ${formatarCentavos(bump.precoCentavos)}`}
          classeValor="text-ink"
        />
      )}

      {total.descontoCentavos > 0 && (
        <Linha
          semMovimento={semMovimento}
          rotulo="Cupom"
          etiqueta={cupomCodigo ?? undefined}
          valor={`− ${formatarCentavos(total.descontoCentavos)}`}
          classeValor="text-emerald-300"
        />
      )}

      <div className="mt-5 flex items-end justify-between border-t border-white/5 pt-4">
        <div>
          <p className="text-sm text-muted">Total</p>
          <p className="text-[11px] font-light text-muted/70">
            Valor confirmado pelo nosso servidor no pagamento.
          </p>
        </div>
        {/* aria-live polite: quem usa leitor de tela ouve o total mudar ao
            marcar o bump ou aplicar o cupom, sem precisar procurar. */}
        <p
          aria-live="polite"
          className="text-2xl font-bold tabular-nums text-ink"
        >
          {formatarCentavos(total.totalCentavos)}
        </p>
      </div>
    </section>
  )
}

function Linha({
  rotulo,
  etiqueta,
  valor,
  classeValor,
  semMovimento,
}: {
  rotulo: string
  etiqueta?: string
  valor: string
  classeValor: string
  semMovimento: boolean | null
}) {
  return (
    <motion.div
      initial={semMovimento ? false : { opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="mt-3 flex items-center justify-between gap-3 border-t border-white/5 pt-3 text-sm"
    >
      {/* O rótulo trunca; a etiqueta não. Com as duas dentro do mesmo
          `truncate`, é a etiqueta que some — e é ela que explica a linha
          ("adicional", código do cupom). */}
      <span className="flex min-w-0 items-center gap-1.5 text-muted">
        <span className="truncate">{rotulo}</span>
        {etiqueta && (
          <span className="shrink-0 rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted">
            {etiqueta}
          </span>
        )}
      </span>
      <span className={`shrink-0 tabular-nums ${classeValor}`}>{valor}</span>
    </motion.div>
  )
}
