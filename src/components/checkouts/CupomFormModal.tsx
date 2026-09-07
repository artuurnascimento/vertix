import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { mensagemDeErro } from '../produtos/catalogoSupabase'
import type { Produto } from '../produtos/produtosData'
import {
  CampoAtivo,
  ModalBase,
  botaoPrimario,
  botaoSecundario,
  inputClass,
  labelClass,
} from '../produtos/formUi'
import { CUPOM_TIPOS, CUPOM_TIPO_LABEL, atualizarCupom, criarCupom } from './cuponsData'
import type { Cupom } from './cuponsData'
import {
  EMPTY_CUPOM,
  cupomFormToPayload,
  cupomSchema,
  cupomToFormValues,
  normalizarCodigo,
} from './cupomForm'
import type { CupomFormValues } from './cupomForm'

interface Props {
  open: boolean
  cupom?: Cupom | null
  produtos: readonly Produto[]
  onClose: () => void
  onSalvo: (codigo: string) => void
}

type Erros = Partial<Record<keyof CupomFormValues, string>>

export default function CupomFormModal({
  open,
  cupom,
  produtos,
  onClose,
  onSalvo,
}: Props) {
  const queryClient = useQueryClient()
  const [values, setValues] = useState<CupomFormValues>(EMPTY_CUPOM)
  const [erros, setErros] = useState<Erros>({})
  const [erroGeral, setErroGeral] = useState<string | null>(null)

  const editando = Boolean(cupom)

  useEffect(() => {
    if (!open) return
    setValues(cupom ? cupomToFormValues(cupom) : EMPTY_CUPOM)
    setErros({})
    setErroGeral(null)
  }, [open, cupom])

  const mutation = useMutation({
    mutationFn: async (v: CupomFormValues) => {
      const payload = cupomFormToPayload(v)
      if (cupom) await atualizarCupom(cupom.id, payload)
      else await criarCupom(payload)
      return payload.codigo
    },
    onSuccess: async (codigo) => {
      await queryClient.invalidateQueries({ queryKey: ['cupons'] })
      onSalvo(codigo)
      onClose()
    },
    onError: (erro) => {
      setErroGeral(mensagemDeErro(erro, 'Já existe um cupom com esse código.'))
    },
  })

  const setCampo = <K extends keyof CupomFormValues>(
    campo: K,
    valor: CupomFormValues[K]
  ) => setValues((atual) => ({ ...atual, [campo]: valor }))

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErroGeral(null)
    const parsed = cupomSchema.safeParse(values)
    if (!parsed.success) {
      const campos: Erros = {}
      for (const issue of parsed.error.issues) {
        const chave = issue.path[0] as keyof CupomFormValues
        if (!campos[chave]) campos[chave] = issue.message
      }
      setErros(campos)
      return
    }
    setErros({})
    mutation.mutate(parsed.data as CupomFormValues)
  }

  const ehFixo = values.tipo === 'fixo'

  return (
    <ModalBase
      open={open}
      titulo={editando ? 'Editar cupom' : 'Novo cupom'}
      descricao="Código, desconto e limites. O contador de usos é do sistema — sobe só quando o pagamento é aprovado."
      larguraClass="max-w-lg"
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className={labelClass}>Código *</span>
          <input
            type="text"
            value={values.codigo}
            onChange={(e) => setCampo('codigo', normalizarCodigo(e.target.value))}
            placeholder="BF50"
            className={`${inputClass} font-mono uppercase tracking-widest`}
          />
          <span className="text-xs font-light text-muted">
            Sempre em maiúsculas — é assim que o cliente digita e que o banco
            guarda.
          </span>
          {erros.codigo && <span className="text-xs text-red-400">{erros.codigo}</span>}
        </label>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className={labelClass}>Tipo *</span>
            <select
              value={values.tipo}
              onChange={(e) =>
                setCampo('tipo', e.target.value as CupomFormValues['tipo'])
              }
              className={`${inputClass} appearance-none`}
            >
              {CUPOM_TIPOS.map((tipo) => (
                <option key={tipo} value={tipo}>
                  {CUPOM_TIPO_LABEL[tipo]}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className={labelClass}>
              {ehFixo ? 'Desconto em reais *' : 'Desconto em % *'}
            </span>
            <div className="relative">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-muted">
                {ehFixo ? 'R$' : '%'}
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={values.valor}
                onChange={(e) => setCampo('valor', e.target.value)}
                placeholder={ehFixo ? '50,00' : '10'}
                className={`${inputClass} pl-10 tabular-nums`}
              />
            </div>
            {erros.valor && <span className="text-xs text-red-400">{erros.valor}</span>}
          </label>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className={labelClass}>Validade</span>
            <input
              type="date"
              value={values.validade}
              onChange={(e) => setCampo('validade', e.target.value)}
              className={`${inputClass} tabular-nums`}
            />
            <span className="text-xs font-light text-muted">
              Vale até o fim desse dia. Vazio = não expira.
            </span>
            {erros.validade && (
              <span className="text-xs text-red-400">{erros.validade}</span>
            )}
          </label>

          <label className="flex flex-col gap-1.5">
            <span className={labelClass}>Limite de uso</span>
            <input
              type="number"
              min={1}
              value={values.limiteUso}
              onChange={(e) => setCampo('limiteUso', e.target.value)}
              placeholder="Ilimitado"
              className={`${inputClass} tabular-nums`}
            />
            {erros.limiteUso && (
              <span className="text-xs text-red-400">{erros.limiteUso}</span>
            )}
          </label>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className={labelClass}>Produto</span>
          <select
            value={values.produtoId}
            onChange={(e) => setCampo('produtoId', e.target.value)}
            className={`${inputClass} appearance-none`}
          >
            <option value="">Vale em qualquer checkout</option>
            {produtos.map((produto) => (
              <option key={produto.id} value={produto.id}>
                {produto.nome}
              </option>
            ))}
          </select>
        </label>

        <CampoAtivo
          ativo={values.ativo}
          onChange={(ativo) => setCampo('ativo', ativo)}
          rotuloLigado="Ativo — pode ser usado no checkout."
          rotuloDesligado="Inativo — o código deixa de ser aceito."
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
          <button type="submit" disabled={mutation.isPending} className={botaoPrimario}>
            {mutation.isPending
              ? 'Salvando…'
              : editando
                ? 'Salvar alterações'
                : 'Criar cupom'}
          </button>
        </div>
      </form>
    </ModalBase>
  )
}
