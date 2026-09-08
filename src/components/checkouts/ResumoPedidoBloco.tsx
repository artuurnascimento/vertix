import { Bloco } from '../produtos/formUi'

interface Props {
  /** true = o bloco "Seu pedido" nasce aberto na página pública. */
  aberto: boolean
  onChange: (valor: boolean) => void
}

interface Opcao {
  valor: boolean
  rotulo: string
  explicacao: string
}

/**
 * Duas opções em rádio, e não um interruptor. O interruptor mostraria só o
 * estado atual; aqui as duas consequências ficam escritas lado a lado, que é o
 * que faz alguém escolher em vez de aceitar o que veio.
 */
const OPCOES: readonly Opcao[] = [
  {
    valor: false,
    rotulo: 'Recolhido (recomendado)',
    explicacao:
      'Mostra só o nome do produto, o total e os descontos que pegaram. Quem quiser conferir o resto toca em "Ver detalhes".',
  },
  {
    valor: true,
    rotulo: 'Aberto',
    explicacao:
      'Já mostra descrição, valores, benefícios e o selo de compra segura. Vale para oferta cara ou com muita coisa inclusa, que ainda está sendo vendida na hora de pagar.',
  },
]

/**
 * Padrão do bloco "Seu pedido" na página pública.
 *
 * O motivo do recomendado está na tela, não só aqui: no CELULAR, aberto, esse
 * bloco ocupa quase uma tela inteira e empurra o formulário de pagamento para
 * baixo da dobra. Quem já decidiu comprar não precisa reler a oferta — precisa
 * achar o botão.
 *
 * Vale para as duas larguras. Até esta configuração existir, o resumo nascia
 * aberto no desktop por uma regra de largura de tela escondida no componente.
 */
export default function ResumoPedidoBloco({ aberto, onChange }: Props) {
  return (
    <Bloco
      titulo="Resumo do pedido"
      ajuda="Como o bloco “Seu pedido” aparece quando a página abre. Seja qual for o padrão, o cliente pode abrir e fechar quando quiser."
    >
      <fieldset className="flex flex-col gap-3">
        <legend className="sr-only">Estado inicial do resumo do pedido</legend>
        {OPCOES.map((opcao) => (
          <label
            key={String(opcao.valor)}
            className={[
              'flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 transition-colors duration-200',
              aberto === opcao.valor
                ? 'border-accent/50 bg-accent/[0.07]'
                : 'border-white/5 bg-surface-2 hover:border-white/10',
            ].join(' ')}
          >
            <input
              type="radio"
              name="resumo-aberto"
              checked={aberto === opcao.valor}
              onChange={() => onChange(opcao.valor)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-[#6C5BF2]"
            />
            <span className="min-w-0">
              <span className="block text-sm text-ink">{opcao.rotulo}</span>
              <span className="mt-0.5 block text-xs font-light leading-relaxed text-muted">
                {opcao.explicacao}
              </span>
            </span>
          </label>
        ))}
      </fieldset>

      <p className="text-xs font-light leading-relaxed text-muted">
        No celular o recolhido costuma vender mais: aberto, o resumo ocupa quase
        a tela inteira e empurra o formulário de pagamento para baixo da dobra.
      </p>
    </Bloco>
  )
}
