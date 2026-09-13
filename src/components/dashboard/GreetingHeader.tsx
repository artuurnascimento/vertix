import { useEffect, useState } from 'react'
import { useAuth } from '../../lib/auth'

export default function GreetingHeader() {
  const { profile } = useAuth()
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(timer)
  }, [])
  const greeting =
    now.getHours() < 12
      ? 'Bom dia'
      : now.getHours() < 18
        ? 'Boa tarde'
        : 'Boa noite'
  const name = profile?.nome?.trim().split(/\s+/)[0]
  return (
    <div className="vx-greeting">
      <div>
        <h1 className="sr-only">Visão geral</h1>
        <p className="vx-greeting-title">
          {greeting}
          {name && (
            <>
              , <span>{name}</span>
            </>
          )}
        </p>
        <p className="vx-greeting-subtitle">
          Sua operação conectada, do primeiro contato à entrega.
        </p>
      </div>
      <div className="vx-clock">
        <time dateTime={now.toISOString()}>
          {now.toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </time>
        <span>
          {now.toLocaleDateString('pt-BR', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          })}
        </span>
      </div>
    </div>
  )
}
