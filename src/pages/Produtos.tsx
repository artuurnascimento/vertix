import { useMemo, useState } from 'react'
import { Package, Plus, Search } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ehTabelaAusente } from '../components/produtos/catalogoSupabase'
import { excluirProduto, fetchProdutos } from '../components/produtos/produtosData'
import type { Produto } from '../components/produtos/produtosData'
import ProdutoFormModal from '../components/produtos/ProdutoFormModal'
import ProdutosTable from '../components/produtos/ProdutosTable'
import ConfirmacaoModal from '../components/ui/ConfirmacaoModal'
import Toast, { useToast } from '../components/ui/Toast'

/**
 * Catálogo de produtos vendidos nos checkouts da Vertix (produto principal,
 * order bump, upsell e downsell). Preço é digitado em reais e guardado em
 * centavos — a conversão mora em components/produtos/precos.ts.
 */

const SKELETON_ROWS = 4

export default function Produtos() {
  const queryClient = useQueryClient()
  const { toast, mostrar } = useToast()

  const [busca, setBusca] = useState('')
  const [formAberto, setFormAberto] = useState(false)
  const [emEdicao, setEmEdicao] = useState<Produto | null>(null)
  const [paraExcluir, setParaExcluir] = useState<Produto | null>(null)

  const produtosQuery = useQuery({
    queryKey: ['produtos'],
    queryFn: fetchProdutos,
    retry: false,
  })

  const excluirMutation = useMutation({
    mutationFn: (id: string) => excluirProduto(id),
    onSuccess: async () => {
      const nome = paraExcluir?.nome ?? 'Produto'
      setParaExcluir(null)
      await queryClient.invalidateQueries({ queryKey: ['produtos'] })
      mostrar({ texto: `${nome} excluído.` })
    },
    onError: () =>
      mostrar({
        texto: 'Não deu para excluir. Talvez esteja em uso num checkout.',
        tipo: 'erro',
      }),
  })

  const produtos = useMemo(() => produtosQuery.data ?? [], [produtosQuery.data])

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    if (termo === '') return produtos
    return produtos.filter((p) =>
      [p.nome, p.slug, p.descricao ?? ''].join(' ').toLowerCase().includes(termo)
    )
  }, [produtos, busca])

  const temProdutos = produtos.length > 0
  const migracaoPendente = ehTabelaAusente(produtosQuery.error)

  const abrirNovo = () => {
    setEmEdicao(null)
    setFormAberto(true)
  }

  const abrirEdicao = (produto: Produto) => {
    setEmEdicao(produto)
    setFormAberto(true)
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="hero-heading font-kanit text-4xl font-bold leading-tight sm:text-5xl">
            Produtos
          </h1>
          <p className="mt-2 text-sm font-light text-muted">
            O catálogo que abastece os checkouts: principal, order bump, upsell e
            downsell.
          </p>
        </div>
        <button
          type="button"
          onClick={abrirNovo}
          className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-[0_8px_24px_-8px_rgba(108,91,242,0.6)] transition-all duration-200 hover:bg-accent-2 hover:shadow-[0_10px_28px_-8px_rgba(85,70,224,0.7)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <Plus className="h-4 w-4" />
          Novo produto
        </button>
      </div>

      {temProdutos && (
        <div className="relative mt-8 max-w-sm">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted/60" />
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome ou slug…"
            aria-label="Buscar produtos"
            className="w-full rounded-lg border border-white/5 bg-surface-2 py-2.5 pl-10 pr-4 text-sm text-ink placeholder:text-muted/50 outline-none transition-colors duration-200 focus:border-accent/60 focus:ring-2 focus:ring-accent/25"
          />
        </div>
      )}

      <div className="mt-6 overflow-x-auto rounded-2xl border border-white/5 bg-surface-1">
        {produtosQuery.isLoading && (
          <div className="divide-y divide-white/5" aria-label="Carregando produtos">
            {Array.from({ length: SKELETON_ROWS }, (_, i) => (
              <div key={i} className="flex items-center gap-6 px-6 py-5">
                <div className="h-4 w-44 animate-pulse rounded bg-surface-2" />
                <div className="h-4 w-24 animate-pulse rounded bg-surface-2" />
                <div className="ml-auto h-4 w-20 animate-pulse rounded bg-surface-2" />
              </div>
            ))}
          </div>
        )}

        {migracaoPendente && (
          <div className="px-6 py-14 text-center">
            <h2 className="text-lg font-semibold text-ink">
              Tabelas do checkout ainda não existem
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm font-light leading-relaxed text-muted">
              A tela está pronta, mas o banco deste ambiente ainda não tem
              <span className="font-mono"> produtos</span>. Aplique a migração do
              checkout e recarregue a página.
            </p>
          </div>
        )}

        {produtosQuery.isError && !migracaoPendente && (
          <p className="px-6 py-10 text-center text-sm text-red-400">
            Não foi possível carregar os produtos. Recarregue a página.
          </p>
        )}

        {!produtosQuery.isLoading && !produtosQuery.isError && !temProdutos && (
          <div className="flex flex-col items-center px-6 py-16 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full border border-accent/20 bg-accent/10">
              <Package className="h-6 w-6 text-accent" />
            </span>
            <h2 className="mt-5 text-lg font-semibold text-ink">
              Nenhum produto cadastrado
            </h2>
            <p className="mt-2 max-w-sm text-sm font-light leading-relaxed text-muted">
              Um checkout precisa de pelo menos um produto principal. Cadastre o
              que você vende — nome, preço e forma de entrega — e depois monte a
              página em Checkouts.
            </p>
            <button
              type="button"
              onClick={abrirNovo}
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-accent-2"
            >
              <Plus className="h-4 w-4" />
              Cadastrar primeiro produto
            </button>
          </div>
        )}

        {!produtosQuery.isLoading && !produtosQuery.isError && temProdutos && (
          <>
            {filtrados.length === 0 ? (
              <p className="px-6 py-10 text-center text-sm font-light text-muted">
                Nenhum produto encontrado para “{busca.trim()}”.
              </p>
            ) : (
              <ProdutosTable
                produtos={filtrados}
                onEditar={abrirEdicao}
                onExcluir={setParaExcluir}
              />
            )}
          </>
        )}
      </div>

      <ProdutoFormModal
        open={formAberto}
        produto={emEdicao}
        produtos={produtos}
        onClose={() => setFormAberto(false)}
        onSalvo={(nome) => mostrar({ texto: `${nome} salvo.` })}
      />

      <ConfirmacaoModal
        open={paraExcluir !== null}
        titulo="Excluir produto"
        descricao={
          <>
            <span className="font-medium text-ink">{paraExcluir?.nome}</span> sai
            do catálogo. Checkouts que apontam para ele deixam de funcionar. Se a
            ideia é só tirar de venda, desative o produto em vez de excluir.
          </>
        }
        rotuloConfirmar="Excluir"
        isPending={excluirMutation.isPending}
        onConfirm={() => {
          if (paraExcluir) excluirMutation.mutate(paraExcluir.id)
        }}
        onClose={() => setParaExcluir(null)}
      />

      <Toast mensagem={toast} />
    </div>
  )
}
