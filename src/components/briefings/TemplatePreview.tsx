import { motion } from 'framer-motion'
import { Eye } from 'lucide-react'
import type { BriefingPergunta } from '../../lib/briefing'

/**
 * Réplica visual read-only do form público (/briefing/:token). O BriefingForm
 * não exporta o campo, então este preview espelha as mesmas classes e
 * estrutura, com controles desabilitados.
 */

const fieldClass =
  'w-full rounded-lg border border-white/5 bg-surface-2 px-4 py-3 text-sm text-ink placeholder:text-muted/40 outline-none disabled:cursor-default disabled:opacity-80'

function PreviewField({ pergunta }: { pergunta: BriefingPergunta }) {
  const label =
    pergunta.label.trim() !== '' ? pergunta.label : 'Pergunta sem texto'

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium leading-snug text-ink">
        {label}
        {pergunta.obrigatoria && (
          <span aria-hidden className="ml-1 text-accent">
            *
          </span>
        )}
      </span>

      {pergunta.tipo === 'texto' && (
        <input
          type="text"
          disabled
          placeholder="Sua resposta"
          className={fieldClass}
        />
      )}

      {pergunta.tipo === 'numero' && (
        <input type="number" disabled placeholder="0" className={fieldClass} />
      )}

      {pergunta.tipo === 'textarea' && (
        <textarea
          disabled
          rows={4}
          placeholder="Conte com detalhes…"
          className={`${fieldClass} min-h-28 resize-none leading-relaxed`}
        />
      )}

      {pergunta.tipo === 'select' && (
        <select disabled className={`${fieldClass} appearance-none`}>
          <option value="">Selecionar…</option>
          {(pergunta.opcoes ?? [])
            .filter((opcao) => opcao.trim() !== '')
            .map((opcao) => (
              <option key={opcao} value={opcao}>
                {opcao}
              </option>
            ))}
        </select>
      )}
    </div>
  )
}

export default function TemplatePreview({
  perguntas,
}: {
  perguntas: BriefingPergunta[]
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <p className="flex items-center gap-2 text-xs font-light text-muted">
        <Eye aria-hidden className="h-3.5 w-3.5 text-accent/70" />
        Pré-visualização — é assim que o cliente verá o formulário. As
        alterações não salvas também aparecem aqui.
      </p>
      <div
        aria-label="Pré-visualização do formulário de briefing"
        className="mt-4 rounded-2xl border border-white/5 bg-surface-1 p-5 shadow-[0_24px_80px_-40px_rgba(108,91,242,0.3)] sm:p-8"
      >
        <div className="flex flex-col gap-7">
          {perguntas.map((pergunta) => (
            <PreviewField key={pergunta.id} pergunta={pergunta} />
          ))}
        </div>
        <div className="mt-8 flex flex-col gap-3">
          <span
            aria-hidden
            className="w-full cursor-default rounded-lg bg-accent/50 px-5 py-3.5 text-center text-sm font-semibold text-white/70"
          >
            Enviar briefing
          </span>
          <p className="text-center text-[11px] font-light text-muted/70">
            Campos marcados com <span className="text-accent">*</span> são
            obrigatórios.
          </p>
        </div>
      </div>
    </motion.div>
  )
}
