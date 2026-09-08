import { useId, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Check, ChevronDown, ShieldCheck, ShoppingCart } from 'lucide-react'
import LogoMark from '../ui/LogoMark'
import Revelar from './Revelar'
import { formatarCentavos, formatarPercentual } from './checkoutTotal'
import type { ResultadoTotal } from './checkoutTotal'
import type { BeneficioResumo } from './conteudoCheckout'
import type { BumpCheckout, ProdutoCheckout } from './checkoutTypes'
import type { MetodoPagamento } from './MetodoPagamento'

interface Props {
  produto: ProdutoCheckout
  bump: BumpCheckout | null
  bumpMarcado: boolean
  cupomCodigo: string | null
  /** Método escolhido — decide o rótulo da linha de desconto por método. */
  metodo: MetodoPagamento
  /** Percentual configurado, só para etiquetar a linha ("10%"). */
  descontoPixPercentual: number | null
  total: ResultadoTotal
  /** Já derivados da configuração. Vazio = o bloco não aparece. */
  beneficios: BeneficioResumo[]
  /**
   * Como o bloco nasce nesta oferta, vindo da configuração do checkout.
   * `false` = recolhido, que é o padrão do banco.
   */
  padraoAberto: boolean
}

/**
 * Resumo do pedido, RECOLHIDO por padrão — em qualquer largura de tela.
 *
 * O estado inicial vem de `padraoAberto`, que é configuração da OFERTA
 * (`checkouts.resumo_aberto`), não do aparelho. Antes ele era decidido aqui
 * por `matchMedia`: recolhido no celular, aberto a partir de 1024px. A regra
 * por largura saiu porque a resposta certa não é do tamanho da tela e sim do
 * que está sendo vendido — e porque, aberto, o bloco ocupa quase uma tela
 * inteira de telefone (descrição do produto, linhas, benefícios, selo de
 * segurança) e empurra o formulário de pagamento para muito abaixo da dobra.
 * Quem já decidiu comprar não precisa reler a oferta — precisa achar o botão.
 *
 * Por isso o padrão do banco é recolhido, e quem vende um pacote caro, com
 * muita coisa inclusa, marca a caixa na configuração para ele nascer aberto.
 *
 * Duas coisas nunca se escondem, porque são o que a pessoa procura de relance:
 * o NOME do que está comprando e o TOTAL. E quando algum desconto pegou (cupom
 * ou método de pagamento), o estado fechado diz isso em uma linha — ver o
 * abatimento não pode depender de abrir nada.
 *
 * O cabeçalho inteiro é um `<button aria-expanded>`, não uma div com onClick:
 * é o que faz teclado e leitor de tela entenderem que ali abre e fecha.
 */
export default function ResumoPedido({
  produto,
  bump,
  bumpMarcado,
  cupomCodigo,
  metodo,
  descontoPixPercentual,
  total,
  beneficios,
  padraoAberto,
}: Props) {
  const semMovimento = useReducedMotion()
  const detalhesId = useId()

  // Semente, não amarra: `padraoAberto` decide só o primeiro quadro. Depois da
  // montagem quem manda é o clique da pessoa, e mudar a configuração da oferta
  // (ou qualquer re-render) não desfaz uma escolha que ela acabou de fazer.
  const [aberto, setAberto] = useState(padraoAberto)

  const descontoTotal = total.descontoCentavos + total.descontoMetodoCentavos
  const temBump = bumpMarcado && bump !== null

  return (
    <section
      aria-labelledby="resumo-titulo"
      className="overflow-hidden rounded-2xl border border-white/[0.07] bg-surface-1/80"
    >
      <h2 id="resumo-titulo" className="sr-only">
        Seu pedido
      </h2>

      <button
        type="button"
        aria-expanded={aberto}
        aria-controls={detalhesId}
        onClick={() => setAberto((atual) => !atual)}
        className="w-full p-5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent sm:p-6"
      >
        <span className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.22em] text-muted">
            <ShoppingCart aria-hidden className="h-3.5 w-3.5 text-accent" />
            Seu pedido
          </span>
          <span className="flex items-center gap-1.5 text-[11px] font-light text-muted/80">
            {aberto ? 'Ocultar' : 'Ver detalhes'}
            <ChevronDown
              aria-hidden
              className={[
                'h-4 w-4 transition-transform duration-200 motion-reduce:transition-none',
                aberto ? 'rotate-180' : '',
              ].join(' ')}
            />
          </span>
        </span>

        <span className="mt-4 flex items-center justify-between gap-4">
          <span className="flex min-w-0 items-center gap-3">
            {produto.imagemUrl ? (
              <img
                src={produto.imagemUrl}
                alt=""
                width={44}
                height={44}
                className="h-11 w-11 shrink-0 rounded-xl border border-white/5 object-cover"
              />
            ) : (
              <span
                aria-hidden
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-accent/25 bg-accent/10"
              >
                <LogoMark className="h-5 w-5" />
              </span>
            )}
            <span className="min-w-0 text-sm font-bold leading-snug text-ink">
              {produto.nome}
            </span>
          </span>

          <span className="shrink-0 text-right">
            <span className="block text-[10px] uppercase tracking-widest text-muted">
              Total
            </span>
            {/* aria-live polite: quem usa leitor de tela ouve o total mudar ao
                trocar o método, marcar o bump ou aplicar o cupom — inclusive
                com o resumo fechado, que é o estado padrão. */}
            <span
              aria-live="polite"
              className="block text-[26px] font-extrabold leading-none tabular-nums text-ink"
            >
              {formatarCentavos(total.totalCentavos)}
            </span>
          </span>
        </span>

        {/* Fechado, mas o desconto aparece: ninguém deveria precisar abrir uma
            gaveta para descobrir se o cupom que digitou pegou. */}
        {(descontoTotal > 0 || temBump) && (
          <span className="mt-3 flex flex-wrap items-center gap-2">
            {temBump && (
              <span className="max-w-full truncate rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-light text-muted">
                + {bump.titulo}
              </span>
            )}
            {descontoTotal > 0 && (
              <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-medium tabular-nums text-emerald-300">
                − {formatarCentavos(descontoTotal)} de desconto
              </span>
            )}
          </span>
        )}
      </button>

      <Revelar aberto={aberto} id={detalhesId}>
        <div className="px-5 pb-5 sm:px-6 sm:pb-6">
          <p className="flex flex-wrap items-baseline gap-2 border-t border-white/[0.07] pt-4">
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

          {temBump && (
            <Linha
              semMovimento={semMovimento}
              rotulo={bump.titulo}
              etiqueta="adicional"
              valor={`+ ${formatarCentavos(bump.precoCentavos)}`}
              classeValor="text-ink"
            />
          )}

          {/* Ordem das linhas = ordem da conta: cupom primeiro, desconto do
              método depois, sobre o que sobrou. É a mesma ordem do servidor. */}
          {total.descontoCentavos > 0 && (
            <Linha
              semMovimento={semMovimento}
              rotulo="Cupom"
              etiqueta={cupomCodigo ?? undefined}
              valor={`− ${formatarCentavos(total.descontoCentavos)}`}
              classeValor="text-emerald-300"
            />
          )}

          {total.descontoMetodoCentavos > 0 && (
            <Linha
              semMovimento={semMovimento}
              rotulo={metodo === 'pix' ? 'Desconto no Pix' : 'Desconto'}
              etiqueta={
                descontoPixPercentual === null
                  ? undefined
                  : `${formatarPercentual(descontoPixPercentual)}%`
              }
              valor={`− ${formatarCentavos(total.descontoMetodoCentavos)}`}
              classeValor="text-emerald-300"
            />
          )}

          <p className="mt-4 border-t border-white/[0.07] pt-4 text-[11px] font-light leading-snug text-muted/70">
            Valor confirmado pelo nosso servidor no pagamento.
          </p>

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
              dados trafegam criptografados e o pagamento é processado pelo
              Mercado Pago.
            </p>
          </div>
        </div>
      </Revelar>
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
          ("adicional", código do cupom, percentual do Pix). */}
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
