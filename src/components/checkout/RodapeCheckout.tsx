import { Lock } from 'lucide-react'
import LogoMark from '../ui/LogoMark'

interface Props {
  /**
   * Mostra a linha "Ao prosseguir, você concorda…".
   *
   * Só faz sentido ANTES do pagamento. Na confirmação e no upsell a compra já
   * aconteceu, e pedir aceite de quem já pagou soa como se algo continuasse
   * pendente. Os links seguem presentes nos dois casos — quem procura as
   * regras depois de comprar procura no rodapé.
   */
  comAceite?: boolean
}

/*
 * `target="_blank"` porque abrir os termos no lugar do checkout apagaria um
 * formulário meio preenchido — e, na confirmação, tiraria a pessoa da página
 * que ela pode precisar consultar de novo.
 */
const CLASSE_LINK =
  'text-ink underline decoration-white/25 underline-offset-2 transition-colors hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent'

function LinkTermos() {
  return (
    <a
      href="/termos"
      target="_blank"
      rel="noopener noreferrer"
      className={CLASSE_LINK}
    >
      Termos de uso
    </a>
  )
}

function LinkPrivacidade() {
  return (
    <a
      href="/privacidade"
      target="_blank"
      rel="noopener noreferrer"
      className={CLASSE_LINK}
    >
      Política de Privacidade
    </a>
  )
}

/**
 * O rodapé de TODAS as páginas de compra: checkout, upsell e confirmação.
 *
 * Existe porque havia dois. O checkout trazia marca, selo de ambiente seguro,
 * contato, termos e CNPJ; a confirmação trazia só "precisa de ajuda" e o CNPJ.
 * Quem passava de uma para a outra via o rodapé encolher no meio da compra — e
 * a página em que mais se procura suporte, a de depois do pagamento, era
 * justamente a mais pobre.
 */
export default function RodapeCheckout({ comAceite = false }: Props) {
  return (
    <footer className="mt-12 border-t border-white/[0.06] pt-6 text-[11px] font-light text-muted/80">
      <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:justify-between sm:text-left">
        <span className="flex items-center gap-2">
          <LogoMark className="h-4 w-4" />
          <span className="text-[10px] font-semibold tracking-[0.3em] text-muted">
            VERTIX
          </span>
        </span>
        <span className="flex items-center gap-1.5">
          <Lock aria-hidden className="h-3 w-3 text-accent" />
          Ambiente seguro · dados criptografados
        </span>
        <span>
          Dúvidas?{' '}
          <a
            href="mailto:contato@vertix.studio"
            className="text-accent underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          >
            contato@vertix.studio
          </a>
        </span>
      </div>

      <p className="mt-5 text-center text-xs leading-relaxed text-muted">
        {comAceite ? (
          <>
            Ao prosseguir, você concorda com os <LinkTermos /> e a{' '}
            <LinkPrivacidade /> da Vertix Studio.
          </>
        ) : (
          <>
            <LinkTermos /> · <LinkPrivacidade />
          </>
        )}
      </p>

      <p className="mt-1.5 text-center text-[11px] text-muted/80">
        Pagamento processado pelo Mercado Pago · Vertix Studio · CNPJ
        54.203.421/0001-49
      </p>
    </footer>
  )
}
