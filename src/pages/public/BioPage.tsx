import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import BioConteudo from '../../components/bio/BioConteudo'
import VertixBackground from '../../components/ui/VertixBackground'
import { buscarBioLinks, registrarVisita } from '../../components/bio/bioData'

/**
 * Página pública do link de bio (bio.vertix.studio e /bio em qualquer host).
 * Atalhos rápidos: o visitante deve chegar ao WhatsApp em um toque.
 */

const TITULO = 'Vertix — atalhos rápidos'

function Casca({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen px-5 py-4 font-kanit sm:py-12">
      <VertixBackground />
      <main className="relative mx-auto w-full max-w-sm">{children}</main>
    </div>
  )
}

export default function BioPage() {
  useEffect(() => {
    document.title = TITULO
    registrarVisita()
  }, [])

  const { data, isLoading } = useQuery({
    queryKey: ['bio-links'],
    queryFn: buscarBioLinks,
    retry: false,
  })

  // A marca aparece de imediato; só os botões esperam o banco.
  if (isLoading) {
    return (
      <Casca>
        <BioConteudo links={[]} />
        <div className="mt-4 flex flex-col gap-2.5">
          {Array.from({ length: 3 }, (_, i) => (
            <div
              key={i}
              className="h-14 animate-pulse rounded-xl bg-surface-1"
              style={{ opacity: 1 - i * 0.3 }}
            />
          ))}
        </div>
      </Casca>
    )
  }

  return (
    <Casca>
      <BioConteudo links={data ?? []} />
    </Casca>
  )
}
