import type { BriefingPergunta } from '../../lib/briefing'

/**
 * Revisão final do wizard: lista compacta pergunta → resposta com "Editar"
 * (volta à pergunta) e o botão de envio real. Erros de envio aparecem aqui.
 */

interface WizardReviewProps {
  perguntas: BriefingPergunta[]
  values: Record<string, string>
  isSubmitting: boolean
  rootError: string | null
  onEdit: (index: number) => void
  onBack: () => void
  onSubmit: () => void
}

export default function WizardReview({
  perguntas,
  values,
  isSubmitting,
  rootError,
  onEdit,
  onBack,
  onSubmit,
}: WizardReviewProps) {
  return (
    <div className="rounded-2xl border border-white/5 bg-surface-1 p-5 shadow-[0_24px_80px_-40px_rgba(108,91,242,0.3)] sm:p-8">
      <h2 className="text-2xl font-semibold leading-snug text-ink sm:text-3xl">
        Revise suas respostas
      </h2>
      <p className="mt-2 text-sm font-light leading-relaxed text-muted">
        Confira antes de enviar — dá para ajustar qualquer resposta.
      </p>

      <ul className="mt-6 divide-y divide-white/5">
        {perguntas.map((pergunta, index) => {
          const resposta = (values[pergunta.id] ?? '').trim()
          return (
            <li
              key={pergunta.id}
              className="flex items-start justify-between gap-4 py-3.5"
            >
              <div className="min-w-0">
                <p className="text-xs font-light leading-snug text-muted">
                  {pergunta.label}
                </p>
                {resposta ? (
                  <p className="mt-1 break-words text-sm text-ink">
                    {resposta}
                  </p>
                ) : (
                  <p className="mt-1 text-sm font-light italic text-muted/60">
                    Sem resposta
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => onEdit(index)}
                aria-label={`Editar: ${pergunta.label}`}
                className="shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-medium text-accent transition-colors hover:bg-accent/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                Editar
              </button>
            </li>
          )
        })}
      </ul>

      {rootError && (
        <p
          role="alert"
          className="mt-5 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm text-red-400"
        >
          {rootError}
        </p>
      )}

      <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg px-5 py-3 text-sm font-medium text-muted transition-colors hover:bg-white/5 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Voltar
        </button>
        <div className="hidden flex-1 sm:block" />
        <button
          type="button"
          onClick={onSubmit}
          disabled={isSubmitting}
          className="rounded-lg bg-accent px-6 py-3.5 text-sm font-semibold text-white shadow-[0_8px_24px_-8px_rgba(108,91,242,0.6)] transition-all duration-200 hover:bg-accent-2 hover:shadow-[0_10px_28px_-8px_rgba(85,70,224,0.7)] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {isSubmitting ? 'Enviando…' : 'Enviar briefing'}
        </button>
      </div>
    </div>
  )
}
