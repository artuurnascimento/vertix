/**
 * Tela de boas-vindas do wizard público de briefing. Linguagem leiga:
 * explica o que vem pela frente e quanto tempo leva antes de começar.
 */

const MINUTOS_MINIMO = 2
const MINUTOS_POR_PERGUNTA = 0.5

interface WizardIntroProps {
  projetoNome: string
  totalPerguntas: number
  onStart: () => void
}

export default function WizardIntro({
  projetoNome,
  totalPerguntas,
  onStart,
}: WizardIntroProps) {
  const minutos = Math.max(
    MINUTOS_MINIMO,
    Math.ceil(totalPerguntas * MINUTOS_POR_PERGUNTA)
  )

  return (
    <div className="rounded-2xl border border-white/5 bg-surface-1 p-6 shadow-[0_24px_80px_-40px_rgba(108,91,242,0.3)] sm:p-10">
      <h1 className="hero-heading text-3xl font-bold leading-tight sm:text-4xl">
        Briefing — {projetoNome}
      </h1>
      <p className="mt-4 max-w-md text-sm font-light leading-relaxed text-muted sm:text-base">
        Responda algumas perguntas rápidas para a gente entender seu projeto
        do jeito certo. Sem termos técnicos — é uma conversa.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-2 text-xs text-muted">
        <span className="rounded-full border border-white/10 bg-surface-2 px-3 py-1.5">
          {totalPerguntas} pergunta{totalPerguntas === 1 ? '' : 's'}
        </span>
        <span className="rounded-full border border-white/10 bg-surface-2 px-3 py-1.5">
          leva uns {minutos} minutos
        </span>
        <span className="rounded-full border border-white/10 bg-surface-2 px-3 py-1.5">
          uma pergunta por vez
        </span>
      </div>

      <button
        type="button"
        onClick={onStart}
        className="mt-8 w-full rounded-lg bg-accent px-6 py-3.5 text-sm font-semibold text-white shadow-[0_8px_24px_-8px_rgba(108,91,242,0.6)] transition-all duration-200 hover:bg-accent-2 hover:shadow-[0_10px_28px_-8px_rgba(85,70,224,0.7)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:w-auto"
      >
        Começar
      </button>
    </div>
  )
}
