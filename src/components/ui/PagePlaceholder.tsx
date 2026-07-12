interface PagePlaceholderProps {
  title: string
  description: string
}

/** Placeholder de fase: título com gradiente do site + aviso "em construção". */
export default function PagePlaceholder({
  title,
  description,
}: PagePlaceholderProps) {
  return (
    <div>
      <h1 className="hero-heading font-kanit text-4xl font-bold leading-tight sm:text-5xl">
        {title}
      </h1>

      <div className="mt-8 rounded-2xl border border-white/5 bg-surface-1 p-8">
        <span className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-accent">
          <span
            aria-hidden
            className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent"
          />
          Em construção
        </span>
        <p className="mt-4 max-w-lg text-sm font-light leading-relaxed text-muted">
          {description}
        </p>
      </div>
    </div>
  )
}
