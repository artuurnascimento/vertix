import { motion, useReducedMotion } from 'framer-motion'
import { Check, ShieldCheck, ShoppingCart } from 'lucide-react'
import LogoMark from '../ui/LogoMark'
import { formatarCentavos } from './checkoutTotal'
import type { ResultadoTotal } from './checkoutTotal'
import type { BeneficioResumo } from './conteudoCheckout'
import type { BumpCheckout, ProdutoCheckout } from './checkoutTypes'

interface Props {
  produto: ProdutoCheckout
  bump: BumpCheckout | null
  bumpMarcado: boolean
  cupomCodigo: string | null
  total: ResultadoTotal
  /** Já derivados da configuração. Vazio = o bloco não aparece. */
  beneficios: BeneficioResumo[]
}

/**
 * Resumo do pedido — a coluna que fica grudada no alto do desktop e abre a
 * página no celular. Recalcula ao vivo conforme bump e cupom, e diz em letras
 * miúdas que o valor definitivo é o do servidor: nada que o navegador some
 * aqui muda o que vai ser cobrado.
 *
 * Bump e cupom entram como linhas próprias ANTES do total. Sem elas, o total
 * mudaria sozinho na frente de quem está decidindo pagar.
 */
export default function ResumoPedido({
  produto,
  bump,
  bumpMarcado,
  cupomCodigo,
  total,
  beneficios,
}: Props) {
  const semMovimento = useReducedMotion()

  return (
    <section
      aria-labelledby="resumo-titulo"
      className="overflow-hidden rounded-2xl border border-white/[0.07] bg-surface-1/80 p-5 sm:p-6"
    >
      <h2
        id="resumo-titulo"
        className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.22em] text-muted"
      >
        <ShoppingCart aria-hidden className="h-3.5 w-3.5 text-accent" />
        Seu pedido
      </h2>

      <div className="mt-5 flex items-start gap-3.5">
        {produto.imagemUrl ? (
          <img
            src={produto.imagemUrl}
            alt=""
            width={52}
            height={52}
            className="h-[52px] w-[52px] shrink-0 rounded-xl border border-white/5 object-cover"
          />
        ) : (
          <span
            aria-hidden
            className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-xl border border-accent/25 bg-accent/10"
          >
            <LogoMark className="h-6 w-6" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold leading-snug text-ink">
            {produto.nome}
          </p>
          <p className="mt-1 flex flex-wrap items-baseline gap-2">
            {produto.ancoraCentavos !== null && (
              <span className="text-xs font-light text-muted line-through">
                {formatarCentavos(produto.ancoraCentavos)}
              </span>
            )}
            <span className="text-sm font-bold tabular-nums text-accent">
              {formatarCentavos(produto.precoCentavos)}
            </span>
          </p>
          {produto.descricao && (
            <p className="mt-1.5 text-xs font-light leading-relaxed text-muted">
              {produto.descricao}
            </p>
          )}
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

      <div className="mt-5 flex items-end justify-between gap-3 border-t border-white/[0.07] pt-4">
        <div className="min-w-0">
          <p className="text-sm font-bold text-ink">Total</p>
          <p className="mt-0.5 text-[11px] font-light leading-snug text-muted/70">
            Valor confirmado pelo nosso servidor no pagamento.
          </p>
        </div>
        {/* aria-live polite: quem usa leitor de tela ouve o total mudar ao
            marcar o bump ou aplicar o cupom, sem precisar procurar. */}
        <p
          aria-live="polite"
          className="shrink-0 text-[26px] font-extrabold leading-none tabular-nums text-ink"
        >
          {formatarCentavos(total.totalCentavos)}
        </p>
      </div>

      {beneficios.length > 0 && (
        <ul className="mt-5 flex flex-col gap-3 border-t border-white/[0.07] pt-5">
          {/* Índice na chave: dois selos com o mesmo texto são configuração
              ruim, não motivo para o React perder o rastro da lista. */}
          {beneficios.map((beneficio, indice) => (
            <li
              key={`${beneficio.titulo}-${indice}`}
              className="flex items-start gap-2.5"
            >
              <span
                aria-hidden
                className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-accent/20"
              >
                <Check strokeWidth={3} className="h-2.5 w-2.5 text-accent" />
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-semibold leading-snug text-ink">
                  {beneficio.titulo}
                </span>
                {beneficio.apoio && (
                  <span className="mt-0.5 block text-[11px] font-light leading-snug text-muted">
                    {beneficio.apoio}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-5 flex items-start gap-3 rounded-xl border border-accent/20 bg-accent/[0.07] p-3.5">
        <ShieldCheck aria-hidden className="h-4 w-4 shrink-0 text-accent" />
        <p className="text-[11px] font-light leading-relaxed text-muted">
          <span className="font-semibold text-ink">Compra segura.</span> Seus
          dados trafegam criptografados e o pagamento é processado pelo Mercado
          Pago.
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
      className="mt-3 flex items-center justify-between gap-3 border-t border-white/[0.07] pt-3 text-sm"
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
