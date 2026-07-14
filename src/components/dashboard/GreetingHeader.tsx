import { useAuth } from '../../lib/auth'

const MORNING_END_HOUR = 12
const AFTERNOON_END_HOUR = 18

/** Saudação por hora local — "Bom dia," / "Boa tarde," / "Boa noite,". */
function greetingForHour(hour: number): string {
  if (hour < MORNING_END_HOUR) return 'Bom dia'
  if (hour < AFTERNOON_END_HOUR) return 'Boa tarde'
  return 'Boa noite'
}

/** Primeiro nome a partir do nome completo do profile. */
function firstNameOf(fullName: string | null | undefined): string | null {
  if (!fullName) return null
  const trimmed = fullName.trim()
  if (trimmed === '') return null
  return trimmed.split(/\s+/)[0]
}

/**
 * Topo do dashboard — eyebrow com saudação viva + nome, h1 fixo "Visão geral"
 * (contrato E2E: texto e nível do heading não podem mudar).
 */
export default function GreetingHeader() {
  const { profile } = useAuth()
  const greeting = greetingForHour(new Date().getHours())
  const firstName = firstNameOf(profile?.nome)

  return (
    <div className="flex flex-col gap-1">
      <p className="text-[11px] font-medium uppercase tracking-[0.25em] text-muted/70">
        {greeting}
        {firstName ? `, ${firstName}` : ','}
      </p>
      <h1 className="hero-heading font-kanit text-2xl font-bold leading-tight sm:text-3xl">
        Visão geral
      </h1>
    </div>
  )
}
