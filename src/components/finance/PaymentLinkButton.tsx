import { useState } from 'react'
import { Check, Copy, Link2 } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

interface PaymentLinkButtonProps {
  receivableId: string
  paymentLink: string | null
  onError: (message: string) => void
}

const COPIED_TIMEOUT_MS = 2000
const MP_NOT_CONFIGURED_ERROR = 'MP_ACCESS_TOKEN não configurado'

/**
 * Botão de cobrança (fase 9): sem payment_link ainda, "Gerar link" chama a
 * edge function; com payment_link, vira "Copiar link de pagamento".
 */
export default function PaymentLinkButton({
  receivableId,
  paymentLink,
  onError,
}: PaymentLinkButtonProps) {
  const queryClient = useQueryClient()
  const [copied, setCopied] = useState(false)

  const generateLink = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke(
        'create-payment-link',
        { body: { receivable_id: receivableId } }
      )
      if (error) {
        const message =
          (data as { error?: string } | null)?.error ?? error.message
        throw new Error(message)
      }
      return data
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['receivables'] })
    },
    onError: (error: Error) => {
      if (error.message.includes(MP_NOT_CONFIGURED_ERROR)) {
        onError('Configure o Mercado Pago nas variáveis do Supabase.')
      } else {
        onError('Não foi possível gerar o link de pagamento.')
      }
    },
  })

  const handleCopy = async () => {
    if (!paymentLink) return
    await navigator.clipboard.writeText(paymentLink)
    setCopied(true)
    setTimeout(() => setCopied(false), COPIED_TIMEOUT_MS)
  }

  if (paymentLink) {
    return (
      <button
        type="button"
        onClick={handleCopy}
        className="inline-flex items-center gap-1.5 rounded-lg border border-accent/30 bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent transition-colors duration-150 hover:bg-accent/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        {copied ? (
          <>
            <Check className="h-3.5 w-3.5" />
            Copiado!
          </>
        ) : (
          <>
            <Copy className="h-3.5 w-3.5" />
            Copiar link de pagamento
          </>
        )}
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={() => generateLink.mutate()}
      disabled={generateLink.isPending}
      className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-muted transition-colors duration-150 hover:bg-white/5 hover:text-ink disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
    >
      <Link2 className="h-3.5 w-3.5" />
      {generateLink.isPending ? 'Gerando…' : 'Gerar link'}
    </button>
  )
}
