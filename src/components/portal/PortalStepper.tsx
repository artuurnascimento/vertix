import { Check } from 'lucide-react'
import { PROJECT_STATUS_ORDER } from '../../lib/format'
import type { ProjectStatus } from '../../lib/format'

/**
 * Stepper das 6 etapas do projeto para o cliente final.
 * Copy amigável para leigos — nada de jargão interno de Kanban.
 * Vertical no mobile, horizontal a partir de sm.
 */

interface StepCopy {
  titulo: string
  descricao: string
}

const STEP_COPY: Record<ProjectStatus, StepCopy> = {
  lead: {
    titulo: 'Início',
    descricao: 'Seu projeto foi registrado e está em análise pela equipe.',
  },
  briefing_enviado: {
    titulo: 'Briefing',
    descricao: 'Enviamos algumas perguntas — suas respostas guiam o projeto.',
  },
  briefing_recebido: {
    titulo: 'Planejamento',
    descricao: 'Briefing em mãos! Estamos desenhando o plano do seu projeto.',
  },
  em_desenvolvimento: {
    titulo: 'Desenvolvimento',
    descricao: 'Estamos construindo seu projeto neste momento.',
  },
  revisao: {
    titulo: 'Revisão',
    descricao: 'Reta final: ajustes e polimento antes da entrega.',
  },
  entregue: {
    titulo: 'Entrega',
    descricao: 'Projeto entregue! Obrigado por construir com a Vertix.',
  },
}

function getCircleClass(isDone: boolean, isCurrent: boolean): string {
  if (isCurrent) {
    return 'border-accent bg-accent/15 shadow-[0_0_22px_rgba(108,91,242,0.5)]'
  }
  if (isDone) return 'border-accent/40 bg-accent/10'
  return 'border-white/10 bg-surface-2'
}

function getLabelClass(isDone: boolean, isCurrent: boolean): string {
  if (isCurrent) return 'font-semibold text-ink'
  if (isDone) return 'font-medium text-ink/70'
  return 'font-light text-muted'
}

interface PortalStepperProps {
  status: string
}

export default function PortalStepper({ status }: PortalStepperProps) {
  const rawIndex = PROJECT_STATUS_ORDER.indexOf(status as ProjectStatus)
  const currentIndex = rawIndex === -1 ? 0 : rawIndex
  const currentCopy = STEP_COPY[PROJECT_STATUS_ORDER[currentIndex]]

  return (
    <div>
      <ol className="flex flex-col sm:flex-row">
        {PROJECT_STATUS_ORDER.map((step, index) => {
          const copy = STEP_COPY[step]
          const isDone = index < currentIndex
          const isCurrent = index === currentIndex
          const isLast = index === PROJECT_STATUS_ORDER.length - 1
          const connectorClass = isDone ? 'bg-accent/40' : 'bg-white/10'

          return (
            <li
              key={step}
              aria-current={isCurrent ? 'step' : undefined}
              className="relative flex gap-4 pb-7 last:pb-0 sm:flex-1 sm:flex-col sm:items-center sm:gap-2.5 sm:pb-0"
            >
              {/* Conector vertical (mobile) */}
              {!isLast && (
                <span
                  aria-hidden
                  className={`absolute left-4 top-9 h-[calc(100%-2.5rem)] w-px -translate-x-1/2 sm:hidden ${connectorClass}`}
                />
              )}
              {/* Conector horizontal (desktop) */}
              {!isLast && (
                <span
                  aria-hidden
                  className={`absolute left-[calc(50%+1.375rem)] top-4 hidden h-px w-[calc(100%-2.75rem)] sm:block ${connectorClass}`}
                />
              )}

              <span className="relative flex h-8 w-8 shrink-0 items-center justify-center">
                {isCurrent && (
                  <span
                    aria-hidden
                    className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent/25 [animation-duration:2.2s] motion-reduce:hidden"
                  />
                )}
                <span
                  className={`relative flex h-8 w-8 items-center justify-center rounded-full border transition-colors ${getCircleClass(isDone, isCurrent)}`}
                >
                  {isDone ? (
                    <Check aria-hidden className="h-3.5 w-3.5 text-accent" />
                  ) : (
                    <span
                      aria-hidden
                      className={`h-2 w-2 rounded-full ${isCurrent ? 'bg-accent' : 'bg-white/20'}`}
                    />
                  )}
                </span>
              </span>

              <div className="min-w-0 pt-1.5 sm:pt-0 sm:text-center">
                <p className={`text-sm sm:text-xs ${getLabelClass(isDone, isCurrent)}`}>
                  {copy.titulo}
                </p>
                {isCurrent && (
                  <p className="mt-1 text-xs font-light leading-relaxed text-muted sm:hidden">
                    {copy.descricao}
                  </p>
                )}
              </div>
            </li>
          )
        })}
      </ol>

      {/* Copy da etapa atual — só no desktop (no mobile fica inline no passo) */}
      <p className="mt-7 hidden rounded-xl border border-accent/15 bg-accent/[0.06] px-4 py-3 text-center text-sm font-light text-ink/90 sm:block">
        {currentCopy.descricao}
      </p>
    </div>
  )
}
