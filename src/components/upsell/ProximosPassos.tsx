import { ExternalLink, Inbox, Mail } from 'lucide-react'

/**
 * "E agora?" — o que a pessoa precisa saber para não voltar em 10 minutos
 * achando que deu errado: qual e-mail chega, em quanto tempo, e onde procurar
 * se ele não aparecer (spam/promoções é o destino mais provável).
 *
 * Sem nenhuma oferta: esta é a página de fechamento.
 */
export function ProximosPassos({
  email,
  linkPlano,
}: {
  /** E-mail do comprador, quando conhecido — deixa o texto concreto. */
  email: string | null
  /** Página do Plano de Correção do Scan; null para os demais produtos. */
  linkPlano: string | null
}) {
  return (
    <section
      aria-label="Próximos passos"
      className="mt-5 rounded-2xl border border-white/5 bg-surface-1 p-5 sm:p-6"
    >
      <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted">
        O que acontece agora
      </h2>

      <ul className="mt-4 flex flex-col gap-4 text-sm font-light leading-relaxed text-muted">
        <li className="flex items-start gap-3">
          <Mail aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
          <span>
            Em até 5 minutos chega o e-mail de confirmação
            {email ? (
              <>
                {' '}
                em <span className="font-medium text-ink">{email}</span>
              </>
            ) : (
              ' no endereço que você informou'
            )}
            , com o recibo e o acesso ao que você comprou.
          </span>
        </li>
        <li className="flex items-start gap-3">
          <Inbox aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
          <span>
            Não apareceu? Procure por{' '}
            <span className="font-medium text-ink">Vertix</span> no spam e na
            aba Promoções — é para lá que ele costuma cair. Continuando sem
            achar, responda para{' '}
            <a
              href="mailto:contato@vertix.studio"
              className="rounded text-accent underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              contato@vertix.studio
            </a>{' '}
            que resolvemos no mesmo dia.
          </span>
        </li>
      </ul>

      {linkPlano && (
        <a
          href={linkPlano}
          className="mt-6 inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3.5 text-base font-semibold text-white transition-colors duration-150 hover:bg-accent-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Abrir meu Plano de Correção
          <ExternalLink aria-hidden className="h-4 w-4" />
        </a>
      )}
    </section>
  )
}
