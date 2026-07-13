import { useState } from 'react'
import { ChevronDown, ChevronUp, Plus, Trash2, X } from 'lucide-react'
import { motion } from 'framer-motion'
import { BRIEFING_FIELD_TIPOS, BRIEFING_ILUSTRACOES } from '../../lib/briefing'
import type {
  BriefingFieldTipo,
  BriefingIlustracao,
  BriefingOpcaoVisual,
  BriefingPergunta,
} from '../../lib/briefing'
import { OPCOES_MIN } from '../../lib/briefing'
import { ILUSTRACAO_LABELS, TIPO_CAMPO_LABELS } from './draft'
import { BRIEFING_ILLUSTRATIONS } from './illustrations'

interface PerguntaCardProps {
  pergunta: BriefingPergunta
  index: number
  total: number
  /** Erro de validação desta pergunta (após tentativa de salvar). */
  error?: string
  onChange: (next: BriefingPergunta) => void
  onMove: (delta: -1 | 1) => void
  onRemove: () => void
}

const inputClass =
  'w-full rounded-lg border border-white/5 bg-surface-1 px-3.5 py-2.5 text-sm text-ink placeholder:text-muted/40 outline-none transition-colors duration-200 focus:border-accent/60 focus:ring-2 focus:ring-accent/25 hover:border-white/10'

const orderButtonClass =
  'rounded-md p-1 text-muted transition-colors duration-150 hover:bg-white/5 hover:text-ink disabled:pointer-events-none disabled:opacity-25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent'

/** Ilustração padrão ao criar/migrar opções visuais sem ilustração definida. */
const ILUSTRACAO_PADRAO: BriefingIlustracao = BRIEFING_ILUSTRACOES[0]

function createOpcaoVisual(): BriefingOpcaoVisual {
  return { valor: '', ilustracao: ILUSTRACAO_PADRAO }
}

function ObrigatoriaSwitch({
  checked,
  perguntaLabel,
  onToggle,
}: {
  checked: boolean
  perguntaLabel: string
  onToggle: () => void
}) {
  return (
    <label className="flex cursor-pointer select-none items-center gap-2">
      <span className="text-[11px] font-medium uppercase tracking-widest text-muted">
        Obrigatória
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={`Pergunta obrigatória: ${perguntaLabel}`}
        onClick={onToggle}
        className={[
          'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
          checked ? 'border-accent/50 bg-accent' : 'border-white/10 bg-white/10',
        ].join(' ')}
      >
        <span
          aria-hidden
          className={[
            'h-3.5 w-3.5 rounded-full bg-white shadow transition-transform duration-200',
            checked ? 'translate-x-[18px]' : 'translate-x-[3px]',
          ].join(' ')}
        />
      </button>
    </label>
  )
}

function OpcoesEditor({
  pergunta,
  onChange,
}: {
  pergunta: BriefingPergunta
  onChange: (next: BriefingPergunta) => void
}) {
  const opcoes = pergunta.opcoes ?? []

  const setOpcoes = (next: string[]) => {
    onChange({ ...pergunta, opcoes: next })
  }

  return (
    <div className="mt-3 rounded-lg border border-white/5 bg-bg/40 p-3">
      <p className="text-[10px] font-medium uppercase tracking-widest text-muted/70">
        Opções de resposta (mínimo {OPCOES_MIN})
      </p>
      <div className="mt-2.5 flex flex-col gap-2">
        {opcoes.map((opcao, opcaoIndex) => (
          <div key={opcaoIndex} className="flex items-center gap-2">
            <input
              type="text"
              value={opcao}
              onChange={(e) =>
                setOpcoes(
                  opcoes.map((atual, i) =>
                    i === opcaoIndex ? e.target.value : atual
                  )
                )
              }
              placeholder={`Opção ${opcaoIndex + 1}`}
              aria-label={`Opção ${opcaoIndex + 1}`}
              className={inputClass}
            />
            <button
              type="button"
              onClick={() =>
                setOpcoes(opcoes.filter((_, i) => i !== opcaoIndex))
              }
              aria-label={`Remover opção ${opcaoIndex + 1}`}
              className="rounded-md p-1.5 text-muted/60 transition-colors duration-150 hover:bg-white/5 hover:text-red-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => setOpcoes([...opcoes, ''])}
        className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-muted transition-colors duration-150 hover:border-accent/40 hover:bg-accent/10 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
      >
        <Plus className="h-3.5 w-3.5" />
        Adicionar opção
      </button>
    </div>
  )
}

function OpcoesVisuaisEditor({
  pergunta,
  onChange,
}: {
  pergunta: BriefingPergunta
  onChange: (next: BriefingPergunta) => void
}) {
  const opcoes = pergunta.opcoes_visuais ?? []

  const setOpcoes = (next: BriefingOpcaoVisual[]) => {
    onChange({ ...pergunta, opcoes_visuais: next })
  }

  const updateOpcao = (
    opcaoIndex: number,
    patch: Partial<BriefingOpcaoVisual>
  ) => {
    setOpcoes(
      opcoes.map((atual, i) =>
        i === opcaoIndex ? { ...atual, ...patch } : atual
      )
    )
  }

  return (
    <div className="mt-3 rounded-lg border border-white/5 bg-bg/40 p-3">
      <p className="text-[10px] font-medium uppercase tracking-widest text-muted/70">
        Opções visuais (mínimo {OPCOES_MIN})
      </p>
      <div className="mt-2.5 flex flex-col gap-2.5">
        {opcoes.map((opcao, opcaoIndex) => {
          const Ilustracao = BRIEFING_ILLUSTRATIONS[opcao.ilustracao]
          return (
            <div
              key={opcaoIndex}
              className="flex flex-wrap items-center gap-2 rounded-lg border border-white/5 bg-surface-1/60 p-2"
            >
              <span className="shrink-0 overflow-hidden rounded-md border border-white/5">
                <Ilustracao aria-hidden className="h-10 w-auto" />
              </span>
              <input
                type="text"
                value={opcao.valor}
                onChange={(e) =>
                  updateOpcao(opcaoIndex, { valor: e.target.value })
                }
                placeholder={`Opção ${opcaoIndex + 1}`}
                aria-label={`Valor da opção visual ${opcaoIndex + 1}`}
                className={`${inputClass} min-w-28 flex-1`}
              />
              <input
                type="text"
                value={opcao.descricao ?? ''}
                onChange={(e) =>
                  updateOpcao(opcaoIndex, {
                    descricao: e.target.value || undefined,
                  })
                }
                placeholder="Descrição (opcional)"
                aria-label={`Descrição da opção visual ${opcaoIndex + 1}`}
                className={`${inputClass} min-w-28 flex-1`}
              />
              <select
                value={opcao.ilustracao}
                onChange={(e) =>
                  updateOpcao(opcaoIndex, {
                    ilustracao: e.target.value as BriefingIlustracao,
                  })
                }
                aria-label={`Ilustração da opção visual ${opcaoIndex + 1}`}
                className="rounded-lg border border-white/5 bg-surface-1 px-2.5 py-2 text-xs text-ink outline-none transition-colors duration-200 focus:border-accent/60 focus:ring-2 focus:ring-accent/25"
              >
                {BRIEFING_ILUSTRACOES.map((ilustracao) => (
                  <option key={ilustracao} value={ilustracao}>
                    {ILUSTRACAO_LABELS[ilustracao]}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() =>
                  setOpcoes(opcoes.filter((_, i) => i !== opcaoIndex))
                }
                aria-label={`Remover opção visual ${opcaoIndex + 1}`}
                className="rounded-md p-1.5 text-muted/60 transition-colors duration-150 hover:bg-white/5 hover:text-red-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )
        })}
      </div>
      <button
        type="button"
        onClick={() => setOpcoes([...opcoes, createOpcaoVisual()])}
        className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-muted transition-colors duration-150 hover:border-accent/40 hover:bg-accent/10 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
      >
        <Plus className="h-3.5 w-3.5" />
        Adicionar opção visual
      </button>
    </div>
  )
}

export default function PerguntaCard({
  pergunta,
  index,
  total,
  error,
  onChange,
  onMove,
  onRemove,
}: PerguntaCardProps) {
  const [confirmingRemove, setConfirmingRemove] = useState(false)
  const displayName =
    pergunta.label.trim() !== '' ? pergunta.label : `Pergunta ${index + 1}`

  const handleTipoChange = (tipo: BriefingFieldTipo) => {
    if (tipo === 'select') {
      // escolha_visual → select: os valores das opções visuais migram.
      const existentes = pergunta.opcoes ?? []
      const migradas =
        existentes.length > 0
          ? existentes
          : (pergunta.opcoes_visuais ?? [])
              .map((opcao) => opcao.valor)
              .filter((valor) => valor.trim() !== '')
      onChange({
        ...pergunta,
        tipo,
        opcoes: migradas.length > 0 ? migradas : ['', ''],
      })
      return
    }
    if (tipo === 'escolha_visual') {
      // select → escolha_visual: cada opção vira o valor de um card visual.
      const existentes = pergunta.opcoes_visuais ?? []
      const migradas =
        existentes.length > 0
          ? existentes
          : (pergunta.opcoes ?? [])
              .filter((opcao) => opcao.trim() !== '')
              .map((valor) => ({ valor, ilustracao: ILUSTRACAO_PADRAO }))
      onChange({
        ...pergunta,
        tipo,
        opcoes_visuais:
          migradas.length > 0
            ? migradas
            : [createOpcaoVisual(), createOpcaoVisual()],
      })
      return
    }
    onChange({ ...pergunta, tipo })
  }

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="flex gap-3 rounded-xl border border-white/5 bg-surface-2 p-4"
    >
      {/* Reordenação por botões — sem drag */}
      <div className="flex flex-col items-center gap-0.5 pt-0.5">
        <button
          type="button"
          disabled={index === 0}
          onClick={() => onMove(-1)}
          aria-label={`Mover "${displayName}" para cima`}
          className={orderButtonClass}
        >
          <ChevronUp className="h-4 w-4" />
        </button>
        <span className="text-[10px] font-medium text-muted/50">
          {index + 1}
        </span>
        <button
          type="button"
          disabled={index === total - 1}
          onClick={() => onMove(1)}
          aria-label={`Mover "${displayName}" para baixo`}
          className={orderButtonClass}
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span
            title="Identificador fixo — nunca muda, preserva respostas antigas"
            className="rounded border border-white/5 bg-bg/50 px-1.5 py-0.5 font-mono text-[10px] text-muted/60"
          >
            {pergunta.id}
          </span>

          <div className="ml-auto flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2">
              <span className="text-[11px] font-medium uppercase tracking-widest text-muted">
                Tipo
              </span>
              <select
                value={pergunta.tipo}
                onChange={(e) =>
                  handleTipoChange(e.target.value as BriefingFieldTipo)
                }
                aria-label={`Tipo do campo: ${displayName}`}
                className="rounded-lg border border-white/5 bg-surface-1 px-2.5 py-1.5 text-xs text-ink outline-none transition-colors duration-200 focus:border-accent/60 focus:ring-2 focus:ring-accent/25"
              >
                {BRIEFING_FIELD_TIPOS.map((tipo) => (
                  <option key={tipo} value={tipo}>
                    {TIPO_CAMPO_LABELS[tipo]}
                  </option>
                ))}
              </select>
            </label>

            <ObrigatoriaSwitch
              checked={pergunta.obrigatoria}
              perguntaLabel={displayName}
              onToggle={() =>
                onChange({ ...pergunta, obrigatoria: !pergunta.obrigatoria })
              }
            />

            {confirmingRemove ? (
              <span className="flex items-center gap-2">
                <span className="text-xs text-muted">Remover?</span>
                <button
                  type="button"
                  onClick={onRemove}
                  className="rounded-lg border border-red-500/25 bg-red-500/10 px-2.5 py-1 text-xs font-semibold text-red-400 transition-colors duration-150 hover:bg-red-500/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-400"
                >
                  Remover
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingRemove(false)}
                  className="rounded-lg border border-white/10 px-2.5 py-1 text-xs font-medium text-muted transition-colors duration-150 hover:bg-white/5 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                >
                  Cancelar
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingRemove(true)}
                aria-label={`Remover pergunta: ${displayName}`}
                className="rounded-lg p-1.5 text-muted/60 transition-colors duration-150 hover:bg-red-500/10 hover:text-red-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-400"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        <input
          type="text"
          value={pergunta.label}
          onChange={(e) => onChange({ ...pergunta, label: e.target.value })}
          placeholder="Texto da pergunta que o cliente verá"
          aria-label={`Texto da pergunta ${index + 1}`}
          className={`${inputClass} mt-3`}
        />

        <input
          type="text"
          value={pergunta.ajuda ?? ''}
          onChange={(e) =>
            onChange({ ...pergunta, ajuda: e.target.value || undefined })
          }
          placeholder="Texto de apoio (opcional) — explica em linguagem simples por que você pergunta isso"
          aria-label={`Texto de apoio da pergunta ${index + 1} (opcional)`}
          className={`${inputClass} mt-2 text-xs`}
        />

        {pergunta.tipo === 'select' && (
          <OpcoesEditor pergunta={pergunta} onChange={onChange} />
        )}

        {pergunta.tipo === 'escolha_visual' && (
          <OpcoesVisuaisEditor pergunta={pergunta} onChange={onChange} />
        )}

        {error && (
          <p role="alert" className="mt-2 text-xs text-red-400">
            {error}
          </p>
        )}
      </div>
    </motion.li>
  )
}
