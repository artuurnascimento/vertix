import { useState } from 'react'
import { ScanLine, X } from 'lucide-react'
import { formatBRL } from '../../lib/commercial'
import { useEsforcoPorRegra } from '../settings/esforcoData'
import { itensDoDiagnostico, tituloDaProposta } from './diagnostico'
import { useDiagnosticoDoProjeto } from './diagnosticoData'
import { draftFromItem } from './proposalSchema'
import type { ItemDraft } from './proposalSchema'

interface Props {
  projectId: string
  /** Já há item digitado? Aí a troca pede confirmação, como o modelo. */
  temItensPreenchidos: boolean
  onAplicar: (itens: ItemDraft[], titulo: string) => void
}

const HORAS_FORMATO = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 })

/**
 * "Montar a partir do diagnóstico" — o bloco do formulário de proposta para
 * projetos que nasceram do Scan.
 *
 * Antes, o diagnóstico ficava no relatório e a proposta era digitada do
 * zero, de memória. Aqui os problemas apontados pela análise viram itens com
 * horas padrão (Configurações › Esforço por regra) × valor da hora; a
 * equipe só revisa e envia. Some sozinho quando o projeto não tem análise
 * ligada — o formulário continua o de sempre.
 */
export default function DiagnosticoBloco({ projectId, temItensPreenchidos, onAplicar }: Props) {
  const [ignorado, setIgnorado] = useState(false)
  const [confirmando, setConfirmando] = useState(false)
  const diagnostico = useDiagnosticoDoProjeto(projectId)
  const esforcos = useEsforcoPorRegra(Boolean(diagnostico.data))

  if (ignorado || !diagnostico.data) return null
  const d = diagnostico.data
  const montado = itensDoDiagnostico(d.problemas, esforcos.data ?? [], d.valorHora)
  const semValorHora = d.valorHora <= 0
  const semItens = montado.itens.length === 0
  const total = montado.horas * d.valorHora

  const aplicar = () => {
    onAplicar(montado.itens.map(draftFromItem), tituloDaProposta(d.dominio))
    setConfirmando(false)
  }

  const handleMontar = () => {
    if (temItensPreenchidos) {
      setConfirmando(true)
      return
    }
    aplicar()
  }

  const resumo = [
    d.dominio,
    d.score !== null ? `nota ${d.score.toFixed(1).replace('.', ',')}` : null,
    d.fonte === 'deep'
      ? `${d.problemas.length} ${d.problemas.length === 1 ? 'problema' : 'problemas'} no Raio-X`
      : `${d.problemas.length} ${d.problemas.length === 1 ? 'problema grátis' : 'problemas grátis'} (sem Raio-X completo)`,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <div
      data-testid="diagnostico-bloco"
      className="flex flex-col gap-2.5 rounded-xl border border-accent/25 bg-accent/5 p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <ScanLine className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
          <div>
            <p className="text-sm font-medium text-ink">Montar a partir do diagnóstico</p>
            <p className="mt-0.5 text-xs font-light text-muted">{resumo}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            setIgnorado(true)
            setConfirmando(false)
          }}
          aria-label="Ignorar diagnóstico"
          className="rounded-lg p-1.5 text-muted/60 transition-colors duration-150 hover:bg-white/5 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {semValorHora ? (
        <p className="text-xs leading-relaxed text-amber-300">
          Defina o valor da hora em Configurações para montar os itens.
        </p>
      ) : esforcos.isLoading ? (
        <p className="text-xs text-muted">Carregando horas por regra…</p>
      ) : semItens ? (
        <p className="text-xs leading-relaxed text-amber-300">
          Nenhuma regra ativa com horas em Configurações › Esforço por regra.
        </p>
      ) : (
        <p className="text-xs font-light text-muted">
          {montado.itens.length} {montado.itens.length === 1 ? 'item' : 'itens'} ·{' '}
          {HORAS_FORMATO.format(montado.horas)} h × {formatBRL(d.valorHora)} ={' '}
          <span className="font-medium text-ink">{formatBRL(total)}</span>
          {montado.pulados > 0 && (
            <>
              {' '}
              · {montado.pulados} {montado.pulados === 1 ? 'problema fica' : 'problemas ficam'} de fora
              (regra desativada)
            </>
          )}
        </p>
      )}

      {confirmando ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-400/20 bg-amber-400/10 px-3 py-2.5">
          <span className="text-xs leading-relaxed text-amber-300">Substituir itens atuais?</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setConfirmando(false)}
              className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-muted transition-colors duration-150 hover:bg-white/5 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={aplicar}
              className="rounded-lg bg-amber-400/90 px-3 py-1.5 text-xs font-semibold text-bg transition-colors duration-150 hover:bg-amber-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
            >
              Substituir itens
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleMontar}
          disabled={semValorHora || semItens || esforcos.isLoading}
          className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-accent/40 bg-accent/15 px-3.5 py-1.5 text-xs font-semibold text-accent transition-colors duration-150 hover:bg-accent/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ScanLine className="h-3.5 w-3.5" />
          Montar itens do diagnóstico
        </button>
      )}
    </div>
  )
}
