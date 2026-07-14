import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import CompanySettingsCard from '../components/settings/CompanySettingsCard'
import BillingSettingsCard from '../components/settings/BillingSettingsCard'
import TeamSettingsCard from '../components/settings/TeamSettingsCard'
import {
  EMPRESA_KEYS,
  settingsToMap,
  VALOR_HORA_KEY,
  type EmpresaFormValues,
  type SettingRow,
} from '../components/settings/settingsSchema'

export default function Configuracoes() {
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'

  const { data: settingsMap, isLoading, isError } = useQuery({
    queryKey: ['settings'],
    queryFn: async (): Promise<Record<string, string>> => {
      const { data, error } = await supabase.from('settings').select('*')
      if (error) throw new Error(error.message)
      return settingsToMap(data as SettingRow[])
    },
  })

  const empresaValues: EmpresaFormValues = Object.fromEntries(
    EMPRESA_KEYS.map((key) => [key, settingsMap?.[key] ?? ''])
  ) as EmpresaFormValues

  const valorHora = settingsMap?.[VALOR_HORA_KEY] ?? ''

  return (
    <div>
      <div>
        <h1 className="hero-heading font-kanit text-4xl font-bold leading-tight sm:text-5xl">
          Configurações
        </h1>
        <p className="mt-2 text-sm font-light text-muted">
          Dados da empresa, faturamento e equipe do painel.
        </p>
      </div>

      {isLoading && (
        <div className="mt-8 space-y-4">
          {Array.from({ length: 3 }, (_, i) => (
            <div
              key={i}
              className="h-40 animate-pulse rounded-2xl bg-surface-1"
              style={{ opacity: 1 - i * 0.2 }}
            />
          ))}
        </div>
      )}

      {isError && (
        <p className="mt-8 rounded-xl border border-white/5 bg-surface-1 px-6 py-8 text-center text-sm text-red-400">
          Não foi possível carregar as configurações. Recarregue a página.
        </p>
      )}

      {!isLoading && !isError && (
        <div className="mt-8 flex flex-col gap-6">
          <CompanySettingsCard values={empresaValues} isAdmin={isAdmin} />
          <BillingSettingsCard value={valorHora} isAdmin={isAdmin} />
          <TeamSettingsCard isAdmin={isAdmin} />
        </div>
      )}
    </div>
  )
}
