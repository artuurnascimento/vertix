import { useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { horasDoTexto, useAtualizarEsforco, useEsforcoPorRegra } from './esforcoData'
import type { EsforcoDaRegra } from '../proposals/diagnostico'

const inputClass =
  'w-20 rounded-lg border border-white/5 bg-surface-2 px-3 py-2 text-right text-sm text-ink outline-none transition-colors duration-200 focus:border-accent/60 focus:ring-2 focus:ring-accent/25 disabled:cursor-not-allowed disabled:opacity-60'

function formatarHoras(horas: number): string {
  return String(horas).replace('.', ',')
}

/** Os fallbacks por impacto vão para o fim, separados das regras medidas. */
function ordenar(linhas: EsforcoDaRegra[]): EsforcoDaRegra[] {
  const fallback = (r: EsforcoDaRegra) => (r.regra.startsWith('impacto_') ? 1 : 0)
  return [...linhas].sort((a, b) => fallback(a) - fallback(b) || a.titulo.localeCompare(b.titulo, 'pt-BR'))
}

interface Props {
  isAdmin: boolean
}

/**
 * Configurações › Esforço por regra: as horas padrão que viram itens quando
 * a proposta é montada a partir do diagnóstico do Scan. Salva linha a linha
 * (ao sair do campo ou ao ligar/desligar), sem botão geral — cada regra é
 * uma decisão independente, e a tabela é longa para exigir um "salvar tudo".
 */
export default function EsforcoPorRegraCard({ isAdmin }: Props) {
  const prefersReducedMotion = useReducedMotion()
  const esforcos = useEsforcoPorRegra()
  const atualizar = useAtualizarEsforco()
  const [rascunhos, setRascunhos] = useState<Record<string, string>>({})
  const [erros, setErros] = useState<Record<string, string>>({})
  const [salvaEm, setSalvaEm] = useState<Record<string, number>>({})

  const linhas = ordenar(esforcos.data ?? [])

  const salvarHoras = (linha: EsforcoDaRegra) => {
    const texto = rascunhos[linha.regra]
    if (texto === undefined) return
    const horas = horasDoTexto(texto)
    if (horas === null) {
      setErros((e) => ({ ...e, [linha.regra]: 'Use um número de horas, como 1,5.' }))
      return
    }
    setErros(({ [linha.regra]: _ignorado, ...resto }) => resto)
    setRascunhos(({ [linha.regra]: _ignorado, ...resto }) => resto)
    if (horas === linha.horas) return
    atualizar.mutate(
      { regra: linha.regra, horas },
      {
        onSuccess: () => setSalvaEm((s) => ({ ...s, [linha.regra]: Date.now() })),
        onError: () => setErros((e) => ({ ...e, [linha.regra]: 'Não foi possível salvar. Tente de novo.' })),
      }
    )
  }

  const alternarAtivo = (linha: EsforcoDaRegra) => {
    atualizar.mutate(
      { regra: linha.regra, ativo: !linha.ativo },
      {
        onError: () => setErros((e) => ({ ...e, [linha.regra]: 'Não foi possível salvar. Tente de novo.' })),
      }
    )
  }

  return (
    <motion.section
      initial={prefersReducedMotion ? undefined : { opacity: 0, y: 8 }}
      animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1], delay: prefersReducedMotion ? 0 : 0.08 }}
      className="rounded-2xl border border-white/5 bg-surface-1 p-6 sm:p-7"
      aria-labelledby="esforco-heading"
    >
      <div>
        <h2 id="esforco-heading" className="text-lg font-semibold text-ink">
          Esforço por regra do Scan
        </h2>
        <p className="mt-0.5 text-xs font-light text-muted">
          Horas padrão de cada correção. "Montar a partir do diagnóstico" usa horas × valor da hora
          para preencher a proposta; desligue o que o lojista resolve sozinho.
        </p>
      </div>

      {!isAdmin && (
        <p role="status" className="mt-4 rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-xs text-muted">
          Apenas administradores podem editar as horas.
        </p>
      )}

      {esforcos.isLoading && <p className="mt-6 text-sm text-muted">Carregando…</p>}
      {esforcos.isError && (
        <p role="alert" className="mt-6 text-sm text-red-400">
          Não foi possível carregar as regras. Recarregue a página.
        </p>
      )}

      {linhas.length > 0 && (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] font-medium uppercase tracking-widest text-muted">
                <th scope="col" className="pb-2 pr-4 font-medium">Regra</th>
                <th scope="col" className="pb-2 pr-4 text-right font-medium">Horas</th>
                <th scope="col" className="pb-2 font-medium">Na proposta</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((linha) => {
                const valor = rascunhos[linha.regra] ?? formatarHoras(linha.horas)
                const erro = erros[linha.regra]
                const fallback = linha.regra.startsWith('impacto_')
                return (
                  <tr
                    key={linha.regra}
                    data-testid={`esforco-${linha.regra}`}
                    className={`border-t border-white/5 ${linha.ativo ? '' : 'opacity-60'}`}
                  >
                    <td className="py-2.5 pr-4">
                      <span className="text-ink">{linha.titulo}</span>
                      <span className="mt-0.5 block font-mono text-[11px] text-muted/70">
                        {fallback ? 'fallback · ' : ''}
                        {linha.regra}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 text-right">
                      <label className="inline-flex flex-col items-end gap-1">
                        <span className="sr-only">Horas para {linha.titulo}</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={valor}
                          disabled={!isAdmin}
                          onChange={(e) => setRascunhos((r) => ({ ...r, [linha.regra]: e.target.value }))}
                          onBlur={() => salvarHoras(linha)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              e.currentTarget.blur()
                            }
                          }}
                          className={inputClass}
                        />
                        {erro && <span className="text-xs text-red-400">{erro}</span>}
                        {!erro && salvaEm[linha.regra] && rascunhos[linha.regra] === undefined && (
                          <span className="text-[11px] text-emerald-400">Salvo.</span>
                        )}
                      </label>
                    </td>
                    <td className="py-2.5">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={linha.ativo}
                        aria-label={`${linha.ativo ? 'Tirar' : 'Incluir'} "${linha.titulo}" na proposta automática`}
                        disabled={!isAdmin || atualizar.isPending}
                        onClick={() => alternarAtivo(linha)}
                        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 disabled:cursor-not-allowed ${
                          linha.ativo ? 'bg-accent' : 'bg-white/10'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 rounded-full bg-white transition-transform duration-200 ${
                            linha.ativo ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </motion.section>
  )
}
