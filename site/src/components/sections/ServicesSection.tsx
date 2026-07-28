import FadeIn from '../ui/FadeIn'

interface Service {
  n: string
  name: string
  desc: string
}

const SERVICES: Service[] = [
  {
    n: '01',
    name: 'Lojas Shopify',
    desc: 'Criação completa de lojas Shopify: tema sob medida, checkout otimizado e experiência de compra pensada para converter visita em venda.',
  },
  {
    n: '02',
    name: 'Migração & Redesign',
    desc: 'Sua loja existe mas não performa? Migramos de qualquer plataforma para a Shopify sem perder dados, SEO nem vendas — e com cara nova.',
  },
  {
    n: '03',
    name: 'Sistemas sob medida',
    desc: 'Software feito para a sua operação: gestão, controle de acesso, dashboards e painéis — do banco de dados à interface.',
  },
  {
    n: '04',
    name: 'Integrações & Automação',
    desc: 'Conectamos loja, ERP, logística e marketing. Menos planilha e trabalho manual, mais dados fluindo entre as suas ferramentas.',
  },
  {
    n: '05',
    name: 'Design',
    desc: 'Identidade visual, UI e materiais de marca que fazem o seu negócio parecer do tamanho que ele quer ser.',
  },
]

export default function ServicesSection() {
  return (
    <section
      id="servicos"
      className="rounded-t-[40px] bg-ink px-5 py-20 sm:rounded-t-[50px] sm:px-8 sm:py-24 md:rounded-t-[60px] md:px-10 md:py-32"
    >
      <FadeIn y={40}>
        <h2
          className="mb-16 text-center font-black uppercase leading-none tracking-tight text-bg sm:mb-20 md:mb-28"
          style={{ fontSize: 'clamp(3rem, 12vw, 160px)' }}
        >
          Serviços
        </h2>
      </FadeIn>

      <div className="mx-auto max-w-5xl">
        {SERVICES.map((service, i) => (
          <FadeIn key={service.n} delay={i * 0.1}>
            <div
              className={`flex items-center gap-6 py-8 sm:gap-10 sm:py-10 md:py-12 ${i > 0 ? 'border-t' : ''}`}
              style={{ borderColor: 'rgba(12, 12, 12, 0.15)' }}
            >
              <span
                className="font-black leading-none text-bg"
                style={{ fontSize: 'clamp(3rem, 10vw, 140px)' }}
              >
                {service.n}
              </span>
              <div className="flex flex-col gap-2">
                <h3
                  className="font-medium uppercase text-bg"
                  style={{ fontSize: 'clamp(1rem, 2.2vw, 2.1rem)' }}
                >
                  {service.name}
                </h3>
                <p
                  className="max-w-2xl font-light leading-relaxed text-bg opacity-60"
                  style={{ fontSize: 'clamp(0.85rem, 1.6vw, 1.25rem)' }}
                >
                  {service.desc}
                </p>
              </div>
            </div>
          </FadeIn>
        ))}
      </div>
    </section>
  )
}
