import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

export interface TestimonialAuthor {
  name: string
  handle: string
  avatar: string
}

export interface TestimonialCardProps {
  author: TestimonialAuthor
  text: string
  href?: string
  className?: string
}

export function TestimonialCard({ author, text, href, className }: TestimonialCardProps) {
  const Card = href ? 'a' : 'div'

  return (
    <Card
      {...(href ? { href, target: '_blank', rel: 'noopener noreferrer' } : {})}
      className={cn(
        'flex w-[300px] shrink-0 flex-col sm:w-[320px]',
        'rounded-2xl border border-[#22221B] bg-[#141410]',
        'p-4 text-start sm:p-6',
        'transition-colors duration-300 hover:border-accent',
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <Avatar className="h-12 w-12 ring-1 ring-[#22221B]">
          <AvatarImage src={author.avatar} alt={author.name} loading="lazy" />
          <AvatarFallback className="bg-accent/20 font-medium text-ink">
            {author.name.charAt(0)}
          </AvatarFallback>
        </Avatar>
        <div className="flex flex-col items-start">
          <h3 className="text-md font-medium leading-none text-ink">{author.name}</h3>
          <p className="mt-1 text-sm text-accent">{author.handle}</p>
        </div>
      </div>
      <p className="sm:text-md mt-4 text-sm font-light leading-relaxed text-muted">
        {text}
      </p>
    </Card>
  )
}
