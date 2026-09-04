import { LEAD_STATUSES, type LeadStatus } from './raioxTypes'

/**
 * Status do lead como badges clicáveis (novo → contatado → reunião → cliente).
 * O ativo ganha cor cheia; clicar em outro dispara a troca no banco.
 */

export const STATUS_LEAD_META: Record<
  LeadStatus,
  { label: string; active: string }
> = {
  novo: {
    label: 'Novo',
    active: 'border-accent/40 bg-accent/15 text-accent',
  },
  contatado: {
    label: 'Contatado',
    active: 'border-sky-400/30 bg-sky-400/10 text-sky-300',
  },
  reuniao: {
    label: 'Reunião',
    active: 'border-amber-400/30 bg-amber-400/10 text-amber-300',
  },
  cliente: {
    label: 'Cliente',
    active: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300',
  },
}

interface LeadStatusPickerProps {
  value: LeadStatus
  onChange: (status: LeadStatus) => void
  disabled?: boolean
}

export default function LeadStatusPicker({
  value,
  onChange,
  disabled = false,
}: LeadStatusPickerProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Status do lead"
      className="flex flex-wrap items-center gap-1"
    >
      {LEAD_STATUSES.map((status) => {
        const meta = STATUS_LEAD_META[status]
        const isActive = value === status
        return (
          <button
            key={status}
            type="button"
            role="radio"
            aria-checked={isActive}
            disabled={disabled || isActive}
            onClick={() => onChange(status)}
            className={[
              'rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent',
              isActive
                ? meta.active
                : 'border-white/10 bg-transparent text-muted hover:bg-white/5 hover:text-ink',
              disabled && !isActive ? 'cursor-wait opacity-60' : '',
            ].join(' ')}
          >
            {meta.label}
          </button>
        )
      })}
    </div>
  )
}
