import { Timer } from 'lucide-react'
import { formatarContagem } from './checkoutTotal'
import { useCronometro, type FonteDoCronometro } from './useCronometro'

/**
 * Contagem regressiva — a faixa roxa colada no topo da página, de ponta a
 * ponta. No modo de data, se o prazo já passou o componente não renderiza
 * NADA — sem zerar, sem reiniciar. No modo por visitante (minutos), a
 * contagem parte da primeira abertura e recomeça ao zerar; é o dono da
 * oferta quem escolhe o modo, e o painel diz o que cada um faz.
 */
export default function Cronometro(fonte: FonteDoCronometro) {
  const restante = useCronometro(fonte)
  if (restante === null) return null

  const contagem = formatarContagem(restante)

  return (
    <div
      data-testid="cronometro"
      className="flex items-center justify-center gap-2.5 bg-gradient-to-r from-accent-2 via-accent to-[#8f7aff] px-4 py-2.5 text-white shadow-[0_8px_30px_-12px_rgba(108,91,242,0.7)]"
    >
      <Timer aria-hidden className="h-4 w-4 shrink-0 opacity-90" />
      <p className="text-[13px] font-light tracking-wide sm:text-sm">Esta oferta termina em</p>
      {/* aria-live off: um leitor de tela anunciando cada segundo é tortura.
          A descrição textual é lida uma vez, no rótulo. */}
      <p
        aria-label={`Tempo restante: ${contagem.descricao}`}
        className="text-base font-semibold tabular-nums tracking-wider sm:text-lg"
      >
        <span aria-hidden>{contagem.compacta}</span>
      </p>
    </div>
  )
}
