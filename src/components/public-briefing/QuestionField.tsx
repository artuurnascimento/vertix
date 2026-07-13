import { useEffect, useRef } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import clsx from 'clsx'
import type { BriefingPergunta } from '../../lib/briefing'
import { BRIEFING_ILLUSTRATIONS } from '../briefings/illustrations'

/**
 * Renderiza uma pergunta do wizard (uma por tela) conforme o tipo:
 * texto/numero → input; textarea → auto-grow; select → cards-rádio verticais;
 * escolha_visual → grid de cards ilustrados (seleção auto-avança no pai).
 *
 * Semântica: inputs com <label htmlFor>; grupos de opção com fieldset/legend
 * e rádios reais (sr-only) — navegação por setas e Enter nativas.
 */

interface QuestionFieldProps {
  pergunta: BriefingPergunta
  value: string
  errorId?: string
  onChange: (value: string) => void
  /** Enter (sem Shift) em textarea avança a pergunta. */
  onAdvance: () => void
  /** escolha_visual: grava o valor e agenda o auto-avanço no pai. */
  onVisualSelect: (value: string) => void
}

const inputBase =
  'w-full rounded-xl border border-white/10 bg-surface-2 px-4 py-3.5 text-ink placeholder:text-muted/40 outline-none transition-colors duration-200 focus:border-accent/60 focus:ring-2 focus:ring-accent/25 hover:border-white/20'

function OptionalBadge() {
  return (
    <span className="ml-2 inline-block translate-y-[-2px] rounded-full border border-white/10 px-2 py-0.5 align-middle text-[10px] font-normal uppercase tracking-wider text-muted">
      opcional
    </span>
  )
}

function LabelHeading({
  pergunta,
  as,
}: {
  pergunta: BriefingPergunta
  as: 'label' | 'legend'
}) {
  const content: ReactNode = (
    <>
      {pergunta.label}
      {!pergunta.obrigatoria && <OptionalBadge />}
    </>
  )
  const className =
    'block text-2xl font-semibold leading-snug text-ink sm:text-3xl'
  if (as === 'legend') {
    return (
      <legend data-testid="wizard-question-label" className={className}>
        {content}
      </legend>
    )
  }
  return (
    <label
      htmlFor={`campo-${pergunta.id}`}
      data-testid="wizard-question-label"
      className={className}
    >
      {content}
    </label>
  )
}

function Ajuda({ texto }: { texto?: string }) {
  if (!texto) return null
  return (
    <p className="mt-2 text-sm font-light leading-relaxed text-muted">
      {texto}
    </p>
  )
}

export default function QuestionField({
  pergunta,
  value,
  errorId,
  onChange,
  onAdvance,
  onVisualSelect,
}: QuestionFieldProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Foco automático ao entrar na pergunta: opção marcada > primeiro campo.
  useEffect(() => {
    const root = containerRef.current
    if (!root) return
    const checked = root.querySelector<HTMLElement>('input:checked')
    const first = root.querySelector<HTMLElement>('input, textarea')
    ;(checked ?? first)?.focus({ preventScroll: true })
  }, [pergunta.id])

  // Textarea auto-grow (mantém o conteúdo sempre visível sem scroll interno).
  const resizeTextarea = () => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }
  useEffect(resizeTextarea, [pergunta.id, value])

  const handleTextareaKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      onAdvance()
    }
  }

  const sharedInputProps = {
    id: `campo-${pergunta.id}`,
    'aria-invalid': Boolean(errorId),
    'aria-describedby': errorId,
  }

  if (pergunta.tipo === 'select') {
    return (
      <div ref={containerRef}>
        <fieldset aria-describedby={errorId}>
          <LabelHeading pergunta={pergunta} as="legend" />
          <Ajuda texto={pergunta.ajuda} />
          <div className="mt-6 flex flex-col gap-2.5">
            {(pergunta.opcoes ?? []).map((opcao) => {
              const selected = value === opcao
              return (
                <label
                  key={opcao}
                  className={clsx(
                    'flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3.5 transition-colors duration-150',
                    'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent/60',
                    selected
                      ? 'border-accent bg-accent/10'
                      : 'border-white/10 bg-surface-2 hover:border-white/25'
                  )}
                >
                  <input
                    type="radio"
                    name={`pergunta-${pergunta.id}`}
                    value={opcao}
                    checked={selected}
                    onChange={() => onChange(opcao)}
                    className="sr-only"
                    aria-describedby={errorId}
                  />
                  <span
                    aria-hidden
                    className={clsx(
                      'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors',
                      selected ? 'border-accent' : 'border-white/25'
                    )}
                  >
                    {selected && (
                      <span className="h-2 w-2 rounded-full bg-accent" />
                    )}
                  </span>
                  <span className="text-sm text-ink">{opcao}</span>
                </label>
              )
            })}
          </div>
        </fieldset>
      </div>
    )
  }

  if (pergunta.tipo === 'escolha_visual') {
    return (
      <div ref={containerRef}>
        <fieldset aria-describedby={errorId}>
          <LabelHeading pergunta={pergunta} as="legend" />
          <Ajuda texto={pergunta.ajuda} />
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {(pergunta.opcoes_visuais ?? []).map((opcao) => {
              const Ilustracao = BRIEFING_ILLUSTRATIONS[opcao.ilustracao]
              const selected = value === opcao.valor
              return (
                <label
                  key={opcao.valor}
                  className={clsx(
                    'flex cursor-pointer flex-col rounded-xl border p-3 transition-all duration-150',
                    'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent/60',
                    selected
                      ? 'border-accent/60 bg-accent/10 ring-2 ring-accent'
                      : 'border-white/10 bg-surface-2 hover:border-white/25'
                  )}
                >
                  <input
                    type="radio"
                    name={`pergunta-${pergunta.id}`}
                    value={opcao.valor}
                    checked={selected}
                    onChange={() => onVisualSelect(opcao.valor)}
                    className="sr-only"
                    aria-describedby={errorId}
                  />
                  <Ilustracao className="w-full rounded-lg" />
                  <span className="mt-2.5 text-sm font-medium leading-snug text-ink">
                    {opcao.valor}
                  </span>
                  {opcao.descricao && (
                    <span className="mt-0.5 text-xs font-light leading-snug text-muted">
                      {opcao.descricao}
                    </span>
                  )}
                </label>
              )
            })}
          </div>
        </fieldset>
      </div>
    )
  }

  return (
    <div ref={containerRef}>
      <LabelHeading pergunta={pergunta} as="label" />
      <Ajuda texto={pergunta.ajuda} />

      {pergunta.tipo === 'texto' && (
        <input
          {...sharedInputProps}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Escreva aqui…"
          className={clsx(inputBase, 'mt-6 text-lg')}
        />
      )}

      {pergunta.tipo === 'numero' && (
        <input
          {...sharedInputProps}
          type="number"
          inputMode="numeric"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0"
          className={clsx(
            inputBase,
            'mt-6 text-2xl font-medium [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none'
          )}
        />
      )}

      {pergunta.tipo === 'textarea' && (
        <>
          <textarea
            {...sharedInputProps}
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleTextareaKeyDown}
            rows={3}
            placeholder="Conte com suas palavras…"
            className={clsx(
              inputBase,
              'mt-6 min-h-28 resize-none overflow-hidden text-base leading-relaxed'
            )}
          />
          <p className="mt-2 text-[11px] font-light text-muted/60">
            Enter avança · Shift+Enter quebra linha
          </p>
        </>
      )}
    </div>
  )
}
