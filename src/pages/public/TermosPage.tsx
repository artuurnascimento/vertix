import { useEffect, type ReactNode } from 'react'
import VertixCheckoutLogo from '../../components/checkout/VertixCheckoutLogo'

/**
 * Termos de uso da venda — linkados pelo checkout, onde o aceite acontece.
 *
 * O conteúdo descreve o que o sistema REALMENTE faz: como a compra é
 * processada, em quanto tempo cada produto chega e como funciona a garantia.
 * Nada aqui é cláusula genérica de modelo: se o texto afirma algo, é porque o
 * código cumpre.
 *
 * ATENÇÃO: é documento contratual e merece revisão de quem entende de direito
 * do consumidor antes de ser tratado como definitivo.
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

export default function TermosPage() {
  useEffect(() => {
    document.title = 'Termos de uso · Vertix Studio'
  }, [])

  return (
    <main className="mx-auto max-w-2xl px-5 py-12 sm:py-16">
      <a href="/" className="inline-flex" aria-label="Início">
        <VertixCheckoutLogo symbolSize={32} />
      </a>

      <h1 className="mt-9 font-kanit text-3xl font-bold leading-tight text-ink sm:text-4xl">
        Termos de uso
      </h1>
      <p className="mt-2 text-xs uppercase tracking-[0.14em] text-muted">
        Atualizado em {ATUALIZADO_EM}
      </p>

      <Secao titulo="Quem somos">
        <p>
          Vertix Studio, CNPJ 54.203.421/0001-49. Contato pelo e-mail{' '}
          <a href="mailto:contato@vertix.studio" className="text-accent underline">
            contato@vertix.studio
          </a>
          .
        </p>
      </Secao>

      <Secao titulo="O que você está comprando">
        <p>
          Cada produto tem a descrição na própria página de compra, com o preço e
          o que está incluído. Vale o que está escrito ali no momento da compra.
        </p>
        <p>
          O <strong className="text-ink">Plano de Correção</strong> é um documento
          gerado a partir da análise da sua loja: para cada ponto encontrado, o
          que mudar, onde no painel da sua plataforma e o ganho estimado. É um
          plano de execução — quem aplica as mudanças é você, salvo se contratar
          separadamente o serviço de execução.
        </p>
        <p>
          As estimativas de ganho são projeções calculadas a partir da análise,
          não promessa de resultado. Nenhum produto garante aumento de vendas.
        </p>
      </Secao>

      <Secao titulo="Pagamento">
        <p>
          Os pagamentos são processados pelo Mercado Pago. A Vertix não armazena
          os dados do seu cartão: eles trafegam do seu navegador direto para o
          processador.
        </p>
        <p>
          Ao aceitar um item adicional logo após a compra, a cobrança é feita no
          mesmo cartão, e o código de segurança é pedido de novo pelo próprio
          Mercado Pago — exigência dele, não nossa.
        </p>
      </Secao>

      <Secao titulo="Entrega">
        <p>
          O Plano de Correção é entregue por e-mail em até 24 horas, junto do
          recibo e do link para a página do plano. Produtos de execução têm prazo
          combinado antes do início, com escopo fechado por escrito.
        </p>
        <p>
          Se a análise que originou a compra não estiver disponível, entramos em
          contato para resolver antes de qualquer entrega automática.
        </p>
      </Secao>

      <Secao titulo="Garantia e cancelamento">
        <p>
          O prazo de garantia de cada produto aparece na página de compra. Dentro
          dele, basta pedir pelo e-mail de contato para receber a devolução
          integral, sem precisar justificar.
        </p>
        <p>
          Além disso, o artigo 49 do Código de Defesa do Consumidor garante o
          direito de arrependimento em até 7 dias para compras pela internet.
        </p>
      </Secao>

      <Secao titulo="Uso do material">
        <p>
          O plano e os materiais entregues são para uso na sua própria loja.
          Revender, redistribuir ou publicar o conteúdo não está autorizado.
        </p>
      </Secao>

      <Secao titulo="Seus dados">
        <p>
          O tratamento dos seus dados está descrito na{' '}
          <a href="/privacidade" className="text-accent underline">
            Política de Privacidade
          </a>
          .
        </p>
      </Secao>

      <p className="mt-12 border-t border-white/10 pt-6 text-xs text-muted">
        Dúvidas sobre estes termos? Escreva para contato@vertix.studio.
      </p>
    </main>
  )
}
