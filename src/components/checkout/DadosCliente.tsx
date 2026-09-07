import type { ClienteCheckout } from './checkoutApi'
import {
  mascararDocumento,
  mascararWhatsapp,
  type CampoCliente,
  type ErrosCliente,
} from './clienteForm'

interface Props {
  cliente: ClienteCheckout
  erros: ErrosCliente
  exigeDocumento: boolean
  onChange: (campo: CampoCliente, valor: string) => void
}

/**
 * Dados do comprador. Quatro campos no máximo, cada um com rótulo associado,
 * `autoComplete` real (o navegador preenche sozinho) e `inputMode` certo — no
 * celular isso decide se o teclado abre numérico ou alfabético.
 */
export default function DadosCliente({
  cliente,
  erros,
  exigeDocumento,
  onChange,
}: Props) {
  return (
    <fieldset className="rounded-2xl border border-white/5 bg-surface-1 p-5 sm:p-6">
      <legend className="px-1 text-[11px] font-medium uppercase tracking-[0.25em] text-muted">
        Seus dados
      </legend>

      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <Campo
          campo="nome"
          rotulo="Nome completo"
          valor={cliente.nome}
          erro={erros.nome}
          autoComplete="name"
          className="sm:col-span-2"
          onChange={onChange}
        />
        <Campo
          campo="email"
          rotulo="E-mail"
          tipo="email"
          inputMode="email"
          valor={cliente.email}
          erro={erros.email}
          autoComplete="email"
          dica="É para onde vai o comprovante e o acesso."
          className="sm:col-span-2"
          onChange={onChange}
        />
        <Campo
          campo="whatsapp"
          rotulo="WhatsApp"
          tipo="tel"
          inputMode="tel"
          valor={cliente.whatsapp}
          erro={erros.whatsapp}
          autoComplete="tel-national"
          placeholder="(00) 00000-0000"
          mascara={mascararWhatsapp}
          onChange={onChange}
        />
        {/* O documento fica visível sempre, mas só é obrigatório quando o
            checkout exige. Ele vira a identificação do pagador no Mercado
            Pago, e cartão com identificação é aprovado com mais frequência —
            pedir é útil; travar quem não quer dar, não. */}
        <Campo
          campo="documento"
          rotulo={exigeDocumento ? 'CPF ou CNPJ' : 'CPF ou CNPJ (opcional)'}
          inputMode="numeric"
          valor={cliente.documento}
          erro={erros.documento}
          placeholder="000.000.000-00"
          mascara={mascararDocumento}
          onChange={onChange}
        />
      </div>
    </fieldset>
  )
}

function Campo({
  campo,
  rotulo,
  valor,
  erro,
  tipo = 'text',
  inputMode,
  autoComplete,
  placeholder,
  dica,
  className,
  mascara,
  onChange,
}: {
  campo: CampoCliente
  rotulo: string
  valor: string
  erro?: string
  tipo?: string
  inputMode?: 'email' | 'tel' | 'numeric'
  autoComplete?: string
  placeholder?: string
  dica?: string
  className?: string
  mascara?: (valor: string) => string
  onChange: (campo: CampoCliente, valor: string) => void
}) {
  const id = `cliente-${campo}`
  const erroId = `${id}-erro`
  const dicaId = `${id}-dica`

  return (
    <div className={className}>
      <label htmlFor={id} className="text-xs font-light text-muted">
        {rotulo}
      </label>
      <input
        id={id}
        name={campo}
        type={tipo}
        value={valor}
        inputMode={inputMode}
        autoComplete={autoComplete}
        placeholder={placeholder}
        aria-invalid={erro !== undefined}
        aria-describedby={
          [erro ? erroId : null, dica ? dicaId : null]
            .filter(Boolean)
            .join(' ') || undefined
        }
        onChange={(e) =>
          onChange(campo, mascara ? mascara(e.target.value) : e.target.value)
        }
        className={[
          'mt-1.5 w-full rounded-xl border bg-surface-2 px-3 py-2.5 text-sm text-ink placeholder:text-muted/60 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent',
          erro ? 'border-red-400/50' : 'border-white/10 focus:border-accent/60',
        ].join(' ')}
      />
      {erro ? (
        // role=alert: o erro é anunciado no momento em que aparece.
        <p id={erroId} role="alert" className="mt-1.5 text-xs text-red-300">
          {erro}
        </p>
      ) : (
        dica && (
          <p id={dicaId} className="mt-1.5 text-xs font-light text-muted/70">
            {dica}
          </p>
        )
      )}
    </div>
  )
}
