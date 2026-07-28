interface ContactButtonProps {
  label?: string
  href?: string
}

export function ContactButton({
  label = 'Começar projeto',
  href = '#contato',
}: ContactButtonProps) {
  return (
    <a
      href={href}
      className="inline-block whitespace-nowrap rounded-full px-8 py-3 text-xs font-medium uppercase tracking-widest text-white transition-transform duration-200 hover:-translate-y-0.5 sm:px-10 sm:py-3.5 sm:text-sm md:px-12 md:py-4 md:text-base"
      style={{
        background:
          'linear-gradient(123deg, #16123F 7%, #6C5BF2 37%, #5546E0 72%, #3BB0E0 100%)',
        boxShadow:
          '0px 4px 4px rgba(108, 91, 242, 0.25), 4px 4px 12px #5546E0 inset',
        outline: '2px solid #F4F4F0',
        outlineOffset: '-3px',
      }}
    >
      {label}
    </a>
  )
}

interface LiveProjectButtonProps {
  label?: string
}

export function LiveProjectButton({ label = 'Ver projeto' }: LiveProjectButtonProps) {
  return (
    <button
      type="button"
      className="whitespace-nowrap rounded-full border-2 border-ink px-8 py-3 text-sm font-medium uppercase tracking-widest text-ink transition-colors duration-200 hover:bg-ink/10 sm:px-10 sm:py-3.5 sm:text-base"
    >
      {label}
    </button>
  )
}
