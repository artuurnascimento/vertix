interface Props {
  className?: string
}

/**
 * Entrega em 24h: caminhão com rastro de velocidade e a seta de ciclo em volta
 * do "24h".
 *
 * Desenhado aqui, no vocabulário dos outros selos (traço em `currentColor`,
 * sem cor fixa), em vez de vetorizar a arte de referência — que é preta sobre
 * branco e sumiria no fundo escuro do checkout.
 *
 * O arco não fecha de propósito: círculo completo lê como "carregando", e é a
 * abertura terminando em seta que dá o sentido de prazo que se cumpre.
 */
export default function SeloEntrega24h({ className = '' }: Props) {
  return (
    <svg
      viewBox="0 0 60 44"
      className={className}
      role="img"
      aria-label="Entrega em 24 horas"
      focusable="false"
    >
      {/* Arco em volta do 24h. Centro em (32,20), raio 14: começa às 8h e vai
          no sentido horário até quase as 5h, deixando a abertura embaixo à
          direita, onde a seta entra. */}
      <path
        d="M22.1 30A14 14 0 1 1 41 30.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
      {/* Ponta da seta no fim do arco, apontando para baixo. */}
      <path d="M36.5 30.5h9l-4.5 7.8-4.5-7.8Z" fill="currentColor" />

      {/* Menor que antes e mais alto: em 15px o texto encostava no arco, e um
          selo em que o desenho briga com o número não se lê a 32px de altura. */}
      <text
        x="32"
        y="24.5"
        textAnchor="middle"
        fill="currentColor"
        fontSize="12.5"
        fontWeight="700"
        fontFamily="inherit"
      >
        24h
      </text>

      {/* Rastro de velocidade — o que faz o caminhão parecer em movimento */}
      <g stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
        <path d="M1.5 31h6.5" />
        <path d="M0.5 35.5h8" />
        <path d="M2.5 40h6" />
      </g>

      {/* Baú, cabine e rodas. O caminhão passa NA FRENTE do arco, e é essa
          sobreposição que amarra os dois desenhos em uma cena só. */}
      <path
        d="M11.5 28.5h13.8v12H11.5a1.5 1.5 0 0 1-1.5-1.5V30a1.5 1.5 0 0 1 1.5-1.5Z"
        fill="currentColor"
      />
      <path
        d="M25.3 32h4.6l3.3 4v4.5h-7.9V32Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <circle cx="16.5" cy="40.3" r="2.9" fill="currentColor" />
      <circle cx="29.3" cy="40.3" r="2.9" fill="currentColor" />
    </svg>
  )
}
