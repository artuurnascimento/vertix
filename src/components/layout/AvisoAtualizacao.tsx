import { useState } from 'react'
import { Download, X } from 'lucide-react'
import { useVersaoNova } from '../../lib/versao'

/**
 * A faixa "tem versão nova" — a mesma do sistema do despachante: nasce no
 * rodapé, com o botão de atualizar e o de adiar, e aqui traz também o que
 * mudou, para a pessoa saber por que vale recarregar agora. Adiar esconde
 * só esta versão: se sair outra, volta.
 */
export default function AvisoAtualizacao() {
  const nova = useVersaoNova()
  const [adiada, setAdiada] = useState<string | null>(null)
  const [aberta, setAberta] = useState(false)

  if (nova === null || adiada === nova.versao) return null

  const atualizar = () => window.location.reload()

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[calc(env(safe-area-inset-bottom)+5rem)] md:pb-6"
      role="status"
      aria-live="polite"
    >
      <div className="vx-atualizacao pointer-events-auto w-full max-w-md overflow-hidden rounded-2xl bg-accent text-white shadow-[0_18px_40px_-16px_rgba(108,91,242,0.9)]">
        <div className="flex items-center gap-2.5 px-4 py-3 text-sm font-medium">
          <Download aria-hidden className="h-4 w-4 shrink-0" />
          <span className="flex-1">Uma versão nova está pronta.</span>
          <button
            type="button"
            onClick={atualizar}
            className="shrink-0 rounded-full bg-white px-4 py-1.5 text-xs font-bold text-accent-2 transition-opacity hover:opacity-90"
          >
            Atualizar
          </button>
          <button
            type="button"
            onClick={() => setAdiada(nova.versao)}
            aria-label="Atualizar depois"
            className="shrink-0 rounded-full p-1.5 transition-opacity hover:opacity-70"
          >
            <X aria-hidden className="h-4 w-4" />
          </button>
        </div>
        {nova.itens.length > 0 && (
          <div className="border-t border-white/15 bg-black/10 px-4 py-2.5">
            <button
              type="button"
              onClick={() => setAberta((v) => !v)}
              aria-expanded={aberta}
              className="flex w-full items-center justify-between gap-2 text-left text-xs font-semibold uppercase tracking-wider text-white/90"
            >
              <span>O que mudou desde a sua versão</span>
              <span aria-hidden className="text-white/70">
                {aberta ? 'ocultar' : `ver o que mudou (${nova.itens.length})`}
              </span>
            </button>
            {aberta && (
              <ul className="mt-2 flex flex-col gap-1.5 text-[13px] font-light leading-snug text-white/95">
                {nova.itens.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span aria-hidden className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-white/80" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
