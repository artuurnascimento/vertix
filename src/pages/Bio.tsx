import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  ArrowDown,
  ArrowUp,
  ExternalLink,
  Eye,
  EyeOff,
  Link2,
  Pencil,
  Plus,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Tables } from '../lib/database.types'
import { BIO_PUBLIC_BASE } from '../lib/publicUrls'
import ConfirmDeleteButton from '../components/finance/ConfirmDeleteButton'
import BioLinkModal from '../components/bio-admin/BioLinkModal'
import BioPainelResumo from '../components/bio-admin/BioPainelResumo'
import BioConteudo from '../components/bio/BioConteudo'
import { linksVisiveis } from '../components/bio/bioLinks'
import type { BioLink } from '../components/bio/bioLinks'

/**
 * Módulo do link de bio: os botões da página pública, editáveis sem deploy.
 * A prévia ao lado usa o mesmo componente da página real, então o que se vê
 * aqui é o que o visitante vê.
 */

type BioLinkRow = Tables<'bio_links'>

/** Referência estável enquanto a consulta não respondeu (evita recalcular). */
const VAZIO: BioLinkRow[] = []

const FORMATO_PILL: Record<string, string> = {
  destaque: 'border-accent/30 bg-accent/10 text-accent',
  largo: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300',
  grade: 'border-white/10 bg-white/5 text-muted',
}

/** Registro do banco no formato que os componentes da página consomem. */
function paraBioLink(row: BioLinkRow): BioLink {
  return {
    id: row.id,
    rotulo: row.rotulo,
    descricao: row.descricao,
    chamada: row.chamada,
    texto_botao: row.texto_botao,
    icone: row.icone,
    formato: row.formato as BioLink['formato'],
    tipo_destino: row.tipo_destino as BioLink['tipo_destino'],
    destino: row.destino,
    mensagem: row.mensagem,
    posicao: row.posicao,
    ativo: row.ativo,
    inicia_em: row.inicia_em,
    termina_em: row.termina_em,
  }
}

export default function Bio() {
  const queryClient = useQueryClient()
  const prefersReducedMotion = useReducedMotion()
  const [modalOpen, setModalOpen] = useState(false)
  const [emEdicao, setEmEdicao] = useState<BioLinkRow | null>(null)

  const { data: links, isLoading } = useQuery({
    queryKey: ['bio-links-admin'],
    queryFn: async (): Promise<BioLinkRow[]> => {
      const { data, error } = await supabase
        .from('bio_links')
        .select('*')
        .order('posicao', { ascending: true })
      if (error) throw new Error(error.message)
      return data
    },
  })

  const invalidar = async () => {
    await queryClient.invalidateQueries({ queryKey: ['bio-links-admin'] })
    // A página pública lê por outra chave; mantém as duas em dia.
    await queryClient.invalidateQueries({ queryKey: ['bio-links'] })
  }

  const alternarAtivo = useMutation({
    mutationFn: async (link: BioLinkRow) => {
      const { error } = await supabase
        .from('bio_links')
        .update({ ativo: !link.ativo })
        .eq('id', link.id)
      if (error) throw new Error(error.message)
    },
    onSuccess: invalidar,
  })

  /** Troca a posição de dois botões — não renumera a lista inteira. */
  const trocarPosicao = useMutation({
    mutationFn: async ({ a, b }: { a: BioLinkRow; b: BioLinkRow }) => {
      const { error: e1 } = await supabase
        .from('bio_links')
        .update({ posicao: b.posicao })
        .eq('id', a.id)
      if (e1) throw new Error(e1.message)
      const { error: e2 } = await supabase
        .from('bio_links')
        .update({ posicao: a.posicao })
        .eq('id', b.id)
      if (e2) throw new Error(e2.message)
    },
    onSuccess: invalidar,
  })

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('bio_links').delete().eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: invalidar,
  })

  const lista = links ?? VAZIO

  const previa = useMemo(
    () => linksVisiveis(lista.map(paraBioLink), new Date()),
    [lista]
  )

  const proximaPosicao =
    lista.length === 0 ? 10 : Math.max(...lista.map((l) => l.posicao)) + 10

  const abrirNovo = () => {
    setEmEdicao(null)
    setModalOpen(true)
  }

  const abrirEdicao = (link: BioLinkRow) => {
    setEmEdicao(link)
    setModalOpen(true)
  }

  return (
    <div className="pb-16">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="hero-heading font-kanit text-4xl font-bold leading-tight sm:text-5xl">
            Link de bio
          </h1>
          <p className="mt-2 max-w-xl text-sm font-light text-muted">
            Os atalhos de bio.vertix.studio. Editar aqui muda a página na hora,
            sem publicar de novo.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <a
            href={BIO_PUBLIC_BASE}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 touch-manipulation items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 font-kanit text-sm font-medium text-muted transition-colors duration-150 hover:bg-white/5 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <ExternalLink className="h-4 w-4" />
            Abrir página
          </a>
          <button
            type="button"
            onClick={abrirNovo}
            className="inline-flex min-h-11 touch-manipulation items-center gap-2 rounded-xl bg-accent px-5 py-2.5 font-kanit text-sm font-semibold text-white shadow-lg shadow-accent/25 transition-colors duration-200 hover:bg-accent-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <Plus size={16} strokeWidth={2.5} />
            Novo botão
          </button>
        </div>
      </div>

      <div className="mt-8">
        <BioPainelResumo botoes={lista.map((l) => ({ id: l.id, rotulo: l.rotulo }))} />
      </div>

      <div className="mt-8 grid gap-8 xl:grid-cols-[1fr_340px]">
        <div>
          {isLoading && (
            <div className="space-y-3">
              {Array.from({ length: 3 }, (_, i) => (
                <div
                  key={i}
                  className="h-20 animate-pulse rounded-xl bg-surface-1"
                  style={{ opacity: 1 - i * 0.3 }}
                />
              ))}
            </div>
          )}

          {!isLoading && lista.length === 0 && (
            <div className="rounded-xl border border-white/5 bg-surface-1 px-6 py-14 text-center">
              <Link2 className="mx-auto h-8 w-8 text-muted/50" />
              <p className="mt-3 text-sm font-light text-muted">
                Nenhum botão ainda. Crie o primeiro atalho da página.
              </p>
            </div>
          )}

          {!isLoading && lista.length > 0 && (
            <ul aria-label="Botões do link de bio" className="flex list-none flex-col gap-3 p-0">
              <AnimatePresence initial={false}>
                {lista.map((link, i) => (
                  <motion.li
                    key={link.id}
                    initial={
                      prefersReducedMotion ? undefined : { opacity: 0, y: 8 }
                    }
                    animate={{ opacity: 1, y: 0 }}
                    exit={prefersReducedMotion ? undefined : { opacity: 0 }}
                    className={`rounded-xl border border-white/5 bg-surface-1 ${
                      link.ativo ? '' : 'opacity-55'
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-4">
                      <div className="flex flex-col gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            trocarPosicao.mutate({ a: link, b: lista[i - 1] })
                          }
                          disabled={i === 0 || trocarPosicao.isPending}
                          aria-label={`Subir ${link.rotulo}`}
                          className="rounded p-0.5 text-muted transition-colors duration-150 hover:text-ink disabled:opacity-25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            trocarPosicao.mutate({ a: link, b: lista[i + 1] })
                          }
                          disabled={
                            i === lista.length - 1 || trocarPosicao.isPending
                          }
                          aria-label={`Descer ${link.rotulo}`}
                          className="rounded p-0.5 text-muted transition-colors duration-150 hover:text-ink disabled:opacity-25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <div className="min-w-0 flex-1 basis-48">
                        <p className="truncate text-sm font-medium text-ink">
                          {link.rotulo}
                        </p>
                        <p className="mt-0.5 truncate font-mono text-xs font-light text-muted">
                          {link.destino === '' ? 'sem destino' : link.destino}
                        </p>
                      </div>

                      <span
                        className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${
                          FORMATO_PILL[link.formato] ?? FORMATO_PILL.grade
                        }`}
                      >
                        {link.formato}
                      </span>

                      <button
                        type="button"
                        onClick={() => alternarAtivo.mutate(link)}
                        aria-label={
                          link.ativo
                            ? `Esconder ${link.rotulo}`
                            : `Mostrar ${link.rotulo}`
                        }
                        className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-muted transition-colors duration-150 hover:bg-white/5 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                      >
                        {link.ativo ? (
                          <>
                            <Eye className="h-3.5 w-3.5" />
                            Visível
                          </>
                        ) : (
                          <>
                            <EyeOff className="h-3.5 w-3.5" />
                            Escondido
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => abrirEdicao(link)}
                        aria-label={`Editar ${link.rotulo}`}
                        className="rounded-lg p-2 text-muted transition-colors duration-150 hover:bg-white/5 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>

                      <ConfirmDeleteButton
                        label={`Excluir ${link.rotulo}`}
                        onConfirm={() => excluir.mutate(link.id)}
                      />
                    </div>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}
        </div>

        <aside className="hidden xl:block">
          <p className="text-xs font-medium uppercase tracking-widest text-muted">
            Prévia
          </p>
          <div className="mt-3 rounded-[28px] border border-white/10 bg-bg p-5">
            <BioConteudo links={previa} inerte />
          </div>
          <p className="mt-3 text-xs font-light text-muted">
            Mostra só o que está visível e dentro da vigência.
          </p>
        </aside>
      </div>

      <BioLinkModal
        open={modalOpen}
        link={emEdicao}
        proximaPosicao={proximaPosicao}
        onClose={() => setModalOpen(false)}
      />
    </div>
  )
}
