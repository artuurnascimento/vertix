interface Props {
  className?: string
}

/**
 * Selo de conformidade com a LGPD: escudo, cadeado e a sigla.
 *
 * DESENHADO AQUI, não copiado. A LGPD é uma lei e não tem logotipo oficial —
 * as artes que circulam por aí são criação de terceiros, e reproduzir uma
 * delas seria usar trabalho de outra pessoa. Também não caberia: as versões
 * comuns são claras e com verde, e destoariam do checkout escuro.
 *
 * Tudo em `currentColor`, para o selo acompanhar o texto ao redor em vez de
 * fixar uma cor que só funciona num fundo.
 *
 * O texto é `<text>`, não caminhos de letra: quatro letras vetorizadas
 * pesariam mais que o desenho inteiro e ficariam presas a um único peso de
 * fonte.
 */
export default function SeloLgpd({ className = '' }: Props) {
  return (
    <svg
      viewBox="0 0 128 40"
      className={className}
      role="img"
      aria-label="Em conformidade com a LGPD"
      focusable="false"
    >
      {/* Escudo */}
      <path
        d="M20 3.5 6.5 8.4v11.3c0 8.2 5.4 15.4 13.5 17.8 8.1-2.4 13.5-9.6 13.5-17.8V8.4L20 3.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinejoin="round"
        opacity="0.85"
      />

      {/* Cadeado — arco e corpo */}
      <path
        d="M15.9 18.4v-3.2a4.1 4.1 0 0 1 8.2 0v3.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <rect
        x="13.6"
        y="18.4"
        width="12.8"
        height="10"
        rx="2.2"
        fill="currentColor"
      />

      <text
        x="41"
        y="27.6"
        fill="currentColor"
        fontSize="20"
        fontWeight="700"
        letterSpacing="0.4"
        fontFamily="inherit"
      >
        LGPD
      </text>
    </svg>
  )
}
