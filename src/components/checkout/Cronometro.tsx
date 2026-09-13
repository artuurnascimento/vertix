import { Timer } from 'lucide-react'
import { formatarContagem } from './checkoutTotal'
import { useCronometro, type FonteDoCronometro } from './useCronometro'

/**
 * Contagem regressiva. No modo de data, se o prazo já passou o componente não
 * renderiza NADA — sem zerar, sem reiniciar. No modo por visitante (minutos),
 * a contagem parte da primeira abertura e recomeça ao zerar; é o dono da
 * oferta quem escolhe o modo, e o painel diz o que cada um faz.
 */
export default function Cronometro(fonte: FonteDoCronometro) {
  const restante = useCronometro(fonte)
  if (restante === null) return null

  const contagem = formatarContagem(restante)

  return (
    <div className="flex items-center justify-center gap-3 rounded-xl border border-amber-400/25 bg-amber-400/10 px-4 py-2.5 text-amber-200">
      <Timer aria-hidden className="h-4 w-4 shrink-0" />
      <p className="text-xs font-light">Esta oferta termina em</p>
      {/* aria-live off: um leitor de tela anunciando cada segundo é tortura.
          A descrição textual é lida uma vez, no rótulo. */}
      <p
        aria-label={`Tempo restante: ${contagem.descricao}`}
        className="flex items-center gap-1 text-sm font-semibold tabular-nums"
      >
        <Bloco valor={contagem.horas} />
        <span aria-hidden>:</span>
        <Bloco valor={contagem.minutos} />
        <span aria-hidden>:</span>
        <Bloco valor={contagem.segundos} />
      </p>
    </div>
  )
}

function Bloco({ valor }: { valor: string }) {
  return (
    <span
      aria-hidden
      className="rounded-md bg-amber-400/15 px-1.5 py-0.5 text-amber-100"
    >
      {valor}
    </span>
  )
}
