import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { FolderKanban, Search, User } from 'lucide-react'
import { supabase } from '../../lib/supabase'

interface ResultadoBusca {
  id: string
  titulo: string
  detalhe: string | null
  tipo: 'cliente' | 'projeto'
}

const MAX_RESULTADOS = 6

/**
 * Busca rápida do header (⌘K): filtra clientes e projetos localmente sobre
 * uma carga única leve, navegando para o detalhe ao selecionar.
 */
export default function QuickSearch() {
  const [query, setQuery] = useState('')
  const [focado, setFocado] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
      }
      if (e.key === 'Escape') inputRef.current?.blur()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const { data } = useQuery({
    queryKey: ['quick-search'],
    enabled: focado,
    staleTime: 60_000,
    queryFn: async (): Promise<ResultadoBusca[]> => {
      const [clientes, projetos] = await Promise.all([
        supabase.from('clients').select('id, nome, empresa'),
        supabase.from('projects').select('id, nome'),
      ])
      if (clientes.error) throw new Error(clientes.error.message)
      if (projetos.error) throw new Error(projetos.error.message)
      return [
        ...clientes.data.map(
          (c): ResultadoBusca => ({
            id: c.id,
            titulo: c.nome,
            detalhe: c.empresa,
            tipo: 'cliente',
          })
        ),
        ...projetos.data.map(
          (p): ResultadoBusca => ({
            id: p.id,
            titulo: p.nome,
            detalhe: null,
            tipo: 'projeto',
          })
        ),
      ]
    },
  })

  const termo = query.trim().toLowerCase()
  const resultados =
    termo.length < 2
      ? []
      : (data ?? [])
          .filter(
            (r) =>
              r.titulo.toLowerCase().includes(termo) ||
              (r.detalhe ?? '').toLowerCase().includes(termo)
          )
          .slice(0, MAX_RESULTADOS)

  const abrir = (r: ResultadoBusca) => {
    navigate(
      r.tipo === 'cliente' ? `/admin/clientes/${r.id}` : `/admin/projetos/${r.id}`
    )
    setQuery('')
    inputRef.current?.blur()
  }

  return (
    <div className="relative w-full max-w-sm">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
      <input
        ref={inputRef}
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setFocado(true)}
        onBlur={() => setTimeout(() => setFocado(false), 150)}
        placeholder="Buscar..."
        aria-label="Buscar clientes e projetos"
        className="w-full rounded-xl border border-white/10 bg-surface-2/80 py-2 pl-9 pr-12 text-sm text-ink placeholder:text-muted/60 transition-colors duration-200 focus:border-accent/40 focus:outline-none focus:ring-1 focus:ring-accent/30"
      />
      <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] font-medium text-muted">
        ⌘K
      </kbd>

      {focado && resultados.length > 0 && (
        <ul className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-white/10 bg-surface-1 py-1 shadow-2xl shadow-black/60">
          {resultados.map((r) => (
            <li key={`${r.tipo}-${r.id}`}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => abrir(r)}
                className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors duration-150 hover:bg-accent/10"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/5">
                  {r.tipo === 'cliente' ? (
                    <User className="h-3.5 w-3.5 text-sky-300" />
                  ) : (
                    <FolderKanban className="h-3.5 w-3.5 text-accent" />
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm text-ink">
                    {r.titulo}
                  </span>
                  <span className="block truncate text-[11px] text-muted">
                    {r.tipo === 'cliente'
                      ? (r.detalhe ?? 'Cliente')
                      : 'Projeto'}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
