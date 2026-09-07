import { AlertTriangle, Clock } from 'lucide-react'
import { Bloco, inputClass, labelClass } from '../produtos/formUi'
import { cronometroExpirado } from './checkoutForm'

interface Props {
  garantiaDias: string
  garantiaTexto: string
  cronometroAte: string
  erroDias?: string
  erroCronometro?: string
  onGarantiaDias: (valor: string) => void
  onGarantiaTexto: (valor: string) => void
  onCronometroAte: (valor: string) => void
}

/**
 * Garantia e cronômetro. O cronômetro é um PRAZO REAL, guardado como instante
 * absoluto: passou a data, a página simplesmente não mostra mais o contador —
 * ele não reinicia a cada visitante nem a cada F5.
 */
export default function GarantiaCronometroBloco({
  garantiaDias,
  garantiaTexto,
  cronometroAte,
  erroDias,
  erroCronometro,
  onGarantiaDias,
  onGarantiaTexto,
  onCronometroAte,
}: Props) {
  const expirado = cronometroExpirado(cronometroAte)

  return (
    <>
      <Bloco titulo="Garantia" ajuda="Aparece perto do botão de compra.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[10rem_1fr]">
          <label className="flex flex-col gap-1.5">
            <span className={labelClass}>Dias</span>
            <input
              type="number"
              min={0}
              value={garantiaDias}
              onChange={(e) => onGarantiaDias(e.target.value)}
              placeholder="7"
              className={`${inputClass} tabular-nums`}
            />
            {erroDias && <span className="text-xs text-red-400">{erroDias}</span>}
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelClass}>Texto</span>
            <input
              type="text"
              value={garantiaTexto}
              onChange={(e) => onGarantiaTexto(e.target.value)}
              placeholder="Se não gostar, devolvemos o valor integral."
              className={inputClass}
            />
          </label>
        </div>
      </Bloco>

      <Bloco
        titulo="Cronômetro"
        ajuda="Prazo real da oferta, com data e hora de fim. Depois desse instante a página não mostra mais o contador — ele não reinicia para cada visitante."
      >
        <label className="flex flex-col gap-1.5">
          <span className={labelClass}>Termina em</span>
          <input
            type="datetime-local"
            value={cronometroAte}
            onChange={(e) => onCronometroAte(e.target.value)}
            className={`${inputClass} tabular-nums`}
          />
          <span className="inline-flex items-center gap-1.5 text-xs font-light text-muted">
            <Clock aria-hidden className="h-3.5 w-3.5" />
            Deixe vazio para vender sem cronômetro.
          </span>
          {expirado && (
            <span className="inline-flex items-center gap-1.5 text-xs text-amber-300">
              <AlertTriangle aria-hidden className="h-3.5 w-3.5" />
              Esse prazo já passou: a página vai abrir sem contador nenhum.
            </span>
          )}
          {erroCronometro && (
            <span className="text-xs text-red-400">{erroCronometro}</span>
          )}
        </label>
      </Bloco>
    </>
  )
}
