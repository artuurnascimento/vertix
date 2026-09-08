import { BadgeCheck } from 'lucide-react'
import LogoMercadoPago from './LogoMercadoPago'
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
const LOGOS: Record<string, { Logo: typeof LogoMercadoPago; altura: string }> = {
  // Mais alta que o texto dos outros selos de propósito: o wordmark tem duas
  // linhas dentro do próprio desenho, então na altura de uma linha de texto
  // ele vira borrão. Aqui as três caixas continuam do mesmo tamanho — o que
  // cresce é só o conteúdo desta.
  'mercado pago': { Logo: LogoMercadoPago, altura: 'h-7 sm:h-8' },

  // As três grafias que alguém usaria para o mesmo selo. Sem elas, mudar
  // "Dados protegidos" para "LGPD" no painel faria o desenho sumir sem aviso.
  'dados protegidos': { Logo: SeloLgpd, altura: 'h-6 sm:h-7' },
  lgpd: { Logo: SeloLgpd, altura: 'h-6 sm:h-7' },
  'dados protegidos (lgpd)': { Logo: SeloLgpd, altura: 'h-6 sm:h-7' },
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
            className="flex flex-col items-center gap-1.5 rounded-xl border border-white/[0.07] bg-surface-1/70 px-2 py-3 text-center text-[11px] font-light leading-snug text-muted sm:flex-row sm:items-center sm:gap-2.5 sm:px-3.5 sm:text-left sm:text-xs"
          >
            {marca ? (
              // A logo ocupa o selo inteiro, sem o visto ao lado: o logotipo já
              // é o sinal de confiança, e um ícone genérico grudado nele só
              // rouba espaço e enfraquece a marca. O nome continua acessível
              // pelo `aria-label` do próprio SVG.
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
