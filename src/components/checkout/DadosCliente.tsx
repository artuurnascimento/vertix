import { IdCard, Phone, User } from 'lucide-react'
import CartaoSecao from './CartaoSecao'
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
 *
 * Nome e e-mail ocupam a linha inteira; WhatsApp e documento dividem a última,
 * e voltam a empilhar no celular para o polegar não ter de mirar em meio campo.
 */
export default function DadosCliente({
  cliente,
  erros,
  exigeDocumento,
  onChange,
}: Props) {
  return (
    <CartaoSecao
      icone={<User className="h-3.5 w-3.5" />}
      titulo="Seus dados"
      aside={
        <span className="text-xs font-light text-muted/80">
          Usaremos seus dados apenas para o acesso.
        </span>
      }
    >
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
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
          icone={<Phone className="h-4 w-4" />}
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
          icone={<IdCard className="h-4 w-4" />}
          mascara={mascararDocumento}
          onChange={onChange}
        />
      </div>
    </CartaoSecao>
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
  icone,
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
  /** Ícone decorativo dentro do campo, à esquerda. */
  icone?: React.ReactNode
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
      <div className="relative mt-1.5">
        {icone && (
          <span
            aria-hidden
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted/70"
          >
            {icone}
          </span>
        )}
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
            'w-full rounded-xl border bg-surface-2 py-3 text-sm text-ink transition-colors placeholder:text-muted/60 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent',
            icone ? 'pl-11 pr-4' : 'px-4',
            erro ? 'border-red-400/50' : 'border-white/10 focus:border-accent/60',
          ].join(' ')}
        />
      </div>
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
