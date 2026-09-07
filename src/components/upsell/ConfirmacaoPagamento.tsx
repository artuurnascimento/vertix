import { CheckCircle2 } from 'lucide-react'
import { Link } from 'react-router-dom'

/**
 * Primeira coisa que a pessoa vê depois de pagar: a confirmação do que ela já
 * comprou — antes de qualquer oferta.
 *
 * O link "Ver meu pedido" existe desde o primeiro pixel e leva direto à
 * confirmação final. Quem entrou só para conferir o pedido consegue sair da
 * oferta sem ler nada e sem susto; esconder essa saída para forçar a leitura da
 * oferta é o que faz a página parecer uma armadilha.
 */
export function ConfirmacaoPagamento({
  linkPedido,
  nomeProduto,
}: {
  linkPedido: string
  nomeProduto?: string | null
}) {
  return (
    <section
      aria-label="Confirmação do pagamento"
      className="mt-8 rounded-2xl border border-emerald-400/25 bg-emerald-400/[0.07] px-5 py-5 sm:px-6"
    >
      <div className="flex items-start gap-3">
        <CheckCircle2
          aria-hidden
          className="mt-0.5 h-6 w-6 shrink-0 text-emerald-400"
        />
        <div className="min-w-0">
          <h1 className="text-lg font-semibold leading-tight text-ink sm:text-xl">
            Pagamento aprovado
          </h1>
          <p className="mt-1 text-sm font-light leading-relaxed text-muted">
            {nomeProduto
              ? `Sua compra de ${nomeProduto} está confirmada. `
              : 'Sua compra está confirmada. '}
            Você recebe o e-mail com os detalhes em instantes.
          </p>
          <Link
            to={linkPedido}
            className="mt-3 inline-flex rounded text-sm font-medium text-ink underline underline-offset-4 transition-colors duration-150 hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Ver meu pedido
          </Link>
        </div>
      </div>
    </section>
  )
}
