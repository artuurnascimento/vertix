interface Props {
  className?: string
  /** Altura do símbolo em px — o lockup inteiro escala junto. */
  symbolSize?: number
}

/**
 * Lockup "VERTIX | CHECKOUT", na mesma construção do "VERTIX | SCAN" do
 * Vertix Scan: símbolo ∧ duplo com gradiente, wordmark VERTIX em peso forte,
 * divisor fino em accent e a palavra do produto leve e bem espaçada.
 *
 * Recriado aqui em vez de importado do Scan porque são repositórios
 * diferentes; os ids do gradiente levam prefixo `vxc-` para não colidirem
 * caso os dois lockups apareçam algum dia na mesma página.
 */
export default function VertixCheckoutLogo({ className = '', symbolSize = 46 }: Props) {
  return (
    <span
      className={`inline-flex items-center gap-3 ${className}`}
      role="img"
      aria-label="Vertix Checkout"
    >
      <svg
        viewBox="0 0 132 162"
        // Os caps arredondados excedem o viewBox: sem isso as pontas clipam.
        style={{ height: symbolSize, overflow: 'visible' }}
        fill="none"
        aria-hidden="true"
      >
        <defs>
          <linearGradient
            id="vxc-outer"
            x1="66"
            y1="14"
            x2="66"
            y2="132"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0" stopColor="#B9AFFB" />
            <stop offset="0.55" stopColor="#6C5BF2" />
            <stop offset="1" stopColor="#4936C9" />
          </linearGradient>
          <linearGradient
            id="vxc-inner"
            x1="66"
            y1="88"
            x2="66"
            y2="150"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0" stopColor="#FFFFFF" />
            <stop offset="1" stopColor="#C7C0F4" />
          </linearGradient>
        </defs>

        {/* ∧ externo — indigo */}
        <path
          d="M6 132 L66 14 L126 132"
          stroke="url(#vxc-outer)"
          strokeWidth="26"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {/* ∧ interno — claro */}
        <path
          d="M34 150 L66 88 L98 150"
          stroke="url(#vxc-inner)"
          strokeWidth="20"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>

      <span className="inline-flex items-center" style={{ gap: symbolSize * 0.32 }}>
        <span
          className="font-kanit font-bold uppercase text-ink"
          style={{ fontSize: symbolSize * 0.62, letterSpacing: '0.08em' }}
        >
          VERTIX
        </span>
        <span
          aria-hidden="true"
          className="bg-accent/70"
          style={{ width: 1.5, height: symbolSize * 0.58 }}
        />
        <span
          className="font-kanit font-light uppercase text-ink"
          style={{
            fontSize: symbolSize * 0.44,
            letterSpacing: '0.42em',
            // Compensa o espaço que o letter-spacing acrescenta depois da
            // última letra, para o lockup não parecer deslocado à esquerda.
            textIndent: '0.1em',
          }}
        >
          Checkout
        </span>
      </span>
    </span>
  )
}
