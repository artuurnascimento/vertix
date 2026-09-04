/**
 * Fundo das superfícies públicas da Vertix — as mesmas camadas do hero do
 * Vertix Scan (raiox-vertix/web), para as duas parecerem a mesma marca:
 *
 * 1. radial preto no topo virando indigo nas bordas, entrando em escala;
 * 2. atmosfera: glow violeta suave + grade de 44px.
 *
 * O Scan também tem feixes de luz percorrendo a grade; aqui eles ficaram de
 * fora por decisão de design. Sem eles o fundo é só CSS, sem canvas nem
 * quadro de animação.
 *
 * Uma diferença em relação ao original: lá o fundo é `-z-10` dentro de uma
 * seção com `isolate`. Aqui o elemento raiz da aplicação tem preto opaco, e
 * índice negativo jogaria tudo para trás dele. Por isso a camada é z-0 e o
 * conteúdo da página fica acima por vir depois no DOM.
 */

export default function VertixBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 bg-bg">
      <div className="vx-bio-fundo absolute inset-0 [background:radial-gradient(125%_125%_at_50%_10%,#0C0C0C_40%,#5546E0_100%)]" />
      <div className="vx-bio-atmosfera absolute inset-0" />
    </div>
  )
}
