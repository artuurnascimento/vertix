import { AlertTriangle, Clock } from 'lucide-react'
import { Bloco, inputClass, labelClass } from '../produtos/formUi'
import {
  CRONOMETRO_COR_FUNDO_PADRAO,
  CRONOMETRO_COR_TEXTO_PADRAO,
  CRONOMETRO_TEXTO_PADRAO,
} from '../checkout/checkoutTotal'
import {
  CRONOMETRO_MINUTOS_MAXIMO,
  CRONOMETRO_TEXTO_MAXIMO,
  corHexValida,
  cronometroExpirado,
  type CronometroModo,
} from './checkoutForm'

interface Props {
  garantiaDias: string
  garantiaTexto: string
  cronometroAte: string
  cronometroModo: CronometroModo
  cronometroMinutos: string
  cronometroTexto: string
  cronometroCorFundo: string
  cronometroCorTexto: string
  erroDias?: string
  erroCronometro?: string
  erroCronometroTexto?: string
  erroCronometroCores?: string
  onGarantiaDias: (valor: string) => void
  onGarantiaTexto: (valor: string) => void
  onCronometroAte: (valor: string) => void
  onCronometroModo: (valor: CronometroModo) => void
  onCronometroMinutos: (valor: string) => void
  onCronometroTexto: (valor: string) => void
  onCronometroCorFundo: (valor: string) => void
  onCronometroCorTexto: (valor: string) => void
}

const MODOS: ReadonlyArray<{ valor: CronometroModo; titulo: string; descricao: string }> = [
  {
    valor: 'data',
    titulo: 'Data e hora de fim',
    descricao: 'Prazo real, o mesmo para todo mundo. Passou, o contador some.',
  },
  {
    valor: 'minutos',
    titulo: 'Minutos por visitante',
    descricao: 'Cada pessoa vê a contagem a partir da primeira abertura; ao zerar, fica em 00:00.',
  },
]

/**
 * Garantia e cronômetro. O cronômetro tem dois modos, e o painel diz com
 * todas as letras o que cada um faz: o de DATA é um prazo real, guardado como
 * instante absoluto (passou, sumiu); o de MINUTOS é por visitante, guardado no
 * navegador de cada um e reiniciado ao zerar. Só o modo escolhido é gravado.
 */
export default function GarantiaCronometroBloco({
  garantiaDias,
  garantiaTexto,
  cronometroAte,
  cronometroModo,
  cronometroMinutos,
  cronometroTexto,
  cronometroCorFundo,
  cronometroCorTexto,
  erroDias,
  erroCronometro,
  erroCronometroTexto,
  erroCronometroCores,
  onGarantiaDias,
  onGarantiaTexto,
  onCronometroAte,
  onCronometroModo,
  onCronometroMinutos,
  onCronometroTexto,
  onCronometroCorFundo,
  onCronometroCorTexto,
}: Props) {
  const expirado = cronometroExpirado(cronometroAte)

  return (
    <>
      <Bloco titulo="Garantia" ajuda="Aparece perto do botão de compra.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[10rem_1fr]">
          <label className="flex flex-col gap-1.5">
            <span className={labelClass}>Dias</span>
            <input
              type="number"
              min={0}
              value={garantiaDias}
              onChange={(e) => onGarantiaDias(e.target.value)}
              placeholder="7"
              className={`${inputClass} tabular-nums`}
            />
            {erroDias && <span className="text-xs text-red-400">{erroDias}</span>}
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelClass}>Texto</span>
            <input
              type="text"
              value={garantiaTexto}
              onChange={(e) => onGarantiaTexto(e.target.value)}
              placeholder="Se não gostar, devolvemos o valor integral."
              className={inputClass}
            />
          </label>
        </div>
      </Bloco>

      <Bloco
        titulo="Cronômetro"
        ajuda="Dois jeitos de contar. Data e hora de fim: prazo real, igual para todo mundo — passou, o contador some. Minutos por visitante: cada pessoa vê N minutos a partir da primeira abertura e, ao zerar, a faixa fica em 00:00 piscando."
      >
        <div
          role="radiogroup"
          aria-label="Modo do cronômetro"
          className="grid grid-cols-1 gap-2 sm:grid-cols-2"
        >
          {MODOS.map((modo) => {
            const ativo = cronometroModo === modo.valor
            return (
              <label
                key={modo.valor}
                className={[
                  'flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition-colors',
                  ativo
                    ? 'border-accent bg-accent/10'
                    : 'border-white/10 hover:border-white/20',
                ].join(' ')}
              >
                <input
                  type="radio"
                  name="cronometro-modo"
                  value={modo.valor}
                  checked={ativo}
                  onChange={() => onCronometroModo(modo.valor)}
                  className="mt-1 h-4 w-4 accent-[var(--accent,#6c5bf2)]"
                />
                <span className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium text-ink">{modo.titulo}</span>
                  <span className="text-xs font-light leading-relaxed text-muted">
                    {modo.descricao}
                  </span>
                </span>
              </label>
            )
          })}
        </div>

        {cronometroModo === 'data' ? (
          <label className="flex flex-col gap-1.5">
            <span className={labelClass}>Termina em</span>
            <input
              type="datetime-local"
              value={cronometroAte}
              onChange={(e) => onCronometroAte(e.target.value)}
              className={`${inputClass} tabular-nums`}
            />
            <span className="inline-flex items-center gap-1.5 text-xs font-light text-muted">
              <Clock aria-hidden className="h-3.5 w-3.5" />
              Deixe vazio para vender sem cronômetro.
            </span>
            {expirado && (
              <span className="inline-flex items-center gap-1.5 text-xs text-amber-300">
                <AlertTriangle aria-hidden className="h-3.5 w-3.5" />
                Esse prazo já passou: a página vai abrir sem contador nenhum.
              </span>
            )}
            {erroCronometro && (
              <span className="text-xs text-red-400">{erroCronometro}</span>
            )}
          </label>
        ) : (
          <label className="flex flex-col gap-1.5">
            <span className={labelClass}>Minutos por visitante</span>
            <input
              type="number"
              min={1}
              max={CRONOMETRO_MINUTOS_MAXIMO}
              value={cronometroMinutos}
              onChange={(e) => onCronometroMinutos(e.target.value)}
              placeholder="15"
              className={`${inputClass} tabular-nums sm:max-w-[10rem]`}
            />
            <span className="inline-flex items-center gap-1.5 text-xs font-light text-muted">
              <Clock aria-hidden className="h-3.5 w-3.5" />
              A contagem começa na primeira abertura da página e fica guardada no
              navegador da pessoa — recarregar não zera. Ao chegar a zero, fica em 00:00 piscando.
              Deixe vazio para vender sem cronômetro.
            </span>
            {erroCronometro && (
              <span className="text-xs text-red-400">{erroCronometro}</span>
            )}
          </label>
        )}
        <label className="flex flex-col gap-1.5">
          <span className={labelClass}>Frase do cronômetro</span>
          <input
            type="text"
            maxLength={CRONOMETRO_TEXTO_MAXIMO}
            value={cronometroTexto}
            onChange={(e) => onCronometroTexto(e.target.value)}
            placeholder={CRONOMETRO_TEXTO_PADRAO}
            className={inputClass}
          />
          <span className="text-xs font-light text-muted">
            Aparece ao lado do tempo, na faixa roxa do topo. Vazio = "{CRONOMETRO_TEXTO_PADRAO}".
          </span>
          {erroCronometroTexto && (
            <span className="text-xs text-red-400">{erroCronometroTexto}</span>
          )}
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <CampoCor
            rotulo="Cor do fundo da faixa"
            valor={cronometroCorFundo}
            padrao={CRONOMETRO_COR_FUNDO_PADRAO}
            nomeDoPadrao="roxo Vertix"
            onChange={onCronometroCorFundo}
          />
          <CampoCor
            rotulo="Cor do texto da faixa"
            valor={cronometroCorTexto}
            padrao={CRONOMETRO_COR_TEXTO_PADRAO}
            nomeDoPadrao="branco"
            onChange={onCronometroCorTexto}
          />
        </div>
        <div
          aria-hidden
          className="flex items-center justify-center gap-4 rounded-lg px-4 py-2.5 text-sm"
          style={{
            background: corHexValida(cronometroCorFundo) && cronometroCorFundo.trim() ? cronometroCorFundo : CRONOMETRO_COR_FUNDO_PADRAO,
            color: corHexValida(cronometroCorTexto) && cronometroCorTexto.trim() ? cronometroCorTexto : CRONOMETRO_COR_TEXTO_PADRAO,
          }}
        >
          <span className="text-lg font-semibold tabular-nums tracking-[0.08em]">14:52</span>
          <Clock aria-hidden className="h-4 w-4" />
          <span className="font-light">{cronometroTexto.trim() || CRONOMETRO_TEXTO_PADRAO}</span>
        </div>
        {erroCronometroCores && (
          <span className="text-xs text-red-400">{erroCronometroCores}</span>
        )}
      </Bloco>
    </>
  )
}

/**
 * Seletor de cor com o hex ao lado (dá para colar "#1a1a1a") e um atalho
 * para voltar ao padrão. O seletor nativo só entende hex de 6 dígitos, por
 * isso ele mostra o padrão enquanto o campo está vazio ou incompleto.
 */
function CampoCor({
  rotulo,
  valor,
  padrao,
  nomeDoPadrao,
  onChange,
}: {
  rotulo: string
  valor: string
  padrao: string
  nomeDoPadrao: string
  onChange: (valor: string) => void
}) {
  const valida = corHexValida(valor) && valor.trim() !== ''
  return (
    <label className="flex flex-col gap-1.5">
      <span className={labelClass}>{rotulo}</span>
      <span className="flex items-center gap-2">
        <input
          type="color"
          aria-label={`${rotulo} (seletor)`}
          value={valida ? valor.trim().toLowerCase() : padrao}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-12 shrink-0 cursor-pointer rounded-lg border border-white/5 bg-surface-2 p-1"
        />
        <input
          type="text"
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`${padrao} (${nomeDoPadrao})`}
          maxLength={7}
          spellCheck={false}
          className={`${inputClass} font-mono uppercase`}
        />
        {valor.trim() !== '' && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="shrink-0 text-xs text-muted underline-offset-2 hover:text-ink hover:underline"
          >
            Padrão
          </button>
        )}
      </span>
    </label>
  )
}
