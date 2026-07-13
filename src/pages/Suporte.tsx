import TicketsList from '../components/support/TicketsList'

export default function Suporte() {
  return (
    <div>
      <div>
        <h1 className="hero-heading font-kanit text-4xl font-bold leading-tight sm:text-5xl">
          Suporte
        </h1>
        <p className="mt-2 text-sm font-light text-muted">
          Fila de chamados abertos pelos clientes nos projetos ativos.
        </p>
      </div>

      <TicketsList />
    </div>
  )
}
