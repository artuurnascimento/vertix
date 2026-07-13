import { useState } from 'react'
import AReceberTab from '../components/finance/AReceberTab'
import DespesasTab from '../components/finance/DespesasTab'
import AssinaturasTab from '../components/finance/AssinaturasTab'
import FinanceToast from '../components/finance/FinanceToast'

const TABS = [
  { key: 'a-receber', label: 'A receber' },
  { key: 'despesas', label: 'Despesas' },
  { key: 'assinaturas', label: 'Assinaturas' },
] as const

type TabKey = (typeof TABS)[number]['key']

const TOAST_TIMEOUT_MS = 4000

export default function Financeiro() {
  const [tab, setTab] = useState<TabKey>('a-receber')
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const showToast = (message: string) => {
    setToastMessage(message)
    setTimeout(() => setToastMessage(null), TOAST_TIMEOUT_MS)
  }

  return (
    <div>
      {/* Header da página */}
      <div>
        <h1 className="hero-heading font-kanit text-4xl font-bold leading-tight sm:text-5xl">
          Financeiro
        </h1>
        <p className="mt-2 text-sm font-light text-muted">
          Recebíveis, pagamentos e fluxo de caixa da Vertix.
        </p>
      </div>

      {/* Abas A receber | Despesas | Assinaturas */}
      <div
        role="tablist"
        aria-label="Seções do financeiro"
        className="mt-6 inline-flex gap-1 rounded-xl border border-white/5 bg-surface-1 p-1"
      >
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={[
              'rounded-lg px-4 py-2 text-sm font-medium transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent',
              tab === key
                ? 'bg-accent/15 text-ink'
                : 'text-muted hover:bg-white/5 hover:text-ink',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-8">
        {tab === 'a-receber' && <AReceberTab onLinkError={showToast} />}
        {tab === 'despesas' && <DespesasTab />}
        {tab === 'assinaturas' && <AssinaturasTab />}
      </div>

      <FinanceToast message={toastMessage} />
    </div>
  )
}
