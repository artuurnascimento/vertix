import { ExternalLink, MessageCircle } from 'lucide-react'
import { buildWhatsAppLink } from '../ui/whatsapp'

/** WhatsApp da Vertix — o canal do contato da Correção Aplicada (spec, decisão 5). */
export const WHATSAPP_VERTIX = '5562996076194'

interface Props {
  escopo: 'correcao_aplicada' | 'correcao_criticos'
  /** shopify | nuvemshop | outra | null (desconhecida → mostra as duas instruções). */
  plataforma: string | null
  loja: string | null
  planoCode: string | null
  linkPlano: string | null
}

/**
 * "Correção Aplicada: o que acontece agora" — o bloco da página de obrigado
 * para quem acabou de contratar a Correção. Quatro passos, a instrução de
 * acesso da plataforma da pessoa, e o WhatsApp já com a mensagem pronta.
 * Aparece na hora, antes mesmo de o pedido ser relido.
 */
export default function CorrecaoAplicadaPassos({ escopo, plataforma, loja, planoCode, linkPlano }: Props) {
  const criticos = escopo === 'correcao_criticos'
  const p = plataforma?.toLowerCase() ?? null
  const mostrarShopify = p === null || p === 'shopify'
  const mostrarNuvemshop = p === null || p === 'nuvemshop'
  const nome = criticos ? 'Correção Aplicada (3 pontos críticos)' : 'Correção Aplicada'
  const mensagem = `Contratei a ${nome}${loja ? ` da ${loja}` : ''}${planoCode ? ` (plano ${planoCode})` : ''} e quero combinar o acesso.`
  const zap = buildWhatsAppLink(WHATSAPP_VERTIX, mensagem)

  return (
    <section
      aria-labelledby="correcao-aplicada-heading"
      className="mt-5 rounded-2xl border border-accent/25 bg-accent/[0.06] p-5 sm:p-6"
    >
      <h2 id="correcao-aplicada-heading" className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">
        Correção Aplicada: o que acontece agora
      </h2>
      <p className="mt-2 text-sm font-light text-muted">
        Você não precisa fazer nada agora — a nossa equipe fala com você.
      </p>
      <ol className="mt-4 flex flex-col gap-3 text-sm font-light leading-relaxed text-muted">
        <li className="flex gap-3">
          <span className="font-semibold text-ink">1.</span>
          <span>
            <span className="font-medium text-ink">Contato em até 1 dia útil.</span> Falamos com você pelo
            WhatsApp e por e-mail para combinar o acesso.
          </span>
        </li>
        <li className="flex gap-3">
          <span className="font-semibold text-ink">2.</span>
          <span>
            <span className="font-medium text-ink">Acesso à loja.</span>
            {mostrarShopify && (
              <>
                {' '}
                <em className="not-italic text-ink/90">Shopify:</em> a Vertix envia um pedido de acesso de
                colaborador; você só aprova em Configurações → Usuários e permissões.
              </>
            )}
            {mostrarNuvemshop && (
              <>
                {' '}
                <em className="not-italic text-ink/90">Nuvemshop:</em> você cria um usuário para
                contato@vertix.studio em Configurações → Usuários, com permissão para editar o tema.
              </>
            )}
          </span>
        </li>
        <li className="flex gap-3">
          <span className="font-semibold text-ink">3.</span>
          <span>
            <span className="font-medium text-ink">
              Aplicação em {criticos ? 'até 5 dias úteis' : '7 a 10 dias úteis'}.
            </span>{' '}
            A gente aplica as correções do seu plano — elas aparecem marcadas na página do plano — e manda o
            resumo do que mudou.
          </span>
        </li>
        <li className="flex gap-3">
          <span className="font-semibold text-ink">4.</span>
          <span>
            <span className="font-medium text-ink">Antes e depois.</span> 30 dias depois, a reanálise chega no
            seu e-mail com a nota nova.
          </span>
        </li>
      </ol>
      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        {zap && (
          <a
            href={zap}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-white hover:bg-accent-2"
          >
            <MessageCircle aria-hidden className="h-4 w-4" />
            Quer adiantar? Chama a gente no WhatsApp
          </a>
        )}
        {linkPlano && (
          <a
            href={linkPlano}
            className="inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 px-5 py-3 text-sm font-medium text-ink hover:bg-white/5"
          >
            Abrir meu Plano de Correção
            <ExternalLink aria-hidden className="h-4 w-4" />
          </a>
        )}
      </div>
    </section>
  )
}
