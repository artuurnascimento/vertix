import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { formatBRL, formatDateBR } from '../../../lib/commercial'
import { pagarPublicUrl } from '../../../lib/publicUrls'
import type { ProposalByToken } from '../proposalData'
import { slideSurface } from './deckData'
import type { DeckSlide, ProposalDeck } from './deckData'
import './deck.css'

/**
 * Renderiza a proposta no formato slide-deck da marca (proposals.apresentacao).
 * O formulário de resposta (aceitar/recusar) vem pronto da página via children
 * e é montado dentro do slide de aprovação; após o aceite, o deck troca para o
 * estado "pós-aceite" com o plano de pagamento vindo de proposta.parcelas.
 */

type Surface = 'violeta' | 'escuro' | 'claro'

const SURFACE_CLASS: Record<Surface, string> = {
  violeta: 's-violet',
  escuro: 's-dark',
  claro: 's-light',
}

/** Variantes dos cards de pasta, rotacionadas por índice conforme a superfície. */
const FOLDER_ROTATION: Record<Surface, string[]> = {
  violeta: ['f-ink', 'f-dark', 'f-ink'],
  escuro: ['f-violet', 'f-ink', 'f-dark'],
  claro: ['f-violet', 'f-dark', 'f-ink'],
}

const FOLDER_GLYPHS = ['✱', '→', '()']

function ArcsGlyph() {
  return (
    <span className="glyph">
      <svg viewBox="0 0 52 44" fill="none" aria-hidden>
        <path d="M18 3 A24 24 0 0 0 18 41" stroke="currentColor" strokeWidth="11" />
        <path d="M34 3 A24 24 0 0 1 34 41" stroke="currentColor" strokeWidth="11" />
      </svg>
    </span>
  )
}

/** Substitui os tokens "✱" e "()" do texto pelos glifos da marca. */
function Glyphs({ text }: { text: string }) {
  const parts = text.split(/(✱|\(\))/)
  // Glifos são SVG/inline-block — o navegador pode quebrar linha ao redor de
  // elementos atômicos mesmo sem espaço. Para o glifo nunca ficar órfão numa
  // linha, ele é embrulhado junto com a PALAVRA SEGUINTE num span nowrap.
  const nodes: ReactNode[] = []
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]
    const isGlyph = part === '✱' || part === '()'
    if (!isGlyph) {
      if (part) nodes.push(<span key={i}>{part}</span>)
      continue
    }
    const glyph =
      part === '✱' ? (
        <span className="glyph-ast">✱</span>
      ) : (
        <ArcsGlyph />
      )
    const next = parts[i + 1]
    if (next && next.startsWith(' ') && next.trim() !== '') {
      const rest = next.slice(1)
      const spaceIdx = rest.indexOf(' ')
      const word = spaceIdx === -1 ? rest : rest.slice(0, spaceIdx)
      const tail = spaceIdx === -1 ? '' : rest.slice(spaceIdx)
      nodes.push(
        <span key={i} style={{ whiteSpace: 'nowrap' }}>
          {glyph}
          {' ' + word}
        </span>
      )
      if (tail) nodes.push(<span key={`${i}t`}>{tail}</span>)
      i++
    } else {
      nodes.push(<span key={i}>{glyph}</span>)
    }
  }
  return <>{nodes}</>
}

/** Logo Vertix para superfícies violeta (traço escuro + interno claro). */
function BrandOnViolet() {
  return (
    <div className="brand">
      <svg viewBox="0 0 132 162" fill="none" aria-hidden>
        <path
          d="M6 132 L66 14 L126 132"
          stroke="#0C0C0C"
          strokeWidth="26"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <path
          d="M34 150 L66 88 L98 150"
          stroke="#F4F4F0"
          strokeWidth="20"
          strokeLinejoin="round"
          strokeLinecap="round"
          opacity="0.9"
        />
      </svg>
      <b>VERTIX</b>
    </div>
  )
}

function LongArrow() {
  return (
    <svg viewBox="0 0 160 24" fill="none" aria-hidden>
      <path
        d="M2 12 H150 M138 3 L152 12 L138 21"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function FlowArrow() {
  return (
    <svg viewBox="0 0 64 24" fill="none" aria-hidden>
      <path
        d="M2 12 H54 M44 4 L56 12 L44 20"
        stroke="#6C5BF2"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function pageNumber(index: number): string {
  return String(index).padStart(2, '0')
}

function Slide({
  surface,
  children,
}: {
  surface: Surface
  children: ReactNode
}) {
  return (
    <section className={`slide ${SURFACE_CLASS[surface]}`}>
      <div className="grain" aria-hidden />
      <motion.div
        className="slide-inner"
        initial={{ opacity: 0, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.12 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      >
        {children}
      </motion.div>
    </section>
  )
}

function Foot({
  left,
  center,
  right,
}: {
  left: string
  center: string
  right: string
}) {
  return (
    <div className="s-foot">
      <span>{left}</span>
      <span>{center}</span>
      <span>{right}</span>
    </div>
  )
}

function FolderCards({
  cards,
  surface,
}: {
  cards: { titulo: string; texto: string; destaque?: string }[]
  surface: Surface
}) {
  const rotation = FOLDER_ROTATION[surface]
  return (
    <div className="folders">
      {cards.map((card, index) => (
        <div key={index} className={`folder ${rotation[index % rotation.length]}`}>
          <span className="f-glyph">{FOLDER_GLYPHS[index % FOLDER_GLYPHS.length]}</span>
          <h3>{card.titulo}</h3>
          <p>{card.texto}</p>
          {card.destaque && <span className="f-big">{card.destaque}</span>}
        </div>
      ))}
    </div>
  )
}

function SlideBody({
  slide,
  surface,
  valorTotal,
}: {
  slide: Exclude<DeckSlide, { tipo: 'capa' }>
  surface: Surface
  valorTotal: number
}) {
  return (
    <>
      <p className="tag">{slide.tag}</p>
      <h2 className="big">
        <Glyphs text={slide.titulo} />
      </h2>
      {slide.intro && <p className="lede">{slide.intro}</p>}

      {slide.tipo === 'texto' && (
        <>
          {slide.paragrafos.map((paragrafo, index) => (
            <p key={index} className="lede">
              {paragrafo}
            </p>
          ))}
          {slide.stat && (
            <div className="mega-stat">
              <p className="v">{slide.stat.valor}</p>
              <p className="l">{slide.stat.legenda}</p>
            </div>
          )}
          {slide.cards && <FolderCards cards={slide.cards} surface={surface} />}
        </>
      )}

      {slide.tipo === 'grafico' && (
        <>
          <div className="chart">
            {slide.barras.map((barra, index) => (
              <div key={index} className="bar-row">
                <span className="bl">{barra.rotulo}</span>
                <div className="bar-track">
                  <div
                    className={`bar-fill ${barra.cor === 'accent' ? 'b-accent' : 'b-dark'}`}
                    style={{ width: `${barra.pct}%` }}
                  />
                </div>
                <span className="bv">{barra.valor}</span>
              </div>
            ))}
            {slide.fonte && <p className="chart-src">{slide.fonte}</p>}
          </div>
          {slide.fluxo && slide.fluxo.length > 0 && (
            <div className="stat-flow">
              {slide.fluxo.map((stat, index) => (
                <div key={index} style={{ display: 'contents' }}>
                  {index > 0 && <FlowArrow />}
                  <div>
                    <p className="sv">{stat.valor}</p>
                    <p className="sl">{stat.legenda}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
          {slide.destaque && <div className="callout">{slide.destaque}</div>}
        </>
      )}

      {slide.tipo === 'cards' && (
        <>
          <FolderCards cards={slide.cards} surface={surface} />
          {slide.rodape && (
            <p className="lede" style={{ marginTop: '2rem' }}>
              {slide.rodape}
            </p>
          )}
        </>
      )}

      {slide.tipo === 'modulos' && (
        <div className="mod-grid">
          {slide.modulos.map((modulo, index) => (
            <div key={index} className="mod">
              <span className="mn">{pageNumber(index + 1)}</span>
              <div>
                <h3>{modulo.titulo}</h3>
                <p>{modulo.texto}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {slide.tipo === 'listas' && (
        <>
          <div className="twocol">
            {slide.colunas.map((coluna, index) => (
              <div key={index}>
                <h3>{coluna.titulo}</h3>
                <ul className="plist">
                  {coluna.itens.map((item, itemIndex) => (
                    <li key={itemIndex}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          {slide.destaque && <div className="callout">{slide.destaque}</div>}
        </>
      )}

      {slide.tipo === 'investimento' && (
        <>
          <div className="inv-total">
            <div>
              {slide.precoDe && <p className="price-old">{slide.precoDe}</p>}
              <p className="v">{formatBRL(valorTotal)}</p>
            </div>
            {slide.notaPreco && <p className="l">{slide.notaPreco}</p>}
          </div>
          {slide.condicoes.length > 0 && (
            <FolderCards cards={slide.condicoes} surface={surface} />
          )}
          {slide.rodape && <p className="fine">{slide.rodape}</p>}
        </>
      )}
    </>
  )
}

type PropostaDeckProps = {
  deck: ProposalDeck
  proposta: ProposalByToken['proposta']
  cliente: ProposalByToken['cliente']
  aceito: boolean
  aceiteNome: string | null
  children?: ReactNode
}

export default function PropostaDeck({
  deck,
  proposta,
  cliente,
  aceito,
  aceiteNome,
  children,
}: PropostaDeckProps) {
  const clienteLabel = deck.clienteLabel ?? cliente.nome
  const codigo = deck.codigo ?? 'Vertix'
  const capa = deck.slides[0]
  const conteudo = deck.slides.filter(
    (slide): slide is Exclude<DeckSlide, { tipo: 'capa' }> => slide.tipo !== 'capa'
  )
  const totalPaginas = conteudo.length + 2

  const dataAceite = proposta.accepted_at
    ? formatDateBR(proposta.accepted_at)
    : formatDateBR(new Date().toISOString())
  const entrada = proposta.entrada
  const aguardandoEntrada = aceito && entrada != null && entrada.status === 'pendente'

  // Aceitou mas ainda não pagou a entrada → checkout. Os próximos passos do
  // projeto só aparecem quando o receivable da entrada estiver pago.
  if (aguardandoEntrada && entrada) {
    const saldo = proposta.valor_total - entrada.valor
    // Checkout imediato: com o payment_token a página /pagar existe desde a
    // criação da parcela — não precisa esperar ninguém clicar em "Gerar link".
    const checkoutHref =
      entrada.payment_link ??
      (entrada.payment_token ? pagarPublicUrl(entrada.payment_token) : null)
    return (
      <div className="vdk min-h-screen bg-bg font-kanit">
        <Slide surface="violeta">
          <div className="s-top">
            <BrandOnViolet />
            <span className="tag">@{new Date().getFullYear()}</span>
          </div>
          <div className="check-badge">
            <motion.svg viewBox="0 0 24 24" fill="none" aria-hidden>
              <motion.path
                d="M4 12.5 9.5 18 20 6.5"
                stroke="#0c0c0c"
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.6, delay: 0.2, ease: 'easeOut' }}
              />
            </motion.svg>
          </div>
          <h1 className="mega" style={{ marginTop: '1.2rem' }}>
            <Glyphs text="Proposta ✱ aprovada" />
          </h1>
          <div className="ok-banner">
            Proposta <strong>{proposta.titulo}</strong> aprovada
            {aceiteNome && (
              <>
                {' '}
                por <strong>{aceiteNome}</strong>
              </>
            )}{' '}
            em {dataAceite}. Agora falta só a entrada para o projeto entrar em
            produção.
          </div>
          <Foot left={`Preparada para ${clienteLabel}`} center={codigo} right="Checkout" />
        </Slide>

        <Slide surface="escuro">
          <p className="tag">01 — Checkout</p>
          <h2 className="big">Pagamento da entrada</h2>
          <div className="inv-total">
            <p className="v">{formatBRL(entrada.valor)}</p>
            <p className="l">
              Entrada de 30% · vencimento {formatDateBR(entrada.vencimento)}. O
              saldo de {formatBRL(saldo)} fica para a entrega.
            </p>
          </div>
          {checkoutHref ? (
            <a
              href={checkoutHref}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-8 inline-block touch-manipulation rounded-lg bg-accent px-7 py-4 text-sm font-semibold text-white shadow-[0_8px_24px_-8px_rgba(108,91,242,0.6)] transition-colors duration-200 hover:bg-accent-2"
            >
              Pagar entrada — Pix ou cartão
            </a>
          ) : (
            <p className="fine">
              Estamos gerando o seu link de pagamento — ele aparece aqui em
              instantes e também chega no seu WhatsApp.
            </p>
          )}
          <p className="fine">
            Assim que o pagamento for confirmado, esta página se atualiza sozinha
            e libera os próximos passos do projeto.
          </p>
          <Foot left="Vertix" center="Aguardando pagamento da entrada" right="01 / 01" />
        </Slide>
      </div>
    )
  }

  if (aceito) {
    return (
      <div className="vdk min-h-screen bg-bg font-kanit">
        <Slide surface="violeta">
          <div className="s-top">
            <BrandOnViolet />
            <span className="tag">@{new Date().getFullYear()}</span>
          </div>
          <div className="check-badge">
            <motion.svg viewBox="0 0 24 24" fill="none" aria-hidden>
              <motion.path
                d="M4 12.5 9.5 18 20 6.5"
                stroke="#0c0c0c"
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.6, delay: 0.2, ease: 'easeOut' }}
              />
            </motion.svg>
          </div>
          <h1 className="mega" style={{ marginTop: '1.2rem' }}>
            <Glyphs text={deck.posAceite.titulo} />
          </h1>
          <div className="ok-banner">
            Proposta <strong>{proposta.titulo}</strong> aprovada
            {aceiteNome && (
              <>
                {' '}
                por <strong>{aceiteNome}</strong>
              </>
            )}{' '}
            em {dataAceite}.{deck.posAceite.banner && ` ${deck.posAceite.banner}`}
          </div>
          <Foot left={`Preparada para ${clienteLabel}`} center={codigo} right="Pagamento" />
        </Slide>

        <Slide surface="escuro">
          <p className="tag">01 — Pagamento</p>
          <h2 className="big">Investimento confirmado</h2>
          <div className="inv-total">
            <div>
              {deck.posAceite.precoDe && (
                <p className="price-old">{deck.posAceite.precoDe}</p>
              )}
              <p className="v">{formatBRL(proposta.valor_total)}</p>
            </div>
            {deck.posAceite.notaPreco && <p className="l">{deck.posAceite.notaPreco}</p>}
          </div>
          {proposta.parcelas && proposta.parcelas.length > 0 && (
            <div className="pay-list">
              {proposta.parcelas.map((parcela, index) => (
                <div key={index} className="pay-item">
                  <span className="idx">{index + 1}ª</span>
                  <div className="info">
                    <h4>{parcela.descricao}</h4>
                    <p>Vencimento: {formatDateBR(parcela.vencimento)}</p>
                  </div>
                  <span className="val">{formatBRL(parcela.valor)}</span>
                </div>
              ))}
            </div>
          )}
          <Foot left="Vertix" center={deck.posAceite.rodape ?? codigo} right="01 / 02" />
        </Slide>

        <Slide surface="claro">
          <p className="tag">02 — Próximos passos</p>
          <h2 className="big">O que acontece agora →</h2>
          <div className="mod-grid">
            {deck.posAceite.passos.map((passo, index) => (
              <div key={index} className="mod">
                <span className="mn">{pageNumber(index + 1)}</span>
                <div>
                  <h3>{passo.titulo}</h3>
                  <p>{passo.texto}</p>
                </div>
              </div>
            ))}
          </div>
          <Foot left="Vertix" center={`${codigo} · Documento confidencial`} right="02 / 02" />
        </Slide>
      </div>
    )
  }

  return (
    <div className="vdk min-h-screen bg-bg font-kanit">
      {capa.tipo === 'capa' && (
        <Slide surface="violeta">
          <div className="s-top">
            <BrandOnViolet />
            <span className="tag">@{new Date().getFullYear()}</span>
          </div>
          <h1 className="mega">
            <Glyphs text={capa.titulo} />
          </h1>
          <div className="arrow-line">
            <LongArrow />
            <p>{capa.subtitulo}</p>
          </div>
          <Foot
            left={`Preparada para ${clienteLabel}`}
            center={codigo}
            right={proposta.sent_at ? formatDateBR(proposta.sent_at) : ''}
          />
        </Slide>
      )}

      {conteudo.map((slide, index) => {
        const surface = slideSurface(slide)
        return (
          <Slide key={index} surface={surface}>
            <SlideBody slide={slide} surface={surface} valorTotal={proposta.valor_total} />
            <Foot
              left="Vertix"
              center={codigo}
              right={`${pageNumber(index + 2)} / ${pageNumber(totalPaginas)}`}
            />
          </Slide>
        )
      })}

      <Slide surface="escuro">
        <p className="tag">{deck.aprovacao.tag}</p>
        <h2 className="big">
          <Glyphs text={deck.aprovacao.titulo} />
        </h2>
        <p className="lede">{deck.aprovacao.texto}</p>
        {children}
        <Foot
          left="Vertix"
          center={`${codigo} · Documento confidencial`}
          right={`${pageNumber(totalPaginas)} / ${pageNumber(totalPaginas)}`}
        />
      </Slide>
    </div>
  )
}
