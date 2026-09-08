import { CreditCard, Lock } from 'lucide-react'
import CartaoSecao from './CartaoSecao'
import PagamentoBrick from './PagamentoBrick'
import SeletorMetodo, { type MetodoPagamento } from './MetodoPagamento'

interface Props {
  id: string
  totalCentavos: number
  metodo: MetodoPagamento
  onMetodo: (metodo: MetodoPagamento) => void
  emailInicial: string
  processando: boolean
  erro: string | null
  onSubmit: (formData: unknown, cardTokenSalvar: string | null) => Promise<void>
  onErroCarregamento: (mensagem: string) => void
}

/**
 * Seção de pagamento: escolha do método, formulário do Mercado Pago e o erro
 * da última tentativa. O botão de pagar é o do Brick — ele fecha o formulário
 * logo abaixo do que a pessoa acabou de preencher.
 */
export default function SecaoPagamento({
  id,
  totalCentavos,
  metodo,
  onMetodo,
  emailInicial,
  processando,
  erro,
  onSubmit,
  onErroCarregamento,
}: Props) {
  return (
    <CartaoSecao
      id={id}
      icone={<CreditCard className="h-3.5 w-3.5" />}
      titulo="Pagamento"
      aside={
        <span className="flex items-center gap-1.5 text-xs font-light text-muted/80">
          <Lock aria-hidden className="h-3 w-3" />
          Pagamento processado pelo Mercado Pago
        </span>
      }
    >
      <SeletorMetodo
        metodo={metodo}
        onChange={onMetodo}
        desabilitado={processando}
      />

      {/* .vtx-checkout escopa o desenho do botão do Brick a esta página: a
          PagarPage usa o mesmo container id e não pode ser arrastada junto. */}
      <div className="vtx-checkout">
        <PagamentoBrick
          totalCentavos={totalCentavos}
          metodo={metodo}
          emailInicial={emailInicial}
          processando={processando}
          onSubmit={onSubmit}
          onErroCarregamento={onErroCarregamento}
        />
      </div>

      {erro && (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-red-400/25 bg-red-500/10 px-3 py-2 text-center text-sm text-red-300"
        >
          {erro}
        </p>
      )}

      {/* Aceite dos termos: exigência da LGPD e do Código de Defesa do
          Consumidor — quem compra precisa saber, ANTES de pagar, com quem
          está contratando, quem processa o pagamento e onde ler as regras.
          Fica junto do botão de propósito: aviso de contrato escondido no
          rodapé não cumpre o papel de informar. */}
      <p className="mt-5 text-center text-xs leading-relaxed text-muted">
        Ao prosseguir, você concorda com os{' '}
        <a
          href="/termos"
          target="_blank"
          rel="noopener noreferrer"
          className="text-ink underline decoration-white/25 underline-offset-2 transition-colors hover:text-accent"
        >
          Termos de uso
        </a>{' '}
        e a{' '}
        <a
          href="/privacidade"
          target="_blank"
          rel="noopener noreferrer"
          className="text-ink underline decoration-white/25 underline-offset-2 transition-colors hover:text-accent"
        >
          Política de Privacidade
        </a>{' '}
        da Vertix Studio.
        <span className="mt-1.5 block text-[11px] text-muted/80">
          Pagamento processado pelo Mercado Pago · Vertix Studio · CNPJ
          54.203.421/0001-49
        </span>
      </p>
    </CartaoSecao>
  )
}
