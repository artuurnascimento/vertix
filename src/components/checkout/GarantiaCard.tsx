import { ShieldCheck } from 'lucide-react'
import type { GarantiaCheckout } from './checkoutTypes'

/**
 * Garantia configurada. Sem garantia no checkout, o card não existe — prometer
 * devolução que ninguém cadastrou é o tipo de frase que volta como chargeback.
 */
export default function GarantiaCard({
  garantia,
}: {
  garantia: GarantiaCheckout | null
}) {
  if (garantia === null) return null

  const dias = `${garantia.dias} ${garantia.dias === 1 ? 'dia' : 'dias'}`

  return (
    <section
      aria-label="Garantia"
      className="flex items-start gap-3.5 rounded-2xl border border-emerald-400/25 bg-emerald-950/40 p-4 sm:p-5"
    >
      <span
        aria-hidden
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-400/15"
      >
        <ShieldCheck className="h-5 w-5 text-emerald-300" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-bold text-ink">Garantia de {dias}</p>
        <p className="mt-1 text-xs font-light leading-relaxed text-muted">
          {garantia.texto ??
            `Não gostou? Peça o reembolso em até ${dias} e devolvemos tudo, sem perguntas.`}
        </p>
      </div>
    </section>
  )
}
