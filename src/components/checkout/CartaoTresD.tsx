import type { CSSProperties, ReactNode } from 'react'
import './cartao3d.css'

/**
 * Cartão 3D do checkout — decoração, não espelho.
 *
 * O número, a validade e o CVV são digitados DENTRO de iframes do Mercado
 * Pago e nenhum evento do SDK devolve o que foi digitado: `focus`, `blur`,
 * `change` e `paste` carregam só `{ field }`. O único dígito que sai de lá é
 * o BIN, e só depois que o número inteiro fica válido.
 *
 * Por isso este cartão NÃO preenche bullets conforme a pessoa digita. Um
 * cartão que mostra 3 dígitos enquanto oito foram digitados mente, e mentir
 * sobre o número do cartão na hora do pagamento é pior do que não animar.
 * O que ele faz é orientar (mostra em qual campo o foco está, gira para o
 * verso quando o CVV é lá) e dar confiança (bandeira reconhecida, nome
 * escrito ao vivo, estado por campo).
 *
 * `aria-hidden` no elemento inteiro: quem narra erro, validade e progresso é
 * o formulário, em `role="alert"` / `aria-live`. Um leitor de tela não pode
 * depender de um cartão que gira.
 */

/** Os quatro campos que o cartão consegue destacar. */
export type CampoCartao = 'numero' | 'validade' | 'cvv' | 'titular'

/** Estado visual por campo, derivado do `validityChange` do SDK. */
export type EstadoCampo = 'neutro' | 'valido' | 'erro'

export interface Props {
  /** Nome digitado no input NOSSO. Chega a cada tecla. */
  titular: string
  /**
   * BIN vindo do evento `binChange` (6 ou 8 dígitos, conforme a bandeira).
   * `null` enquanto o número não é válido. São os únicos dígitos reais que
   * temos — e os únicos que o cartão mostra.
   */
  bin: string | null
  /** `payment_method_id` do Mercado Pago: 'visa', 'master', 'elo', 'amex'… */
  bandeira: string | null
  /** Campo com o foco agora, ou `null` quando o foco está fora do bloco. */
  focado: CampoCartao | null
  /** Estado de cada campo. Campos omitidos ficam neutros. */
  estados?: Partial<Record<CampoCartao, EstadoCampo>>
  /**
   * `false` quando `settings[0].security_code.card_location === 'front'`
   * (Amex). Nesse caso o cartão NÃO gira ao focar o CVV — o código está
   * impresso na frente, e girar mandaria a pessoa procurar no lugar errado.
   */
  cvvNoVerso?: boolean
  /** Comprimento do CVV: 3 na maioria, 4 no Amex. */
  digitosCvv?: 3 | 4
  className?: string
}

/** Onde o brilho para, por campo, em fração do cartão. */
const ANCORAS: Record<CampoCartao, readonly [string, string]> = {
  numero: ['28%', '58%'],
  titular: ['26%', '86%'],
  validade: ['74%', '86%'],
  cvv: ['82%', '30%'],
}

const ANCORA_REPOUSO: readonly [string, string] = ['50%', '52%']

/** Posição do brilho no verso: em cima da caixa do CVV. */
const ANCORA_VERSO: readonly [string, string] = ['78%', '48%']

/** Agrupamento impresso do número. Amex é 4-6-5; o resto, 4-4-4-4. */
function gruposDoNumero(bandeira: string | null): readonly number[] {
  return bandeira === 'amex' ? [4, 6, 5] : [4, 4, 4, 4]
}

/** Aceita `--var` além das propriedades CSS conhecidas. */
type EstiloComVars = CSSProperties & Record<`--${string}`, string>

function classes(...partes: (string | false | null | undefined)[]): string {
  return partes.filter(Boolean).join(' ')
}

export default function CartaoTresD({
  titular,
  bin,
  bandeira,
  focado,
  estados,
  cvvNoVerso = true,
  digitosCvv = 3,
  className,
}: Props) {
  // A regra que separa este componente de uma cópia: no Amex o código fica
  // impresso na frente, então o foco no CVV não vira o cartão.
  const virado = focado === 'cvv' && cvvNoVerso

  const ancora = focado ? ANCORAS[focado] : ANCORA_REPOUSO
  const brilhoFrente: EstiloComVars = {
    '--vtx-c3d-glow-x': ancora[0],
    '--vtx-c3d-glow-y': ancora[1],
  }
  const brilhoVerso: EstiloComVars = {
    '--vtx-c3d-glow-x': ANCORA_VERSO[0],
    '--vtx-c3d-glow-y': ANCORA_VERSO[1],
  }

  const nome = titular.trim()

  return (
    <div
      // Decoração: o estado real vive no formulário, anunciado por ele.
      aria-hidden="true"
      className={classes('vtx-c3d', virado && 'vtx-c3d--virado', focado && 'vtx-c3d--focado', className)}
    >
      <div className="vtx-c3d-interno">
        {/* ---------------- frente ---------------- */}
        <div className="vtx-c3d-face vtx-c3d-face--frente">
          <span className="vtx-c3d-fundo" />
          <span className="vtx-c3d-holo" />
          <span className="vtx-c3d-brilho" style={brilhoFrente}>
            <span className="vtx-c3d-brilho-nucleo" />
          </span>

          <div className="vtx-c3d-conteudo">
            <div className="vtx-c3d-topo">
              <span className="vtx-c3d-chip-linha">
                <Chip />
                <Ondas />
              </span>
              <Marca bandeira={bandeira} />
            </div>

            <Numero bin={bin} bandeira={bandeira} estado={estadoDe(estados, 'numero')} />

            <div className="vtx-c3d-rodape">
              <Campo
                variante="titular"
                rotulo="Titular"
                estado={estadoDe(estados, 'titular')}
                valor={nome}
                vazio="Nome como está no cartão"
              />
              <Campo
                variante="validade"
                rotulo="Validade"
                estado={estadoDe(estados, 'validade')}
                // A validade nunca sai do iframe. A marca d'água mostra o
                // formato esperado; a cor e o selo mostram o estado.
                valor=""
                vazio="MM/AA"
              />
              {!cvvNoVerso && (
                <Campo
                  variante="cvv"
                  rotulo="Cód."
                  estado={estadoDe(estados, 'cvv')}
                  valor=""
                  vazio={'•'.repeat(digitosCvv)}
                />
              )}
            </div>
          </div>
        </div>

        {/* ---------------- verso ---------------- */}
        <div className="vtx-c3d-face vtx-c3d-face--verso">
          <span className="vtx-c3d-fundo" />
          <span className="vtx-c3d-holo" />
          <span className="vtx-c3d-brilho" style={brilhoVerso}>
            <span className="vtx-c3d-brilho-nucleo" />
          </span>

          <div className="vtx-c3d-verso-conteudo">
            <div className="vtx-c3d-tarja" />

            <div className="vtx-c3d-assinatura">
              <div className="vtx-c3d-assinatura-faixa" />
              <div
                className={classes(
                  'vtx-c3d-caixa-cvv',
                  estadoDe(estados, 'cvv') === 'erro' && 'vtx-c3d-caixa-cvv--erro',
                  estadoDe(estados, 'cvv') === 'valido' && 'vtx-c3d-caixa-cvv--ok',
                )}
              >
                {'•'.repeat(digitosCvv)}
              </div>
            </div>

            <div className="vtx-c3d-verso-rodape">
              <p className="vtx-c3d-verso-nota">
                Os dados do cartão são digitados direto no Mercado Pago. A Vertix não
                recebe nem armazena o número.
              </p>
              <Marca bandeira={bandeira} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function estadoDe(
  estados: Props['estados'],
  campo: CampoCartao,
): EstadoCampo {
  return estados?.[campo] ?? 'neutro'
}

/* ------------------------------------------------------------------ */
/* Número                                                              */
/* ------------------------------------------------------------------ */

function Numero({
  bin,
  bandeira,
  estado,
}: {
  bin: string | null
  bandeira: string | null
  estado: EstadoCampo
}) {
  const grupos = gruposDoNumero(bandeira)
  const total = grupos.reduce((soma, tamanho) => soma + tamanho, 0)
  const digitos = (bin ?? '').replace(/\D/g, '').slice(0, total)

  // Deslocamento de cada grupo dentro do número, sem contador mutável: o
  // índice global é o que dá o atraso escalonado da revelação.
  const inicios = grupos.map((_, indice) =>
    grupos.slice(0, indice).reduce((soma, tamanho) => soma + tamanho, 0),
  )

  return (
    <div
      className={classes(
        'vtx-c3d-numero-bloco',
        estado === 'erro' && 'vtx-c3d-numero-bloco--erro',
      )}
    >
      {/* key pelo BIN: quando ele chega, os spans remontam e a animação de
          revelação roda de novo. Sem isso a troca de cartão não anima. */}
      <div className="vtx-c3d-numero" key={digitos || 'sem-bin'}>
        {grupos.map((tamanho, indiceGrupo) => (
          <span className="vtx-c3d-grupo" key={indiceGrupo}>
            {Array.from({ length: tamanho }, (_, dentroDoGrupo) => {
              const indice = inicios[indiceGrupo] + dentroDoGrupo
              const revelado = indice < digitos.length
              const estilo: EstiloComVars = { '--vtx-c3d-i': String(indice) }
              return (
                <span
                  key={indice}
                  style={revelado ? estilo : undefined}
                  className={classes(
                    'vtx-c3d-digito',
                    revelado && 'vtx-c3d-digito--revelado',
                  )}
                >
                  {revelado ? digitos[indice] : '•'}
                </span>
              )
            })}
          </span>
        ))}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Campo do rodapé                                                     */
/* ------------------------------------------------------------------ */

function Campo({
  variante,
  rotulo,
  estado,
  valor,
  vazio,
}: {
  variante: 'titular' | 'validade' | 'cvv'
  rotulo: string
  estado: EstadoCampo
  valor: string
  vazio: string
}) {
  return (
    <div
      className={classes(
        'vtx-c3d-campo',
        `vtx-c3d-campo--${variante}`,
        estado === 'erro' && 'vtx-c3d-campo--erro',
      )}
    >
      <span className="vtx-c3d-rotulo">
        {rotulo}
        {estado === 'valido' && <IconeCheck />}
        {estado === 'erro' && <IconeAlerta />}
      </span>
      <div className={classes('vtx-c3d-valor', !valor && 'vtx-c3d-valor--vazio')}>
        {valor || vazio}
      </div>
    </div>
  )
}

function IconeCheck() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="vtx-c3d-selo vtx-c3d-selo--ok"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
    >
      <path d="M3 8.6l3.4 3.4L13 4.6" />
    </svg>
  )
}

function IconeAlerta() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="vtx-c3d-selo vtx-c3d-selo--erro"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      aria-hidden
      focusable="false"
    >
      <path d="M8 3.4v5.2" />
      <path d="M8 12.2h.01" />
    </svg>
  )
}

/* ------------------------------------------------------------------ */
/* Chip, contactless e bandeiras                                       */
/* ------------------------------------------------------------------ */

function Chip() {
  return (
    <svg viewBox="0 0 40 30" className="vtx-c3d-chip" aria-hidden focusable="false">
      <defs>
        <linearGradient id="vtx-c3d-ouro" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f3dfa8" />
          <stop offset="42%" stopColor="#c8a558" />
          <stop offset="100%" stopColor="#8d6f33" />
        </linearGradient>
      </defs>
      <rect width="40" height="30" rx="5" fill="url(#vtx-c3d-ouro)" />
      <g stroke="rgba(60,44,12,0.55)" strokeWidth="1.1" fill="none">
        <path d="M0 10h13M27 10h13M0 20h13M27 20h13" />
        <rect x="13" y="5.5" width="14" height="19" rx="3" />
        <path d="M20 5.5v19" />
      </g>
    </svg>
  )
}

function Ondas() {
  return (
    <svg
      viewBox="0 0 20 24"
      className="vtx-c3d-ondas"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      aria-hidden
      focusable="false"
    >
      <path d="M4 8.2a7.5 7.5 0 0 1 0 7.6" />
      <path d="M9 5.4a13 13 0 0 1 0 13.2" />
      <path d="M14 2.6a18.5 18.5 0 0 1 0 18.8" />
    </svg>
  )
}

/**
 * Logo da bandeira, desenhado inline.
 *
 * Não usa `secure_thumbnail` do Mercado Pago pela mesma razão de
 * `BandeirasCartao.tsx`: um checkout não pode depender de um arquivo de
 * terceiro carregar para parecer confiável. São marcas simplificadas — o
 * suficiente para reconhecer de relance —, não os logotipos oficiais.
 */
function Marca({ bandeira }: { bandeira: string | null }) {
  return (
    // key pela bandeira: troca de cartão remonta o span e a animação de
    // entrada roda de novo. Sem isso, Visa→Amex trocaria o SVG sem transição.
    <span
      key={bandeira ?? 'sem-bandeira'}
      className={classes('vtx-c3d-marca', bandeira && 'vtx-c3d-marca-entra')}
    >
      {desenhoDaBandeira(bandeira)}
    </span>
  )
}

function desenhoDaBandeira(bandeira: string | null): ReactNode {
  switch (bandeira) {
    case 'visa':
      return <MarcaVisa />
    case 'master':
    case 'mastercard':
      return <MarcaMastercard />
    case 'elo':
      return <MarcaElo />
    case 'amex':
      return <MarcaAmex />
    default:
      return <MarcaGenerica />
  }
}

function MarcaVisa() {
  return (
    <svg viewBox="0 0 60 20" className="vtx-c3d-logo--visa" aria-hidden focusable="false">
      <text
        x="60"
        y="16"
        textAnchor="end"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontSize="18"
        fontStyle="italic"
        fontWeight="700"
        letterSpacing="0.5"
        fill="#f4f4f0"
      >
        VISA
      </text>
    </svg>
  )
}

function MarcaMastercard() {
  return (
    <svg viewBox="0 0 44 26" className="vtx-c3d-logo--master" aria-hidden focusable="false">
      <circle cx="17" cy="13" r="11" fill="#eb001b" />
      <circle cx="27" cy="13" r="11" fill="#f79e1b" opacity="0.95" />
      {/* Interseção dos discos, onde o laranja cobre o vermelho. */}
      <path d="M22 4.6a11 11 0 0 0 0 16.8 11 11 0 0 0 0-16.8Z" fill="#ff5f00" />
    </svg>
  )
}

function MarcaElo() {
  return (
    <svg viewBox="0 0 56 22" className="vtx-c3d-logo--elo" aria-hidden focusable="false">
      <circle cx="8" cy="7" r="4.4" fill="#ffcb05" />
      <circle cx="8" cy="15" r="4.4" fill="#00a4e0" />
      <circle cx="15.4" cy="11" r="4.4" fill="#ef4123" />
      <text
        x="56"
        y="17"
        textAnchor="end"
        fontFamily="Arial, Helvetica, sans-serif"
        fontSize="15"
        fontWeight="700"
        fill="#f4f4f0"
      >
        elo
      </text>
    </svg>
  )
}

function MarcaAmex() {
  return (
    <svg viewBox="0 0 62 24" className="vtx-c3d-logo--amex" aria-hidden focusable="false">
      <rect width="62" height="24" rx="3" fill="#006fcf" />
      <text
        x="31"
        y="11"
        textAnchor="middle"
        fontFamily="Arial, Helvetica, sans-serif"
        fontSize="6.2"
        fontWeight="700"
        letterSpacing="0.3"
        fill="#ffffff"
      >
        AMERICAN
      </text>
      <text
        x="31"
        y="19"
        textAnchor="middle"
        fontFamily="Arial, Helvetica, sans-serif"
        fontSize="6.2"
        fontWeight="700"
        letterSpacing="0.3"
        fill="#ffffff"
      >
        EXPRESS
      </text>
    </svg>
  )
}

/**
 * Sem bandeira ainda (ou bandeira que não desenhamos): duas lâminas neutras,
 * no lugar exato onde o logo vai aparecer. Reservar o espaço evita o pulo de
 * layout quando o BIN chega.
 */
function MarcaGenerica() {
  return (
    <svg viewBox="0 0 44 20" className="vtx-c3d-logo--generica" aria-hidden focusable="false">
      <rect x="6" y="5" width="14" height="10" rx="5" fill="rgba(244,244,240,0.1)" />
      <rect x="22" y="5" width="14" height="10" rx="5" fill="rgba(244,244,240,0.055)" />
    </svg>
  )
}
