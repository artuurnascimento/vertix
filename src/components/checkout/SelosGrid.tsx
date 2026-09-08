import { BadgeCheck } from 'lucide-react'
import LogoMercadoPago from './LogoMercadoPago'
import SeloEntrega24h from './SeloEntrega24h'
import SeloLgpd from './SeloLgpd'

/**
 * Selos que valem mais como MARCA do que como frase.
 *
 * "Mercado Pago" escrito em texto cinza não diz nada a quem bate o olho; o
 * logotipo é reconhecido antes de ser lido, e é esse reconhecimento que
 * sustenta a confiança na hora de digitar o cartão.
 *
 * O casamento é pelo texto do selo, normalizado, porque o lojista digita esse
 * campo livremente no painel — não existe "tipo de selo" no banco. Quem
 * escrever qualquer outra coisa continua vendo o texto com o visto ao lado.
 */
/*
 * As alturas são MAIORES no celular, e isso é o contrário do reflexo.
 *
 * Em 390px cada caixa tem cerca de 110px de largura, e um desenho de 28px de
 * altura dentro dela lê como enfeite — some. No desktop a fileira tem espaço
 * de sobra e não precisa gritar. Por isso o `sm:` aqui ENCOLHE em vez de
 * crescer: o celular é onde o selo precisa se defender.
 *
 * Cada marca tem sua própria altura porque as proporções são diferentes: o
 * wordmark do Mercado Pago tem duas linhas dentro do desenho, o caminhão tem o
 * arco por cima. Uma altura só deixaria uns gigantes e outros ilegíveis.
 */
const LOGOS: Record<string, { Logo: typeof LogoMercadoPago; altura: string }> = {
  'mercado pago': { Logo: LogoMercadoPago, altura: 'h-9 sm:h-8' },

  // As grafias que alguém usaria para o mesmo selo. Sem elas, trocar
  // "Dados protegidos" por "LGPD" no painel faria o desenho sumir sem aviso.
  'dados protegidos': { Logo: SeloLgpd, altura: 'h-8 sm:h-7' },
  lgpd: { Logo: SeloLgpd, altura: 'h-8 sm:h-7' },
  'dados protegidos (lgpd)': { Logo: SeloLgpd, altura: 'h-8 sm:h-7' },

  'entrega em 24h': { Logo: SeloEntrega24h, altura: 'h-10 sm:h-9' },
  'entrega 24h': { Logo: SeloEntrega24h, altura: 'h-10 sm:h-9' },
  'entrega em 24 horas': { Logo: SeloEntrega24h, altura: 'h-10 sm:h-9' },
}

/** "Mercado  Pago " e "MERCADO PAGO" precisam cair na mesma chave. */
function chaveDoSelo(selo: string): string {
  return selo.trim().toLowerCase().replace(/\s+/g, ' ')
}

/**
 * Fileira de selos configurados — no máximo três por linha, como no desenho.
 * Sem selos sobrando (o resumo serve primeiro), a fileira some.
 */
export default function SelosGrid({ selos }: { selos: string[] }) {
  if (selos.length === 0) return null

  return (
    <ul
      aria-label="Selos"
      // Três colunas desde o celular: em duas, um selo ímpar sobrava sozinho
      // na linha de baixo e a fileira parecia quebrada. Cabem lado a lado
      // porque no estreito o ícone sobe para cima do texto, em vez de
      // disputar a largura com ele.
      className="grid grid-cols-3 gap-2 sm:gap-2.5"
    >
      {selos.map((selo, indice) => {
        const marca = LOGOS[chaveDoSelo(selo)]

        return (
          <li
            key={`${selo}-${indice}`}
            className={[
              'flex min-h-[64px] items-center rounded-xl border border-white/[0.07] bg-surface-1/70 px-2 text-[11px] font-light leading-snug text-muted sm:min-h-[56px] sm:px-3.5 sm:text-xs',
              // Marca fica SEMPRE centrada, nos dois tamanhos: sem texto ao
              // lado, alinhar à esquerda deixaria as três caixas com pesos
              // visuais diferentes conforme a largura de cada desenho.
              // Selo de texto mantém o arranjo de antes — ícone acima no
              // estreito, ícone ao lado quando há espaço.
              marca
                ? 'justify-center'
                : 'flex-col justify-center gap-1.5 py-3 text-center sm:flex-row sm:gap-2.5 sm:text-left',
            ].join(' ')}
          >
            {marca ? (
              // A marca ocupa o selo inteiro, sem o visto ao lado: o desenho já
              // é o sinal de confiança, e um ícone genérico grudado nele rouba
              // espaço e enfraquece a leitura. O nome continua acessível pelo
              // `aria-label` do próprio SVG.
              <marca.Logo className={`${marca.altura} w-auto text-ink/90`} />
            ) : (
              <>
                <BadgeCheck aria-hidden className="h-4 w-4 shrink-0 text-accent" />
                {selo}
              </>
            )}
          </li>
        )
      })}
    </ul>
  )
}
