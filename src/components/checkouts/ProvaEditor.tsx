import { Plus, Trash2 } from 'lucide-react'
import { Bloco, inputClass, labelClass } from '../produtos/formUi'
import type { Depoimento } from './checkoutsData'

interface Props {
  depoimentos: readonly Depoimento[]
  selos: readonly string[]
  onDepoimentos: (lista: Depoimento[]) => void
  onSelos: (lista: string[]) => void
}

const DEPOIMENTO_VAZIO: Depoimento = { nome: '', texto: '', nota: null, loja: null }

const NOTAS = [1, 2, 3, 4, 5] as const

/**
 * Editor da prova social guardada no campo `prova` (jsonb): depoimentos e
 * selos. Depoimento sem texto é descartado na hora de salvar — o que vai para
 * a página precisa ser o que alguém realmente escreveu.
 */
export default function ProvaEditor({
  depoimentos,
  selos,
  onDepoimentos,
  onSelos,
}: Props) {
  const alterar = (index: number, campo: keyof Depoimento, valor: unknown) => {
    onDepoimentos(
      depoimentos.map((d, i) => (i === index ? { ...d, [campo]: valor } : d))
    )
  }

  return (
    <Bloco
      titulo="Prova social"
      ajuda="Depoimentos e selos exibidos na página. Depoimento sem texto não é salvo."
    >
      <div className="flex flex-col gap-3">
        {depoimentos.length === 0 && (
          <p className="text-xs font-light text-muted">
            Nenhum depoimento ainda. A página funciona sem eles, mas converte
            menos.
          </p>
        )}

        {depoimentos.map((depoimento, index) => (
          <div
            key={index}
            className="flex flex-col gap-3 rounded-lg border border-white/5 bg-surface-1 p-4"
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5">
                <span className={labelClass}>Nome</span>
                <input
                  type="text"
                  value={depoimento.nome}
                  onChange={(e) => alterar(index, 'nome', e.target.value)}
                  placeholder="Ana Souza"
                  className={inputClass}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className={labelClass}>Loja</span>
                <input
                  type="text"
                  value={depoimento.loja ?? ''}
                  onChange={(e) => alterar(index, 'loja', e.target.value)}
                  placeholder="Ateliê da Ana"
                  className={inputClass}
                />
              </label>
            </div>

            <label className="flex flex-col gap-1.5">
              <span className={labelClass}>Depoimento</span>
              <textarea
                rows={2}
                value={depoimento.texto}
                onChange={(e) => alterar(index, 'texto', e.target.value)}
                placeholder="O que essa pessoa falou sobre o resultado."
                className={`${inputClass} resize-y`}
              />
            </label>

            <div className="flex items-center justify-between gap-3">
              <label className="flex items-center gap-2">
                <span className={labelClass}>Nota</span>
                <select
                  value={depoimento.nota ?? ''}
                  onChange={(e) =>
                    alterar(
                      index,
                      'nota',
                      e.target.value === '' ? null : Number(e.target.value)
                    )
                  }
                  className="rounded-lg border border-white/5 bg-surface-2 px-3 py-1.5 text-sm text-ink outline-none focus:border-accent/60"
                >
                  <option value="">Sem nota</option>
                  {NOTAS.map((nota) => (
                    <option key={nota} value={nota}>
                      {nota} estrela{nota > 1 ? 's' : ''}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={() => onDepoimentos(depoimentos.filter((_, i) => i !== index))}
                aria-label={`Remover depoimento ${index + 1}`}
                className="rounded-lg p-2 text-muted/60 transition-colors duration-150 hover:bg-red-500/10 hover:text-red-400"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={() => onDepoimentos([...depoimentos, DEPOIMENTO_VAZIO])}
          className="inline-flex w-fit items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-muted transition-colors duration-200 hover:bg-white/5 hover:text-ink"
        >
          <Plus className="h-3.5 w-3.5" />
          Adicionar depoimento
        </button>
      </div>

      <div className="flex flex-col gap-2 border-t border-white/5 pt-4">
        <span className={labelClass}>Selos</span>
        {selos.map((selo, index) => (
          <div key={index} className="flex items-center gap-2">
            <input
              type="text"
              value={selo}
              onChange={(e) =>
                onSelos(selos.map((s, i) => (i === index ? e.target.value : s)))
              }
              placeholder="Compra segura"
              className={inputClass}
            />
            <button
              type="button"
              onClick={() => onSelos(selos.filter((_, i) => i !== index))}
              aria-label={`Remover selo ${index + 1}`}
              className="shrink-0 rounded-lg p-2 text-muted/60 transition-colors duration-150 hover:bg-red-500/10 hover:text-red-400"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => onSelos([...selos, ''])}
          className="inline-flex w-fit items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-muted transition-colors duration-200 hover:bg-white/5 hover:text-ink"
        >
          <Plus className="h-3.5 w-3.5" />
          Adicionar selo
        </button>
      </div>
    </Bloco>
  )
}
