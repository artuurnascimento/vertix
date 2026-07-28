import { useEffect, useRef } from 'react'
import LogoMark from '../ui/LogoMark'

interface Tile {
  name: string
  tag: string
  from: string
  to: string
}

const TILES: Tile[] = [
  { name: 'SAAM', tag: 'Sistema · Gestão ambiental', from: '#16123F', to: '#6C5BF2' },
  { name: 'FacePass', tag: 'Sistema · Acesso facial', from: '#0C0C0C', to: '#5546E0' },
  { name: 'England', tag: 'Shopify · E-commerce', from: '#123B4F', to: '#3BB0E0' },
  { name: 'Orizon', tag: 'Sistema · Gestão', from: '#0B1F3A', to: '#9BE22D' },
  { name: 'Vybe', tag: 'App · Social commerce', from: '#2A1E66', to: '#8B7BF6' },
  { name: 'Checkout+', tag: 'Shopify · Conversão', from: '#16123F', to: '#3BB0E0' },
  { name: 'Dash Ambiental', tag: 'Sistema · Dados', from: '#141410', to: '#6C5BF2' },
  { name: 'Migração Woo', tag: 'Shopify · Migração', from: '#1D1140', to: '#6C5BF2' },
  { name: 'Design System', tag: 'Design · UI', from: '#0C0C0C', to: '#8A8A82' },
  { name: 'Integrações', tag: 'API · Automação', from: '#0F2430', to: '#3BB0E0' },
  { name: 'Identidade', tag: 'Design · Marca', from: '#241A5E', to: '#5546E0' },
  { name: 'Landing Pages', tag: 'Web · Performance', from: '#16123F', to: '#6C5BF2' },
  { name: 'Painel Admin', tag: 'Sistema · Backoffice', from: '#0C0C0C', to: '#5546E0' },
  { name: 'ERP Sync', tag: 'API · Integração', from: '#123B4F', to: '#3BB0E0' },
  { name: 'Automação', tag: 'Ops · Fluxos', from: '#141410', to: '#9BE22D' },
  { name: 'Analytics', tag: 'Dados · Relatórios', from: '#2A1E66', to: '#8B7BF6' },
  { name: 'Email & CRM', tag: 'Marketing · Retenção', from: '#1D1140', to: '#6C5BF2' },
  { name: 'SEO', tag: 'Web · Tráfego', from: '#0F2430', to: '#3BB0E0' },
  { name: 'App Mobile', tag: 'Produto · iOS & Android', from: '#0C0C0C', to: '#8A8A82' },
  { name: 'Tema sob medida', tag: 'Shopify · Design', from: '#241A5E', to: '#5546E0' },
  { name: 'Suporte contínuo', tag: 'Parceria · SLA', from: '#16123F', to: '#9BE22D' },
]

const SCROLL_FACTOR = 0.3
const BASE_SHIFT = 200
const ROW_LEFT_BUFFER = -1300

function TileCard({ tile }: { tile: Tile }) {
  return (
    <div
      className="relative h-[270px] w-[420px] shrink-0 overflow-hidden rounded-2xl"
      style={{ background: `linear-gradient(135deg, ${tile.from}, ${tile.to})` }}
    >
      <LogoMark className="absolute -bottom-8 -right-6 w-40 opacity-15" />
      <div className="absolute bottom-5 left-6">
        <p className="text-xs uppercase tracking-widest text-white/60">{tile.tag}</p>
        <p className="text-3xl font-bold uppercase text-white">{tile.name}</p>
      </div>
    </div>
  )
}

export default function MarqueeSection() {
  const sectionRef = useRef<HTMLElement>(null)
  const row1Ref = useRef<HTMLDivElement>(null)
  const row2Ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onScroll = () => {
      const section = sectionRef.current
      if (!section) return
      const offset =
        (window.scrollY - section.offsetTop + window.innerHeight) * SCROLL_FACTOR
      if (row1Ref.current) {
        row1Ref.current.style.transform = `translateX(${offset - BASE_SHIFT}px)`
      }
      if (row2Ref.current) {
        row2Ref.current.style.transform = `translateX(${-(offset - BASE_SHIFT)}px)`
      }
    }

    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const row1 = TILES.slice(0, 11)
  const row2 = TILES.slice(11)

  return (
    <section
      ref={sectionRef}
      className="flex flex-col gap-3 overflow-hidden bg-bg pb-10 pt-24 sm:pt-32 md:pt-40"
      aria-label="Trabalhos e capacidades"
    >
      <div
        ref={row1Ref}
        className="flex w-max gap-3"
        style={{ willChange: 'transform', marginLeft: ROW_LEFT_BUFFER }}
      >
        {[...row1, ...row1, ...row1].map((tile, i) => (
          <TileCard key={`r1-${i}`} tile={tile} />
        ))}
      </div>
      <div
        ref={row2Ref}
        className="flex w-max gap-3"
        style={{ willChange: 'transform', marginLeft: ROW_LEFT_BUFFER }}
      >
        {[...row2, ...row2, ...row2].map((tile, i) => (
          <TileCard key={`r2-${i}`} tile={tile} />
        ))}
      </div>
    </section>
  )
}
