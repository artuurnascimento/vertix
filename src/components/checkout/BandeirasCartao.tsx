/**
 * Bandeiras aceitas, desenhadas como SVG inline e colorido.
 *
 * Inline, e não `<img>`: um checkout não pode depender de arquivo externo
 * carregar para parecer confiável, e a política de segurança da página bloqueia
 * domínio de terceiro. São representações simplificadas — as cores e as formas
 * que fazem a bandeira ser reconhecida de relance —, não os logotipos oficiais.
 */

const CAIXA = 'h-[22px] w-[34px] shrink-0 rounded-[4px]'

function Visa() {
  return (
    <svg viewBox="0 0 34 22" className={CAIXA} aria-hidden focusable="false">
      <rect width="34" height="22" rx="4" fill="#F5F7FB" />
      <text
        x="17"
        y="15.5"
        textAnchor="middle"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontSize="10"
        fontStyle="italic"
        fontWeight="700"
        letterSpacing="0.3"
        fill="#1434CB"
      >
        VISA
      </text>
    </svg>
  )
}

function Mastercard() {
  return (
    <svg viewBox="0 0 34 22" className={CAIXA} aria-hidden focusable="false">
      <rect width="34" height="22" rx="4" fill="#1A1A1A" />
      <circle cx="14" cy="11" r="6.4" fill="#EB001B" />
      <circle cx="20" cy="11" r="6.4" fill="#F79E1B" />
      {/* Interseção dos dois discos: onde o laranja cobre o vermelho, âmbar. */}
      <path d="M17 6.1a6.4 6.4 0 0 0 0 9.8 6.4 6.4 0 0 0 0-9.8Z" fill="#FF5F00" />
    </svg>
  )
}

function Elo() {
  return (
    <svg viewBox="0 0 34 22" className={CAIXA} aria-hidden focusable="false">
      <rect width="34" height="22" rx="4" fill="#000000" />
      <circle cx="10" cy="8" r="2.5" fill="#FFCB05" />
      <circle cx="10" cy="14" r="2.5" fill="#00A4E0" />
      <circle cx="14.6" cy="11" r="2.5" fill="#EF4123" />
      <text
        x="24"
        y="14.6"
        textAnchor="middle"
        fontFamily="Arial, Helvetica, sans-serif"
        fontSize="8.5"
        fontWeight="700"
        fill="#FFFFFF"
      >
        elo
      </text>
    </svg>
  )
}

function Amex() {
  return (
    <svg viewBox="0 0 34 22" className={CAIXA} aria-hidden focusable="false">
      <rect width="34" height="22" rx="4" fill="#006FCF" />
      <text
        x="17"
        y="10.2"
        textAnchor="middle"
        fontFamily="Arial, Helvetica, sans-serif"
        fontSize="5.6"
        fontWeight="700"
        letterSpacing="0.2"
        fill="#FFFFFF"
      >
        AMERICAN
      </text>
      <text
        x="17"
        y="16.4"
        textAnchor="middle"
        fontFamily="Arial, Helvetica, sans-serif"
        fontSize="5.6"
        fontWeight="700"
        letterSpacing="0.2"
        fill="#FFFFFF"
      >
        EXPRESS
      </text>
    </svg>
  )
}

export default function BandeirasCartao() {
  return (
    <span
      // role=img + aria-label: sem o role, o rótulo num <span> nu não é
      // anunciado, e o leitor de tela passaria pelas quatro imagens uma a uma.
      role="img"
      className="flex flex-wrap items-center gap-1.5"
      aria-label="Aceitamos Visa, Mastercard, Elo e American Express"
    >
      <Visa />
      <Mastercard />
      <Elo />
      <Amex />
    </span>
  )
}
