import { AlertTriangle, Percent } from 'lucide-react'
import { Bloco, inputClass, labelClass } from '../produtos/formUi'
import { formatCentavos } from '../produtos/precos'
import { DESCONTO_PIX_MAXIMO } from './checkoutForm'
import { descontoDoMetodo } from '../checkout/checkoutTotal'

interface Props {
  /** Texto do input; '' = o método de pagamento não muda o preço. */
  percentual: string
  /** Preço do produto principal, só para simular o resultado. */
  precoPrincipalCentavos: number | null
  erro?: string
  onChange: (valor: string) => void
}

/**
 * Desconto por pagar no Pix.
 *
 * Vale SÓ para o Pix, e o motivo é o que precisa ficar na tela para quem
 * configura: a taxa do Pix é uma fração da taxa do cartão, então o desconto
 * sai de uma economia que já existe. No cartão o mesmo percentual sairia da
 * margem da venda — por isso não existe campo equivalente para ele.
 *
 * A simulação abaixo do campo não é enfeite: percentual é abstrato, e ver
 * "R$ 197,00 → R$ 177,30" é o que faz alguém perceber que digitou 100 quando
 * queria 10.
 */
export default function DescontoPixBloco({
  percentual,
  precoPrincipalCentavos,
  erro,
  onChange,
}: Props) {
  const numero = percentual.trim() === '' ? null : Number(percentual)
  const valido =
    numero !== null &&
    Number.isFinite(numero) &&
    numero > 0 &&
    numero <= DESCONTO_PIX_MAXIMO

  // A MESMA função da página pública, não uma cópia da conta. Quando isto era
  // um Math.round escrito à mão, o painel prometia ao operador um centavo a
  // menos do que a cobrança faria — simulação que não usa o código real da
  // cobrança não simula nada.
  const desconto =
    valido && precoPrincipalCentavos !== null
      ? descontoDoMetodo(precoPrincipalCentavos, numero)
      : null

  return (
    <Bloco
      titulo="Desconto no Pix"
      ajuda="Percentual abatido do total quando o cliente escolhe Pix. Vale só para o Pix: a taxa dele é bem menor que a do cartão, então o desconto sai dessa economia — no cartão ele sairia da sua margem."
    >
      <label className="flex flex-col gap-1.5 sm:max-w-[14rem]">
        <span className={labelClass}>Percentual</span>
        <div className="relative">
          <input
            type="number"
            min={0}
            max={DESCONTO_PIX_MAXIMO}
            step={1}
            inputMode="numeric"
            value={percentual}
            onChange={(e) => onChange(e.target.value)}
            placeholder="10"
            aria-describedby="desconto-pix-ajuda"
            className={`${inputClass} pr-10 tabular-nums`}
          />
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-muted"
          >
            <Percent className="h-3.5 w-3.5" />
          </span>
        </div>
        {erro && <span className="text-xs text-red-400">{erro}</span>}
      </label>

      <p id="desconto-pix-ajuda" className="text-xs font-light text-muted">
        Deixe vazio para cobrar o mesmo valor nos dois métodos. Máximo{' '}
        {DESCONTO_PIX_MAXIMO}%.
      </p>

      {desconto !== null && precoPrincipalCentavos !== null && (
        <p className="rounded-lg border border-emerald-400/20 bg-emerald-400/[0.07] px-4 py-3 text-xs font-light text-muted">
          No produto principal, o cliente veria{' '}
          <span className="font-semibold tabular-nums text-ink">
            {formatCentavos(precoPrincipalCentavos)}
          </span>{' '}
          no cartão e{' '}
          <span className="font-semibold tabular-nums text-emerald-300">
            {formatCentavos(precoPrincipalCentavos - desconto)}
          </span>{' '}
          no Pix — {formatCentavos(desconto)} a menos.
        </p>
      )}

      {valido && numero >= 30 && (
        <p className="inline-flex items-start gap-1.5 text-xs text-amber-300">
          <AlertTriangle aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {numero}% é bem acima da economia de taxa do Pix. Confira se não foi
          um dígito a mais.
        </p>
      )}
    </Bloco>
  )
}
