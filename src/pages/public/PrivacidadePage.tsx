import { useEffect, type ReactNode } from 'react'
import VertixCheckoutLogo from '../../components/checkout/VertixCheckoutLogo'

/**
 * Política de Privacidade da compra — linkada pelo checkout e pelo rodapé.
 *
 * Descreve exatamente os dados que o checkout coleta e o que o sistema faz com
 * eles. Cada item aqui corresponde a um campo real do formulário ou a uma
 * chamada real do código: nome, e-mail, WhatsApp e documento opcional; o cartão
 * que vai direto ao Mercado Pago; o cartão salvo para o item adicional.
 *
 * ATENÇÃO: documento com efeito jurídico. Merece revisão de quem entende de
 * proteção de dados antes de ser tratado como definitivo.
 */

const ATUALIZADO_EM = '8 de setembro de 2026'

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="mt-9">
      <h2 className="font-kanit text-lg font-bold text-ink">{titulo}</h2>
      <div className="mt-3 flex flex-col gap-3 text-sm leading-relaxed text-muted">
        {children}
      </div>
    </section>
  )
}

export default function PrivacidadePage() {
  useEffect(() => {
    document.title = 'Política de Privacidade · Vertix Studio'
  }, [])

  return (
    <main className="mx-auto max-w-2xl px-5 py-12 sm:py-16">
      <a href="/" className="inline-flex" aria-label="Início">
        <VertixCheckoutLogo symbolSize={32} />
      </a>

      <h1 className="mt-9 font-kanit text-3xl font-bold leading-tight text-ink sm:text-4xl">
        Política de Privacidade
      </h1>
      <p className="mt-2 text-xs uppercase tracking-[0.14em] text-muted">
        Atualizado em {ATUALIZADO_EM}
      </p>

      <Secao titulo="Quem trata os seus dados">
        <p>
          Vertix Studio, CNPJ 54.203.421/0001-49, é a controladora. Para falar
          sobre seus dados, escreva para{' '}
          <a href="mailto:contato@vertix.studio" className="text-accent underline">
            contato@vertix.studio
          </a>
          .
        </p>
      </Secao>

      <Secao titulo="O que coletamos, e só isso">
        <p>
          No checkout: <strong className="text-ink">nome, e-mail e WhatsApp</strong>,
          e o <strong className="text-ink">CPF ou CNPJ</strong> quando você
          preenche — esse campo é opcional.
        </p>
        <p>
          Se a compra veio de uma análise do Vertix Scan, guardamos também a
          referência daquela análise, que é o que permite gerar o seu plano.
        </p>
        <p>
          <strong className="text-ink">Não coletamos os dados do seu cartão.</strong>{' '}
          Número, validade e código de segurança são digitados em campos do
          próprio Mercado Pago e vão direto para ele. Nosso servidor nunca vê
          esses dados.
        </p>
      </Secao>

      <Secao titulo="Para que usamos">
        <p>
          Para processar o pagamento, entregar o que você comprou, emitir o
          recibo e falar com você sobre a compra. O e-mail é o canal da entrega;
          o WhatsApp, o canal de suporte.
        </p>
        <p>
          Não vendemos, alugamos nem compartilhamos seus dados com terceiros para
          publicidade.
        </p>
      </Secao>

      <Secao titulo="Com quem compartilhamos">
        <p>
          <strong className="text-ink">Mercado Pago</strong>, para processar o
          pagamento. <strong className="text-ink">Resend</strong>, para entregar
          os e-mails. <strong className="text-ink">Supabase</strong>, onde os
          dados ficam armazenados. Cada um recebe apenas o necessário para a sua
          função.
        </p>
      </Secao>

      <Secao titulo="Cartão salvo">
        <p>
          Quando você compra com cartão, o Mercado Pago guarda o cartão associado
          ao seu e-mail para que um item adicional possa ser cobrado sem digitar
          tudo de novo. Quem guarda é o Mercado Pago, não a Vertix — ficamos
          apenas com um identificador que não permite cobrar sem a sua
          confirmação pelo código de segurança.
        </p>
      </Secao>

      <Secao titulo="Por quanto tempo guardamos">
        <p>
          Os dados da compra ficam pelo prazo exigido pela legislação fiscal e
          para o caso de você precisar acionar a garantia ou pedir suporte.
          Depois disso, são descartados ou anonimizados.
        </p>
      </Secao>

      <Secao titulo="Seus direitos">
        <p>
          A LGPD garante que você possa confirmar quais dados temos, acessá-los,
          corrigi-los, pedir a exclusão e revogar o consentimento. É só escrever
          para contato@vertix.studio — respondemos no prazo legal.
        </p>
        <p>
          A exclusão pode não alcançar registros que a lei nos obriga a manter,
          como os fiscais da venda; nesse caso, explicamos o motivo na resposta.
        </p>
      </Secao>

      <p className="mt-12 border-t border-white/10 pt-6 text-xs text-muted">
        Dúvidas sobre esta política? Escreva para contato@vertix.studio.
      </p>
    </main>
  )
}
