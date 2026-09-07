import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { mensagemDeErro } from '../produtos/catalogoSupabase'
import { gerarSlug, slugDuplicado } from '../produtos/produtoForm'
import { formatCentavos } from '../produtos/precos'
import type { Produto } from '../produtos/produtosData'
import {
  Bloco,
  CampoAtivo,
  ModalBase,
  botaoPrimario,
  botaoSecundario,
  inputClass,
  labelClass,
} from '../produtos/formUi'
import {
  EMPTY_CHECKOUT,
  checkoutFormToPayload,
  checkoutSchema,
  checkoutToFormValues,
} from './checkoutForm'
import type { CheckoutFormValues } from './checkoutForm'
import { atualizarCheckout, criarCheckout } from './checkoutsData'
import type { Checkout } from './checkoutsData'
import OfertaBloco from './OfertaBloco'
import ProvaEditor from './ProvaEditor'
import GarantiaCronometroBloco from './GarantiaCronometroBloco'
import LinkCheckout from './LinkCheckout'

interface Props {
  open: boolean
  checkout?: Checkout | null
  produtos: readonly Produto[]
  checkouts: readonly Checkout[]
  onClose: () => void
  onSalvo: (titulo: string) => void
}

type Erros = Partial<Record<keyof CheckoutFormValues, string>>

export default function CheckoutFormModal({
  open,
  checkout,
  produtos,
  checkouts,
  onClose,
  onSalvo,
}: Props) {
  const queryClient = useQueryClient()
  const [values, setValues] = useState<CheckoutFormValues>(EMPTY_CHECKOUT)
  const [erros, setErros] = useState<Erros>({})
  const [erroGeral, setErroGeral] = useState<string | null>(null)
  const [slugManual, setSlugManual] = useState(false)

  const editando = Boolean(checkout)

  useEffect(() => {
    if (!open) return
    setValues(checkout ? checkoutToFormValues(checkout) : EMPTY_CHECKOUT)
    setErros({})
    setErroGeral(null)
    setSlugManual(Boolean(checkout))
  }, [open, checkout])

  const mutation = useMutation({
    mutationFn: async (v: CheckoutFormValues) => {
      const payload = checkoutFormToPayload(v)
      if (checkout) await atualizarCheckout(checkout.id, payload)
      else await criarCheckout(payload)
      return payload.titulo
    },
    onSuccess: async (titulo) => {
      await queryClient.invalidateQueries({ queryKey: ['checkouts'] })
      onSalvo(titulo)
      onClose()
    },
    onError: (erro) => {
      setErroGeral(mensagemDeErro(erro, 'Já existe um checkout com esse slug.'))
    },
  })

  const setCampo = <K extends keyof CheckoutFormValues>(
    campo: K,
    valor: CheckoutFormValues[K]
  ) => setValues((atual) => ({ ...atual, [campo]: valor }))

  const setTitulo = (titulo: string) => {
    setValues((atual) => ({
      ...atual,
      titulo,
      slug: slugManual ? atual.slug : gerarSlug(titulo),
    }))
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErroGeral(null)
    const parsed = checkoutSchema.safeParse(values)
    if (!parsed.success) {
      const campos: Erros = {}
      for (const issue of parsed.error.issues) {
        const chave = issue.path[0] as keyof CheckoutFormValues
        if (!campos[chave]) campos[chave] = issue.message
      }
      setErros(campos)
      return
    }
    if (slugDuplicado(values.slug, checkouts, checkout?.id)) {
      setErros({ slug: 'Esse slug já é de outro checkout.' })
      return
    }
    setErros({})
    mutation.mutate(parsed.data as CheckoutFormValues)
  }

  const principal = produtos.find((p) => p.id === values.produtoId)

  return (
    <ModalBase
      open={open}
      titulo={editando ? 'Editar checkout' : 'Novo checkout'}
      descricao="Produto, copy da página e as ofertas que aparecem no caminho da compra."
      larguraClass="max-w-3xl"
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-5">
        <Bloco titulo="Oferta principal" ajuda="O que a página vende e como ela se chama.">
          <label className="flex flex-col gap-1.5">
            <span className={labelClass}>Produto principal *</span>
            <select
              value={values.produtoId}
              onChange={(e) => setCampo('produtoId', e.target.value)}
              className={`${inputClass} appearance-none`}
            >
              <option value="">Selecionar…</option>
              {produtos.map((produto) => (
                <option key={produto.id} value={produto.id}>
                  {produto.nome} · {formatCentavos(produto.preco_centavos)}
                  {produto.ativo ? '' : ' (inativo)'}
                </option>
              ))}
            </select>
            {principal && !principal.ativo && (
              <span className="text-xs text-amber-300">
                Esse produto está inativo: a página não abre enquanto ele não
                for reativado.
              </span>
            )}
            {erros.produtoId && (
              <span className="text-xs text-red-400">{erros.produtoId}</span>
            )}
          </label>

          <label className="flex flex-col gap-1.5">
            <span className={labelClass}>Título *</span>
            <input
              type="text"
              value={values.titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Corrija sua loja em 7 dias"
              className={inputClass}
            />
            {erros.titulo && (
              <span className="text-xs text-red-400">{erros.titulo}</span>
            )}
          </label>

          <label className="flex flex-col gap-1.5">
            <span className={labelClass}>Subtítulo</span>
            <input
              type="text"
              value={values.subtitulo}
              onChange={(e) => setCampo('subtitulo', e.target.value)}
              placeholder="Diagnóstico completo + plano de ação."
              className={inputClass}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className={labelClass}>Slug da página *</span>
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
            <LinkCheckout slug={values.slug} />
            {erros.slug && <span className="text-xs text-red-400">{erros.slug}</span>}
          </label>
        </Bloco>

        <OfertaBloco
          titulo="Order bump"
          ajuda="Oferta marcada na própria página, antes de pagar."
          produtos={produtos}
          produtoPrincipalId={values.produtoId}
          produtoId={values.bumpProdutoId}
          tituloOferta={values.bumpTitulo}
          textoOferta={values.bumpTexto}
          erro={erros.bumpProdutoId}
          rotuloTitulo="Título do bump"
          rotuloTexto="Texto do bump"
          onProdutoId={(v) => setCampo('bumpProdutoId', v)}
          onTitulo={(v) => setCampo('bumpTitulo', v)}
          onTexto={(v) => setCampo('bumpTexto', v)}
        />

        <OfertaBloco
          titulo="Upsell"
          ajuda="Oferta feita logo depois do pagamento aprovado."
          produtos={produtos}
          produtoPrincipalId={values.produtoId}
          produtoId={values.upsellProdutoId}
          tituloOferta={values.upsellTitulo}
          textoOferta={values.upsellTexto}
          erro={erros.upsellProdutoId}
          rotuloTitulo="Título do upsell"
          rotuloTexto="Texto do upsell"
          onProdutoId={(v) => setCampo('upsellProdutoId', v)}
          onTitulo={(v) => setCampo('upsellTitulo', v)}
          onTexto={(v) => setCampo('upsellTexto', v)}
        />

        <OfertaBloco
          titulo="Downsell"
          ajuda="Oferta alternativa para quem recusou o upsell."
          produtos={produtos}
          produtoPrincipalId={values.produtoId}
          produtoId={values.downsellProdutoId}
          tituloOferta={values.downsellTitulo}
          textoOferta={values.downsellTexto}
          erro={erros.downsellProdutoId}
          rotuloTitulo="Título do downsell"
          rotuloTexto="Texto do downsell"
          onProdutoId={(v) => setCampo('downsellProdutoId', v)}
          onTitulo={(v) => setCampo('downsellTitulo', v)}
          onTexto={(v) => setCampo('downsellTexto', v)}
        />

        <ProvaEditor
          depoimentos={values.depoimentos}
          selos={values.selos}
          onDepoimentos={(lista) => setCampo('depoimentos', lista)}
          onSelos={(lista) => setCampo('selos', lista)}
        />

        <GarantiaCronometroBloco
          garantiaDias={values.garantiaDias}
          garantiaTexto={values.garantiaTexto}
          cronometroAte={values.cronometroAte}
          erroDias={erros.garantiaDias}
          erroCronometro={erros.cronometroAte}
          onGarantiaDias={(v) => setCampo('garantiaDias', v)}
          onGarantiaTexto={(v) => setCampo('garantiaTexto', v)}
          onCronometroAte={(v) => setCampo('cronometroAte', v)}
        />

        <CampoAtivo
          ativo={values.ativo}
          onChange={(ativo) => setCampo('ativo', ativo)}
          rotuloLigado="Ativo — a página está no ar e aceita pagamento."
          rotuloDesligado="Inativo — quem abrir o link vê página não encontrada."
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
                : 'Criar checkout'}
          </button>
        </div>
      </form>
    </ModalBase>
  )
}
