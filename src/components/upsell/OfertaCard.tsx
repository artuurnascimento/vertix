import { useId } from 'react'
import { CreditCard, Loader2, ShieldCheck, Sparkles } from 'lucide-react'
import type { Oferta } from './upsellFluxo'
import { formatarCentavos } from './upsellFluxo'
import { CVV_CONTAINER_ID } from './cardToken'

interface Props {
  oferta: Oferta
  processando: boolean
  /** Mensagem já traduzida para pt-BR (ver mensagemErroUpsell). */
  erro: string | null
  /** O campo seguro do Mercado Pago terminou de montar. */
  campoPronto: boolean
  /** O SDK do Mercado Pago não carregou — sem ele não há cobrança possível. */
  erroSdk: boolean
  /** "4242", quando o pedido informa — deixa o texto concreto. */
  ultimosDigitos: string | null
  onAceitar: () => void
  onRecusar: () => void
}

/**
 * O card da oferta pós-compra.
 *
 * Três decisões que não são negociáveis aqui:
 *
 *  - O número do cartão NUNCA é pedido de novo. A cobrança vai no cartão salvo
 *    do primeiro pagamento; a pessoa só reconfirma o código de segurança.
 *  - O campo do código NÃO é nosso. É um iframe do Mercado Pago montado dentro
 *    do container abaixo: o CVV é lido pelo SDK e vira um token de uso único,
 *    sem nunca passar pelo nosso JavaScript nem pelo nosso servidor. Por isso
 *    o container é um <div> vazio, e não um <input> — ver cardToken.ts.
 *  - A recusa é visível. Mesmo tamanho, mesma área de toque, texto em `ink`
 *    com borda de verdade. Apagar a saída em cinza-sobre-cinza converte um
 *    pouco mais e queima a confiança de quem acabou de comprar; não fazemos.
 */
export function OfertaCard({
  oferta,
  processando,
  erro,
  campoPronto,
  erroSdk,
  ultimosDigitos,
  onAceitar,
  onRecusar,
}: Props) {
  const cvvTituloId = useId()
  const cvvAjudaId = `${cvvTituloId}-ajuda`

  const preco = oferta.precoCentavos
  const temPreco = preco !== null
  const rotuloAceitar = processando
    ? 'Processando…'
    : temPreco
      ? `Adicionar por ${formatarCentavos(preco)}`
      : 'Adicionar ao meu pedido'

  const cartao = ultimosDigitos
    ? `o cartão final ${ultimosDigitos} que você acabou de usar`
    : 'o mesmo cartão que você acabou de usar'

  return (
    <section
      aria-label={
        oferta.etapa === 'upsell' ? 'Oferta adicional' : 'Oferta alternativa'
      }
      className="mt-5 rounded-2xl border border-white/5 bg-surface-1 p-5 sm:p-6"
    >
      <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.2em] text-accent">
        <Sparkles aria-hidden className="h-3.5 w-3.5" />
        {oferta.etapa === 'upsell' ? 'Só para quem comprou' : 'Outra opção'}
      </p>

      <h2 className="mt-3 text-xl font-bold leading-snug text-ink sm:text-2xl">
        {oferta.titulo}
      </h2>

      {oferta.texto && (
        <p className="mt-2.5 whitespace-pre-line text-sm font-light leading-relaxed text-muted">
          {oferta.texto}
        </p>
      )}

      {temPreco && (
        <p className="mt-5 text-3xl font-bold tabular-nums text-ink sm:text-4xl">
          {formatarCentavos(preco)}
        </p>
      )}

      {/* ------------------------------------------- código de segurança -- */}
      <div
        role="group"
        aria-labelledby={cvvTituloId}
        aria-describedby={cvvAjudaId}
        className="mt-5 rounded-xl border border-white/10 bg-surface-2 p-4"
      >
        <p
          id={cvvTituloId}
          className="flex items-center gap-2 text-sm font-semibold text-ink"
        >
          <CreditCard aria-hidden className="h-4 w-4 text-accent" />
          Código de segurança
        </p>
        <p
          id={cvvAjudaId}
          className="mt-1.5 text-xs font-light leading-relaxed text-muted"
        >
          Por segurança, digite os 3 dígitos do verso {cartao} (4, se for Amex).
          Não pedimos o número nem a validade do cartão.
        </p>

        {/* O SDK do Mercado Pago injeta o campo aqui dentro. A moldura é
            nossa; o que a pessoa digita nunca chega ao nosso código. */}
        <div className="relative mt-3 h-[52px] w-28">
          {!campoPronto && !erroSdk && (
            <div
              aria-hidden
              className="absolute inset-0 animate-pulse rounded-lg bg-white/5"
            />
          )}
          <div
            id={CVV_CONTAINER_ID}
            className="h-full w-full overflow-hidden rounded-lg border border-white/15 bg-bg px-3 [&>iframe]:h-full [&>iframe]:w-full [&>iframe]:border-0"
          />
        </div>

        {erroSdk && (
          <p role="alert" className="mt-3 text-xs leading-relaxed text-red-300">
            Não foi possível carregar o campo seguro do cartão. Recarregue a
            página — sua compra anterior segue confirmada.
          </p>
        )}
      </div>

      {erro && (
        <p
          role="alert"
          className="mt-5 rounded-lg border border-red-400/25 bg-red-500/10 px-3.5 py-2.5 text-sm leading-relaxed text-red-300"
        >
          {erro}
        </p>
      )}

      {/* Estado de carregando anunciado por leitor de tela. */}
      <p aria-live="polite" className="sr-only">
        {processando ? 'Processando a cobrança, aguarde.' : ''}
      </p>

      <div className="mt-6 flex flex-col gap-3">
        <button
          type="button"
          onClick={onAceitar}
          disabled={processando || erroSdk}
          aria-busy={processando}
          className="inline-flex min-h-[56px] w-full items-center justify-center gap-2 rounded-xl bg-accent px-5 py-4 text-base font-semibold text-white transition-colors duration-150 hover:bg-accent-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-70"
        >
          {processando && (
            <Loader2 aria-hidden className="h-4 w-4 motion-safe:animate-spin" />
          )}
          {rotuloAceitar}
        </button>

        <button
          type="button"
          onClick={onRecusar}
          disabled={processando}
          className="inline-flex min-h-[52px] w-full items-center justify-center rounded-xl border border-white/15 bg-white/5 px-5 py-3.5 text-base font-medium text-ink transition-colors duration-150 hover:border-white/30 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-70"
        >
          Não, obrigado
        </button>
      </div>

      <p className="mt-4 flex items-start gap-2 text-xs font-light leading-relaxed text-muted">
        <ShieldCheck
          aria-hidden
          className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent"
        />
        A cobrança vai em {cartao} — o número do cartão não é pedido de novo.
        Recusar não afeta o seu pedido.
      </p>
    </section>
  )
}
