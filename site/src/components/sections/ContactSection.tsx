import { AtSign, Loader2, Mail, MessageCircle } from 'lucide-react'
import { useState } from 'react'
import type { FormEvent } from 'react'
import FadeIn from '../ui/FadeIn'
import LogoMark from '../ui/LogoMark'
import { supabase } from '../../lib/supabase'
import { trackConversion } from '../../lib/vtx'

type TipoServico = 'ecommerce' | 'sistema' | 'site'

const TIPO_SERVICO_OPTIONS: { value: TipoServico; label: string }[] = [
  { value: 'ecommerce', label: 'Loja virtual' },
  { value: 'sistema', label: 'Sistema' },
  { value: 'site', label: 'Site' },
]

type SubmitStatus = 'idle' | 'loading' | 'success' | 'error'

const inputClassName =
  'w-full rounded-xl border bg-transparent px-4 py-3 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-colors duration-200'

export default function ContactSection() {
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [telefone, setTelefone] = useState('')
  const [tipoServico, setTipoServico] = useState<TipoServico>('site')
  const [mensagem, setMensagem] = useState('')
  const [status, setStatus] = useState<SubmitStatus>('idle')
  const [feedback, setFeedback] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!nome.trim() || !email.trim()) {
      setStatus('error')
      setFeedback('Preencha nome e email para continuar.')
      return
    }

    setStatus('loading')
    setFeedback('')

    try {
      const { error } = await supabase.rpc('create_lead', {
        p_nome: nome.trim(),
        p_email: email.trim(),
        p_telefone: telefone.trim() || null,
        p_tipo_servico: tipoServico,
        p_mensagem: mensagem.trim() || null,
      })

      if (error) {
        setStatus('error')
        setFeedback(error.message || 'Não foi possível enviar, tente novamente.')
        return
      }

      trackConversion({ tipo: 'lead' })
      setStatus('success')
      setFeedback('Recebemos seu contato! Retornaremos em breve.')
      setNome('')
      setEmail('')
      setTelefone('')
      setTipoServico('site')
      setMensagem('')
    } catch {
      setStatus('error')
      setFeedback('Não foi possível enviar, tente novamente.')
    }
  }

  return (
    <section
      id="contato"
      className="flex flex-col items-center gap-10 px-5 py-24 text-center sm:px-8 md:py-32"
    >
      <FadeIn y={40}>
        <h2
          className="hero-heading font-black uppercase leading-none tracking-tight"
          style={{ fontSize: 'clamp(3rem, 12vw, 160px)' }}
        >
          Vamos subir?
        </h2>
      </FadeIn>

      <FadeIn delay={0.15} y={20}>
        <p
          className="max-w-[520px] font-light leading-relaxed text-ink"
          style={{ fontSize: 'clamp(1rem, 2vw, 1.35rem)' }}
        >
          Conte o que você quer construir — loja nova, migração ou um sistema
          inteiro. A primeira conversa é por nossa conta.
        </p>
      </FadeIn>

      <FadeIn delay={0.3} y={20} className="w-full max-w-[560px]">
        <form onSubmit={handleSubmit} className="flex w-full flex-col gap-4 text-left" noValidate>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <input
              type="text"
              name="nome"
              placeholder="Seu nome*"
              autoComplete="name"
              required
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className={inputClassName}
              style={{ borderColor: '#22221B' }}
            />
            <input
              type="email"
              name="email"
              placeholder="Seu email*"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClassName}
              style={{ borderColor: '#22221B' }}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <input
              type="tel"
              name="telefone"
              placeholder="Telefone (opcional)"
              autoComplete="tel"
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              className={inputClassName}
              style={{ borderColor: '#22221B' }}
            />
            <select
              name="tipoServico"
              required
              value={tipoServico}
              onChange={(e) => setTipoServico(e.target.value as TipoServico)}
              className={inputClassName}
              style={{ borderColor: '#22221B' }}
            >
              {TIPO_SERVICO_OPTIONS.map((option) => (
                <option key={option.value} value={option.value} className="bg-bg text-ink">
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <textarea
            name="mensagem"
            placeholder="Conte um pouco sobre o projeto (opcional)"
            rows={4}
            value={mensagem}
            onChange={(e) => setMensagem(e.target.value)}
            className={`${inputClassName} resize-none`}
            style={{ borderColor: '#22221B' }}
          />

          <button
            type="submit"
            disabled={status === 'loading'}
            className="mx-auto inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full px-8 py-3 text-xs font-medium uppercase tracking-widest text-white transition-transform duration-200 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0 sm:px-10 sm:py-3.5 sm:text-sm md:px-12 md:py-4 md:text-base"
            style={{
              background:
                'linear-gradient(123deg, #16123F 7%, #6C5BF2 37%, #5546E0 72%, #3BB0E0 100%)',
              boxShadow:
                '0px 4px 4px rgba(108, 91, 242, 0.25), 4px 4px 12px #5546E0 inset',
              outline: '2px solid #F4F4F0',
              outlineOffset: '-3px',
            }}
          >
            {status === 'loading' && <Loader2 className="h-4 w-4 animate-spin" />}
            {status === 'loading' ? 'Enviando...' : 'Fale com a gente'}
          </button>

          {feedback && (
            <p
              role="status"
              aria-live="polite"
              className={`text-center text-sm ${
                status === 'success' ? 'text-accent' : 'text-red-400'
              }`}
            >
              {feedback}
            </p>
          )}
        </form>
      </FadeIn>

      <FadeIn delay={0.4} y={10}>
        <div className="flex items-center gap-6 text-muted">
          <a
            aria-label="WhatsApp"
            href="#contato"
            className="transition-colors duration-200 hover:text-accent"
          >
            <MessageCircle />
          </a>
          <a
            aria-label="E-mail"
            href="mailto:contato@vertix.studio"
            className="transition-colors duration-200 hover:text-accent"
          >
            <Mail />
          </a>
          <a
            aria-label="Instagram"
            href="#contato"
            className="transition-colors duration-200 hover:text-accent"
          >
            <AtSign />
          </a>
        </div>
      </FadeIn>

      <footer
        className="mt-10 flex w-full max-w-5xl flex-wrap items-center justify-between gap-4 border-t pt-6"
        style={{ borderColor: '#22221B' }}
      >
        <div className="flex items-center gap-2">
          <LogoMark className="h-6 w-5" />
          <span className="font-bold uppercase tracking-wide text-ink">
            VERT<i className="not-italic text-accent">I</i>X
          </span>
        </div>
        <p className="text-xs uppercase tracking-widest text-muted">
          © 2026 Vertix · vertix.studio
        </p>
      </footer>
    </section>
  )
}
