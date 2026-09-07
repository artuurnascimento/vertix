import LogoMark from '../ui/LogoMark'

/**
 * Moldura das telas públicas de checkout: fundo da marca, atmosfera sutil e
 * cabeçalho mínimo. Mesma linguagem visual da página de cobrança que já roda
 * em produção, para o comprador não sentir que trocou de empresa no meio.
 */
export default function CheckoutShell({
  children,
  estreito = false,
}: {
  children: React.ReactNode
  estreito?: boolean
}) {
  return (
    <div className="min-h-screen bg-bg px-4 py-8 font-kanit sm:px-6 sm:py-12">
      <div
        aria-hidden
        className="app-ambient pointer-events-none fixed inset-0"
      />
      <div
        className={`relative mx-auto w-full ${
          estreito ? 'max-w-xl' : 'max-w-5xl'
        }`}
      >
        <header className="flex items-center justify-center gap-2.5">
          <LogoMark className="h-6 w-6" />
          <span className="text-xs font-semibold tracking-[0.35em] text-ink">
            VERTIX
          </span>
        </header>
        {children}
        <footer className="mt-12 flex flex-col items-center gap-1 text-center text-[11px] font-light text-muted/80">
          <p>
            Dúvidas?{' '}
            <a
              href="mailto:contato@vertix.studio"
              className="text-accent underline-offset-2 hover:underline"
            >
              contato@vertix.studio
            </a>
          </p>
          <p>Vertix Studio · CNPJ 54.203.421/0001-49</p>
        </footer>
      </div>
    </div>
  )
}
