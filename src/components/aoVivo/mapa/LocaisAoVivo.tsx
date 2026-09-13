import { bandeira } from '../aoVivoResumo'
import type { LocalResumo } from './locais'

/**
 * "Sessões por local", como no Live View: uma barra por cidade, a maior
 * primeiro. Passar o mouse numa linha acende os pontos daquele lugar no
 * mapa (onDestacar recebe os ids das sessões de lá).
 */

interface Props {
  locais: readonly LocalResumo[]
  onDestacar: (ids: readonly string[]) => void
}

const MAXIMO_DE_LINHAS = 8

export default function LocaisAoVivo({ locais, onDestacar }: Props) {
  const visiveis = locais.slice(0, MAXIMO_DE_LINHAS)
  const maior = visiveis[0]?.total ?? 0

  return (
    <section
      aria-labelledby="locais-titulo"
      className="rounded-xl border border-white/5 bg-surface-1 px-4 py-3"
    >
      <h3
        id="locais-titulo"
        className="text-[10px] font-medium uppercase tracking-widest text-muted"
      >
        Sessões por local
      </h3>
      {visiveis.length === 0 ? (
        <p className="mt-3 text-xs font-light text-muted">
          Nenhuma visita com localização ainda.
        </p>
      ) : (
        <ol
          className="mt-3 flex list-none flex-col gap-2.5 p-0"
          onPointerLeave={() => onDestacar([])}
        >
          {visiveis.map((local) => {
            const flag = bandeira(local.pais)
            return (
              <li
                key={local.chave}
                className="group cursor-default"
                onPointerEnter={() => onDestacar(local.ids)}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-xs text-ink/85 group-hover:text-ink">
                    {flag ? `${flag} ` : ''}
                    {local.rotulo}
                    {local.agora > 0 && (
                      <span className="ml-2 text-[10px] font-medium uppercase tracking-wider text-emerald-300">
                        {local.agora} agora
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 tabular-nums text-xs font-semibold text-ink">
                    {local.total.toLocaleString('pt-BR')}
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/5">
                  <div
                    className={`h-full rounded-full ${
                      local.compraram > 0 ? 'bg-accent' : 'bg-sky-400/80'
                    }`}
                    style={{
                      width: `${maior > 0 ? Math.max(4, (local.total / maior) * 100) : 0}%`,
                    }}
                  />
                </div>
              </li>
            )
          })}
        </ol>
      )}
      {locais.length > MAXIMO_DE_LINHAS && (
        <p className="mt-2 text-[11px] font-light text-muted">
          + {locais.length - MAXIMO_DE_LINHAS} outros lugares
        </p>
      )}
    </section>
  )
}
