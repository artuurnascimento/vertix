import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, ShoppingCart } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ehTabelaAusente } from '../components/produtos/catalogoSupabase'
import { fetchProdutos } from '../components/produtos/produtosData'
import type { Produto } from '../components/produtos/produtosData'
import { excluirCheckout, fetchCheckouts } from '../components/checkouts/checkoutsData'
import type { Checkout } from '../components/checkouts/checkoutsData'
import { excluirCupom, fetchCupons } from '../components/checkouts/cuponsData'
import type { Cupom } from '../components/checkouts/cuponsData'
import CheckoutsAbas from '../components/checkouts/CheckoutsAbas'
import type { AbaCheckout } from '../components/checkouts/CheckoutsAbas'
import CheckoutsTable from '../components/checkouts/CheckoutsTable'
import CheckoutFormModal from '../components/checkouts/CheckoutFormModal'
import CuponsPanel from '../components/checkouts/CuponsPanel'
import CupomFormModal from '../components/checkouts/CupomFormModal'
import ConfirmacaoModal from '../components/ui/ConfirmacaoModal'
import Toast, { useToast } from '../components/ui/Toast'

/**
 * Configuração dos checkouts: qual produto cada página vende, a copy, as
 * ofertas do caminho (bump, upsell, downsell), prova social, garantia,
 * cronômetro — e os cupons de desconto, na segunda aba.
 */

const SKELETON_ROWS = 3

export default function Checkouts() {
  const queryClient = useQueryClient()
  const { toast, mostrar } = useToast()

  const [aba, setAba] = useState<AbaCheckout>('checkouts')
  const [formAberto, setFormAberto] = useState(false)
  const [emEdicao, setEmEdicao] = useState<Checkout | null>(null)
  const [paraExcluir, setParaExcluir] = useState<Checkout | null>(null)
  const [cupomFormAberto, setCupomFormAberto] = useState(false)
  const [cupomEmEdicao, setCupomEmEdicao] = useState<Cupom | null>(null)
  const [cupomParaExcluir, setCupomParaExcluir] = useState<Cupom | null>(null)

  const produtosQuery = useQuery({
    queryKey: ['produtos'],
    queryFn: fetchProdutos,
    retry: false,
  })
  const checkoutsQuery = useQuery({
    queryKey: ['checkouts'],
    queryFn: fetchCheckouts,
    retry: false,
  })
  const cuponsQuery = useQuery({
    queryKey: ['cupons'],
    queryFn: fetchCupons,
    retry: false,
  })

  const produtos: readonly Produto[] = useMemo(
    () => produtosQuery.data ?? [],
    [produtosQuery.data]
  )
  const checkouts = useMemo(() => checkoutsQuery.data ?? [], [checkoutsQuery.data])
  const cupons = useMemo(() => cuponsQuery.data ?? [], [cuponsQuery.data])

  const produtosPorId = useMemo(
    () => new Map(produtos.map((p) => [p.id, p])),
    [produtos]
  )

  const excluirCheckoutMutation = useMutation({
    mutationFn: (id: string) => excluirCheckout(id),
    onSuccess: async () => {
      const titulo = paraExcluir?.titulo ?? 'Checkout'
      setParaExcluir(null)
      await queryClient.invalidateQueries({ queryKey: ['checkouts'] })
      mostrar({ texto: `${titulo} excluído.` })
    },
    onError: () =>
      mostrar({
        texto: 'Não deu para excluir. Talvez existam pedidos ligados a ele.',
        tipo: 'erro',
      }),
  })

  const excluirCupomMutation = useMutation({
    mutationFn: (id: string) => excluirCupom(id),
    onSuccess: async () => {
      const codigo = cupomParaExcluir?.codigo ?? 'Cupom'
      setCupomParaExcluir(null)
      await queryClient.invalidateQueries({ queryKey: ['cupons'] })
      mostrar({ texto: `Cupom ${codigo} excluído.` })
    },
    onError: () =>
      mostrar({ texto: 'Não deu para excluir o cupom.', tipo: 'erro' }),
  })

  const migracaoPendente =
    ehTabelaAusente(checkoutsQuery.error) || ehTabelaAusente(produtosQuery.error)
  const semProdutos = !produtosQuery.isLoading && produtos.length === 0
  const naAbaCupons = aba === 'cupons'
  const carregando = naAbaCupons ? cuponsQuery.isLoading : checkoutsQuery.isLoading
  const comErro = naAbaCupons ? cuponsQuery.isError : checkoutsQuery.isError

  const abrirNovo = () => {
    setEmEdicao(null)
    setFormAberto(true)
  }
  const abrirNovoCupom = () => {
    setCupomEmEdicao(null)
    setCupomFormAberto(true)
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="hero-heading font-kanit text-4xl font-bold leading-tight sm:text-5xl">
            Checkouts
          </h1>
          <p className="mt-2 text-sm font-light text-muted">
            A oferta montada: produto, copy, order bump, upsell, prova social,
            garantia e cronômetro.
          </p>
        </div>
        <button
          type="button"
          onClick={naAbaCupons ? abrirNovoCupom : abrirNovo}
          disabled={!naAbaCupons && semProdutos}
          className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-[0_8px_24px_-8px_rgba(108,91,242,0.6)] transition-all duration-200 hover:bg-accent-2 hover:shadow-[0_10px_28px_-8px_rgba(85,70,224,0.7)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          {naAbaCupons ? 'Novo cupom' : 'Novo checkout'}
        </button>
      </div>

      <div className="mt-8">
        <CheckoutsAbas valor={aba} onChange={setAba} />
      </div>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-white/5 bg-surface-1">
        {carregando && (
          <div className="divide-y divide-white/5" aria-label="Carregando">
            {Array.from({ length: SKELETON_ROWS }, (_, i) => (
              <div key={i} className="flex items-center gap-6 px-6 py-5">
                <div className="h-4 w-52 animate-pulse rounded bg-surface-2" />
                <div className="h-4 w-28 animate-pulse rounded bg-surface-2" />
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
              A tela está pronta, mas este ambiente ainda não tem as tabelas
              <span className="font-mono"> checkouts</span>,
              <span className="font-mono"> produtos</span> e
              <span className="font-mono"> cupons</span>. Aplique a migração do
              checkout e recarregue a página.
            </p>
          </div>
        )}

        {comErro && !migracaoPendente && (
          <p className="px-6 py-10 text-center text-sm text-red-400">
            Não foi possível carregar os dados. Recarregue a página.
          </p>
        )}

        {!carregando && !comErro && !naAbaCupons && semProdutos && (
          <div className="flex flex-col items-center px-6 py-16 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full border border-accent/20 bg-accent/10">
              <ShoppingCart className="h-6 w-6 text-accent" />
            </span>
            <h2 className="mt-5 text-lg font-semibold text-ink">
              Cadastre um produto primeiro
            </h2>
            <p className="mt-2 max-w-sm text-sm font-light leading-relaxed text-muted">
              Todo checkout vende um produto principal. Sem catálogo não há o que
              montar — comece pela tela de Produtos e volte aqui.
            </p>
            <Link
              to="/admin/produtos"
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-accent-2"
            >
              Ir para Produtos
            </Link>
          </div>
        )}

        {!carregando && !comErro && !naAbaCupons && !semProdutos && (
          <>
            {checkouts.length === 0 ? (
              <div className="flex flex-col items-center px-6 py-16 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-full border border-accent/20 bg-accent/10">
                  <ShoppingCart className="h-6 w-6 text-accent" />
                </span>
                <h2 className="mt-5 text-lg font-semibold text-ink">
                  Nenhum checkout montado
                </h2>
                <p className="mt-2 max-w-sm text-sm font-light leading-relaxed text-muted">
                  Um checkout é a página que vende um produto do catálogo, com
                  título, ofertas e prova social. Monte o primeiro e o link
                  <span className="font-mono"> /c/&lt;slug&gt;</span> passa a
                  funcionar.
                </p>
                <button
                  type="button"
                  onClick={abrirNovo}
                  className="mt-6 inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-accent-2"
                >
                  <Plus className="h-4 w-4" />
                  Montar primeiro checkout
                </button>
              </div>
            ) : (
              <CheckoutsTable
                checkouts={checkouts}
                produtosPorId={produtosPorId}
                onEditar={(checkout) => {
                  setEmEdicao(checkout)
                  setFormAberto(true)
                }}
                onExcluir={setParaExcluir}
              />
            )}
          </>
        )}

        {!carregando && !comErro && naAbaCupons && (
          <CuponsPanel
            cupons={cupons}
            produtosPorId={produtosPorId}
            onCriar={abrirNovoCupom}
            onEditar={(cupom) => {
              setCupomEmEdicao(cupom)
              setCupomFormAberto(true)
            }}
            onExcluir={setCupomParaExcluir}
          />
        )}
      </div>

      <CheckoutFormModal
        open={formAberto}
        checkout={emEdicao}
        produtos={produtos}
        checkouts={checkouts}
        onClose={() => setFormAberto(false)}
        onSalvo={(titulo) => mostrar({ texto: `${titulo} salvo.` })}
      />

      <CupomFormModal
        open={cupomFormAberto}
        cupom={cupomEmEdicao}
        produtos={produtos}
        onClose={() => setCupomFormAberto(false)}
        onSalvo={(codigo) => mostrar({ texto: `Cupom ${codigo} salvo.` })}
      />

      <ConfirmacaoModal
        open={paraExcluir !== null}
        titulo="Excluir checkout"
        descricao={
          <>
            O link <span className="font-mono">/c/{paraExcluir?.slug}</span> para
            de funcionar na hora. Se ele já foi divulgado, desative em vez de
            excluir.
          </>
        }
        rotuloConfirmar="Excluir"
        isPending={excluirCheckoutMutation.isPending}
        onConfirm={() => {
          if (paraExcluir) excluirCheckoutMutation.mutate(paraExcluir.id)
        }}
        onClose={() => setParaExcluir(null)}
      />

      <ConfirmacaoModal
        open={cupomParaExcluir !== null}
        titulo="Excluir cupom"
        descricao={
          <>
            O código{' '}
            <span className="font-mono">{cupomParaExcluir?.codigo}</span> deixa de
            ser aceito. O histórico de usos vai junto — para só parar de aceitar,
            desative o cupom.
          </>
        }
        rotuloConfirmar="Excluir"
        isPending={excluirCupomMutation.isPending}
        onConfirm={() => {
          if (cupomParaExcluir) excluirCupomMutation.mutate(cupomParaExcluir.id)
        }}
        onClose={() => setCupomParaExcluir(null)}
      />

      <Toast mensagem={toast} />
    </div>
  )
}
