import { AlarmClock } from 'lucide-react'
import { CRONOMETRO_TEXTO_PADRAO, formatarContagem } from './checkoutTotal'
import { useCronometro, type FonteDoCronometro } from './useCronometro'

/** Abaixo disto os dígitos pulsam: é o último minuto. */
const ULTIMO_MINUTO_MS = 60_000

/**
 * Contagem regressiva — a faixa roxa colada no topo da página, de ponta a
 * ponta: o tempo grande, o despertador que "toca" de vez em quando e a
 * frase. Embaixo, uma linha fina mostra o tempo se esgotando (só no modo
 * por visitante, que tem um total conhecido); no último minuto os dígitos
 * pulsam e, esgotado, o 00:00 fica piscando. Tudo respeita
 * `prefers-reduced-motion` (ver index.css).
 *
 * No modo de data, se o prazo já passou o componente não renderiza NADA —
 * sem zerar, sem reiniciar. No modo por visitante (minutos), a contagem
 * parte do tempo cheio a cada abertura da página e trava em 00:00 até a
 * pessoa sair; é o dono da oferta quem escolhe o modo, e o painel diz o que
 * cada um faz.
 */
export default function Cronometro({
  texto,
  corFundo,
  corTexto,
  ...fonte
}: FonteDoCronometro & {
  texto?: string | null
  /** "#rrggbb"; sem ela, o gradiente roxo da Vertix. */
  corFundo?: string | null
  /** "#rrggbb"; sem ela, branco. */
  corTexto?: string | null
}) {
  const restante = useCronometro(fonte)
  if (restante === null) return null

  const contagem = formatarContagem(restante)
  const total = fonte.minutos ? fonte.minutos * 60_000 : null
  const fracao = total ? Math.min(Math.max(restante / total, 0), 1) : null
  const urgente = restante <= ULTIMO_MINUTO_MS
  const esgotado = restante === 0

  return (
    <div
      data-testid="cronometro"
      data-urgente={urgente || undefined}
      data-esgotado={esgotado || undefined}
      className={`vx-cronometro relative isolate flex items-center justify-center gap-5 overflow-hidden px-4 py-3 sm:gap-8 sm:py-3.5 ${
        corFundo
          ? 'shadow-[0_10px_34px_-14px_rgba(0,0,0,0.6)]'
          : 'bg-gradient-to-r from-accent-2 via-accent to-[#8f7aff] shadow-[0_10px_34px_-14px_rgba(108,91,242,0.85)]'
      } ${corTexto ? '' : 'text-white'}`}
      style={{
        ...(corFundo ? { background: corFundo } : {}),
        ...(corTexto ? { color: corTexto } : {}),
      }}
    >
      {/* Brilho diagonal parado: dá volume à faixa sem chamar atenção. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(105deg,transparent_35%,rgba(255,255,255,0.12)_50%,transparent_65%)]"
      />
      {/* aria-live off: um leitor de tela anunciando cada segundo é tortura.
          A descrição textual é lida uma vez, no rótulo. */}
      <p
        aria-label={`Tempo restante: ${contagem.descricao}`}
        className={`text-2xl font-semibold leading-none tabular-nums tracking-[0.08em] sm:text-[28px] ${
          esgotado ? 'vx-cronometro-pisca' : urgente ? 'vx-cronometro-pulso' : ''
        }`}
      >
        <span aria-hidden>{contagem.compacta}</span>
      </p>
      <AlarmClock aria-hidden className="vx-cronometro-sino h-6 w-6 shrink-0 sm:h-7 sm:w-7" strokeWidth={2} />
      <p className="text-[13px] font-light tracking-wide opacity-90 sm:text-[15px]">
        {texto?.trim() || CRONOMETRO_TEXTO_PADRAO}
      </p>
      {fracao !== null && (
        <span aria-hidden className="absolute inset-x-0 bottom-0 h-[3px] bg-black/20">
          {/* currentColor: a linha acompanha a cor do texto, seja ela qual for. */}
          {/* scaleX, não width: a cada segundo a barra encolhe um pouco, e
              animar width é layout + pintura da faixa inteira a 60 fps
              durante os 15 minutos; transform fica no compositor. */}
          <span
            className="vx-cronometro-barra block h-full w-full origin-left bg-current opacity-85"
            style={{ transform: `scaleX(${fracao})` }}
          />
        </span>
      )}
    </div>
  )
}
