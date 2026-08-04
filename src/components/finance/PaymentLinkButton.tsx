import { useState } from 'react'
import { Check, Copy, Link2 } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { pagarPublicUrl } from '../../lib/publicUrls'

interface PaymentLinkButtonProps {
  receivableId: string
  paymentToken: string
  paymentLink: string | null
  onError: (message: string) => void
}

const COPIED_TIMEOUT_MS = 2000

/**
 * Botão de cobrança: gera o link da NOSSA página de pagamento
 * (/pagar/:payment_token) e o grava em payment_link — é essa URL que os
 * lembretes de e-mail usam. Com link gerado, vira "Copiar link de pagamento".
 */
export default function PaymentLinkButton({
  receivableId,
  paymentToken,
  paymentLink,
  onError,
}: PaymentLinkButtonProps) {
  const queryClient = useQueryClient()
  const [copied, setCopied] = useState(false)

  const generateLink = useMutation({
    mutationFn: async () => {
      const url = pagarPublicUrl(paymentToken)
      const { error } = await supabase
        .from('receivables')
        .update({ payment_link: url })
        .eq('id', receivableId)
      if (error) throw new Error(error.message)
      return url
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['receivables'] })
    },
    onError: () => {
      onError('Não foi possível gerar o link de pagamento.')
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
