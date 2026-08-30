import { PRODUTO_META } from './appsProxy'
import type { AppProduto } from './appsProxy'
import { SEMAFORO_META } from './lojasStatus'
import type { SemaforoResultado } from './lojasStatus'

/**
 * Badge de produto instalado (recover/reviews) com o semáforo de saúde —
 * o ponto colorido é o estado vivo; os motivos viram tooltip nativo.
 */

interface AppBadgeProps {
  produto: AppProduto
  semaforo: SemaforoResultado
}

export default function AppBadge({ produto, semaforo }: AppBadgeProps) {
  const meta = SEMAFORO_META[semaforo.cor]
  return (
    <span
      title={`${meta.label} — ${semaforo.motivos.join(' ')}`}
      className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[11px] font-medium text-muted"
    >
      <span
        aria-hidden
        className={`h-2 w-2 rounded-full ${meta.dotClass} ${
          semaforo.cor === 'vermelho' ? 'animate-pulse' : ''
        }`}
      />
      {PRODUTO_META[produto].label}
      <span className="sr-only">
        {' '}— {meta.label}: {semaforo.motivos.join(' ')}
      </span>
    </span>
  )
}
