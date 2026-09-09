import { useEffect, useId, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { mensagemDeErro } from './catalogoSupabase'
import {
  PRODUTO_ENTREGAS,
  PRODUTO_ENTREGA_LABEL,
  PRODUTO_TIPOS,
  PRODUTO_TIPO_LABEL,
  atualizarProduto,
  categoriasDoCatalogo,
  criarProduto,
} from './produtosData'
import type { Produto } from './produtosData'
import {
  EMPTY_PRODUTO,
  gerarSlug,
  produtoFormToPayload,
  produtoSchema,
  produtoToFormValues,
  slugDuplicado,
} from './produtoForm'
import type { ProdutoFormValues } from './produtoForm'
import { descontoPercentual, formatCentavos, reaisParaCentavos } from './precos'
import {
  Bloco,
  CampoAtivo,
  ModalBase,
  botaoPrimario,
  botaoSecundario,
  inputClass,
  labelClass,
} from './formUi'

interface Props {
  open: boolean
  /** Produto em edição — null/undefined = criação. */
  produto?: Produto | null
  /** Catálogo já carregado, para acusar slug repetido antes do submit. */
  produtos: readonly Produto[]
  onClose: () => void
  onSalvo: (nome: string) => void
}

type Erros = Partial<Record<keyof ProdutoFormValues, string>>

export default function ProdutoFormModal({
  open,
  produto,
  produtos,
  onClose,
  onSalvo,
}: Props) {
  const queryClient = useQueryClient()
  const [values, setValues] = useState<ProdutoFormValues>(EMPTY_PRODUTO)
  const [erros, setErros] = useState<Erros>({})
  const [erroGeral, setErroGeral] = useState<string | null>(null)
  // Só geramos slug a partir do nome enquanto ninguém editou o slug à mão.
  const [slugManual, setSlugManual] = useState(false)

  const editando = Boolean(produto)

  // O `datalist` precisa de um id único: dois modais montados na mesma página
  // com o mesmo id fariam o navegador ligar o input à lista errada.
  const idSugestoes = useId()
  const sugestoesDeCategoria = useMemo(
    () => categoriasDoCatalogo(produtos),
    [produtos]
  )

  useEffect(() => {
    if (!open) return
    setValues(produto ? produtoToFormValues(produto) : EMPTY_PRODUTO)
    setErros({})
    setErroGeral(null)
    setSlugManual(Boolean(produto))
  }, [open, produto])

  const mutation = useMutation({
    mutationFn: async (v: ProdutoFormValues) => {
      const payload = produtoFormToPayload(v)
      if (produto) await atualizarProduto(produto.id, payload)
      else await criarProduto(payload)
      return payload.nome
    },
    onSuccess: async (nome) => {
      await queryClient.invalidateQueries({ queryKey: ['produtos'] })
      onSalvo(nome)
      onClose()
    },
    onError: (erro) => {
      setErroGeral(mensagemDeErro(erro, 'Já existe um produto com esse slug.'))
    },
  })

  const setCampo = <K extends keyof ProdutoFormValues>(
    campo: K,
    valor: ProdutoFormValues[K]
  ) => setValues((atual) => ({ ...atual, [campo]: valor }))

  const setNome = (nome: string) => {
    setValues((atual) => ({
      ...atual,
      nome,
      slug: slugManual ? atual.slug : gerarSlug(nome),
    }))
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErroGeral(null)
    const parsed = produtoSchema.safeParse(values)
    if (!parsed.success) {
      const campos: Erros = {}
      for (const issue of parsed.error.issues) {
        const chave = issue.path[0] as keyof ProdutoFormValues
        if (!campos[chave]) campos[chave] = issue.message
      }
      setErros(campos)
      return
    }
    if (slugDuplicado(values.slug, produtos, produto?.id)) {
      setErros({ slug: 'Esse slug já é de outro produto.' })
      return
    }
    setErros({})
    mutation.mutate(parsed.data)
  }

  // Prévia do preço: a pessoa vê em reais o que vai para o banco em centavos.
  const precoCentavos = reaisParaCentavos(values.preco)
  const ancoraCentavos = reaisParaCentavos(values.precoAncora)
  const desconto =
    precoCentavos !== null ? descontoPercentual(precoCentavos, ancoraCentavos) : null

  return (
    <ModalBase
      open={open}
      titulo={editando ? 'Editar produto' : 'Novo produto'}
      descricao={
        editando
          ? 'Atualize os dados do produto do catálogo.'
          : 'Cadastre um item que pode ser vendido num checkout.'
      }
      larguraClass="max-w-2xl"
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-5">
        <label className="flex flex-col gap-1.5">
          <span className={labelClass}>Nome *</span>
          <input
            type="text"
            value={values.nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Plano de Correção"
            className={inputClass}
          />
          {erros.nome && <span className="text-xs text-red-400">{erros.nome}</span>}
        </label>

        <label className="flex flex-col gap-1.5">
          <span className={labelClass}>Slug *</span>
          <input
            type="text"
            value={values.slug}
            onChange={(e) => {
              setSlugManual(true)
              setCampo('slug', e.target.value)
            }}
            placeholder="plano-de-correcao"
            className={`${inputClass} font-mono`}
          />
          <span className="text-xs font-light text-muted">
            Identificador único do produto. Sai do nome, mas pode ser trocado.
          </span>
          {erros.slug && <span className="text-xs text-red-400">{erros.slug}</span>}
        </label>

        <label className="flex flex-col gap-1.5">
          <span className={labelClass}>Descrição</span>
          <textarea
            rows={3}
            value={values.descricao}
            onChange={(e) => setCampo('descricao', e.target.value)}
            placeholder="O que o cliente recebe ao comprar."
            className={`${inputClass} resize-y`}
          />
        </label>

        <Bloco
          titulo="Preço"
          ajuda="Digite em reais (197,00). O banco guarda em centavos — a conversão é feita aqui."
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className={labelClass}>Preço de venda *</span>
              <div className="relative">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-muted">
                  R$
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={values.preco}
                  onChange={(e) => setCampo('preco', e.target.value)}
                  placeholder="197,00"
                  className={`${inputClass} pl-10 tabular-nums`}
                />
              </div>
              {precoCentavos !== null && (
                <span className="text-xs font-light tabular-nums text-muted">
                  Cobra {formatCentavos(precoCentavos)}
                </span>
              )}
              {erros.preco && (
                <span className="text-xs text-red-400">{erros.preco}</span>
              )}
            </label>

            <label className="flex flex-col gap-1.5">
              <span className={labelClass}>Preço de âncora</span>
              <div className="relative">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-muted">
                  R$
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={values.precoAncora}
                  onChange={(e) => setCampo('precoAncora', e.target.value)}
                  placeholder="297,00"
                  className={`${inputClass} pl-10 tabular-nums`}
                />
              </div>
              <span className="text-xs font-light text-muted">
                {desconto !== null
                  ? `Mostra "de ${formatCentavos(ancoraCentavos ?? 0)} por ${formatCentavos(precoCentavos ?? 0)}" — ${desconto}% off.`
                  : 'Opcional: o valor riscado ao lado do preço.'}
              </span>
              {erros.precoAncora && (
                <span className="text-xs text-red-400">{erros.precoAncora}</span>
              )}
            </label>
          </div>
        </Bloco>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className={labelClass}>Tipo *</span>
            <select
              value={values.tipo}
              onChange={(e) =>
                setCampo('tipo', e.target.value as ProdutoFormValues['tipo'])
              }
              className={`${inputClass} appearance-none`}
            >
              {PRODUTO_TIPOS.map((tipo) => (
                <option key={tipo} value={tipo}>
                  {PRODUTO_TIPO_LABEL[tipo]}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className={labelClass}>Entrega *</span>
            <select
              value={values.entrega}
              onChange={(e) =>
                setCampo('entrega', e.target.value as ProdutoFormValues['entrega'])
              }
              className={`${inputClass} appearance-none`}
            >
              {PRODUTO_ENTREGAS.map((entrega) => (
                <option key={entrega} value={entrega}>
                  {PRODUTO_ENTREGA_LABEL[entrega]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className={labelClass}>Tipo de serviço</span>
          <input
            type="text"
            list={idSugestoes}
            value={values.categoria}
            onChange={(e) => setCampo('categoria', e.target.value)}
            placeholder="Tema sob medida"
            className={inputClass}
          />
          <datalist id={idSugestoes}>
            {sugestoesDeCategoria.map((categoria) => (
              <option key={categoria} value={categoria} />
            ))}
          </datalist>
          <span className="text-xs font-light text-muted">
            {sugestoesDeCategoria.length > 0
              ? `Agrupa o faturamento em Pedidos. Já em uso: ${sugestoesDeCategoria.join(', ')}.`
              : 'Agrupa o faturamento em Pedidos — tema, app, sistema, consultoria. Reaproveite o mesmo nome entre produtos.'}
          </span>
          {erros.categoria && (
            <span className="text-xs text-red-400">{erros.categoria}</span>
          )}
        </label>

        <CampoAtivo
          ativo={values.ativo}
          onChange={(ativo) => setCampo('ativo', ativo)}
          rotuloLigado="Ativo — pode ser vendido nos checkouts."
          rotuloDesligado="Inativo — fica fora de qualquer checkout até ser reativado."
        />

        {erroGeral && (
          <p
            role="alert"
            className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm text-red-400"
          >
            {erroGeral}
          </p>
        )}

        <div className="mt-1 flex justify-end gap-3">
          <button type="button" onClick={onClose} className={botaoSecundario}>
            Cancelar
          </button>
          <button
            type="submit"
            disabled={mutation.isPending}
            className={botaoPrimario}
          >
            {mutation.isPending
              ? 'Salvando…'
              : editando
                ? 'Salvar alterações'
                : 'Criar produto'}
          </button>
        </div>
      </form>
    </ModalBase>
  )
}
