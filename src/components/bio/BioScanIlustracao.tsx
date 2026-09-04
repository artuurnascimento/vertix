/**
 * Ilustração do card de destaque: um card inclinado com "Analisando loja…"
 * e barras de progresso violeta, com brilho atrás. Só decoração — aria-hidden.
 * As barras se preenchem uma vez, em sequência, depois de o card entrar
 * (atraso relativo a --entrada-atraso, herdado do card). Sem laço.
 */
export default function BioScanIlustracao() {
  return (
    <span aria-hidden className="vx-scan-ilu relative block h-[74px] w-[96px] shrink-0">
      <span className="vx-scan-brilho absolute inset-1 rounded-full bg-accent/60 blur-2xl" />
      <span className="vx-scan-tela absolute inset-0 rounded-xl border border-accent/45 bg-[#13112a] p-2 shadow-[0_12px_30px_-10px_rgba(108,91,242,0.85)]">
        <span className="block text-[7px] font-medium uppercase leading-[1.25] tracking-[0.22em] text-ink/85">
          Analisando
          <br />
          loja…
        </span>
        <span className="mt-1.5 flex flex-col gap-[4px]">
          <span className="vx-scan-barra h-[3px] w-full rounded-full bg-white/10" />
          <span className="vx-scan-barra vx-scan-barra--roxa h-[5px] w-[86%] rounded-full" />
          <span className="vx-scan-barra vx-scan-barra--roxa h-[5px] w-[68%] rounded-full" />
          <span className="vx-scan-barra vx-scan-barra--roxa h-[5px] w-[92%] rounded-full" />
        </span>
      </span>
    </span>
  )
}
