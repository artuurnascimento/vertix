/**
 * Instância única do `MercadoPago` para os Secure Fields.
 *
 * Por que uma só por página: os campos seguros, `getPaymentMethods` e
 * `getInstallments` precisam sair da MESMA instância — é ela que guarda a
 * sessão de device fingerprint que o MP usa para aprovar a compra. Duas
 * instâncias significariam dois fingerprints e uma tokenização que não
 * conversa com as consultas de BIN.
 *
 * O carregamento do `<script>` NÃO é reimplementado aqui: `carregarMpSdk()` de
 * `../mpSdk` já memoriza a tag e o Brick usa a mesma. Um terceiro carregador
 * baixaria o SDK de novo e desperdiçaria a memoização dos outros dois.
 */

import { MP_PUBLIC_KEY } from '../checkoutApi'
import { carregarMpSdk } from '../mpSdk'
import type { ConstrutorMp, InstanciaMp } from './mpTipos'

/**
 * Acesso ao SDK global com a forma de `fields`.
 *
 * Deliberadamente SEM `declare global`: `mpSdk.ts` já declara o mesmo membro
 * com a forma de `bricks`, e duas declarações do mesmo símbolo em arquivos
 * diferentes fazem o TypeScript recusar o build inteiro (TS2717). O cast local
 * mantém os dois módulos independentes.
 */
function construtorMp(): ConstrutorMp | undefined {
  return (window as unknown as { MercadoPago?: ConstrutorMp }).MercadoPago
}

/**
 * Promessa memorizada, não a instância pronta: dois componentes montando no
 * mesmo tick (o normal no StrictMode do React 19) chamariam `new MercadoPago`
 * duas vezes se a memória guardasse só o resultado.
 */
/**
 * Chave do Mercado Pago para ESTE caminho, e só para ele.
 *
 * Env separada de propósito. A chave do `checkoutApi` é lida também pelo
 * Payment Brick, que hoje serve todo o tráfego: apontar aquela para uma conta
 * `TEST-...` faria o Brick recusar todo cartão real, e `?sf=0` não salvaria
 * ninguém, porque env é resolvida no build e não na URL.
 *
 * Com esta aqui, `VITE_MP_PUBLIC_KEY_SF=TEST-...` roda os cartões de teste no
 * formulário novo enquanto o Brick continua vendendo com a chave real.
 */
function chaveDosCampos(): string {
  const daEnv = import.meta.env.VITE_MP_PUBLIC_KEY_SF as string | undefined
  return daEnv && daEnv.trim() !== '' ? daEnv : MP_PUBLIC_KEY
}

let promessa: Promise<InstanciaMp> | null = null

export async function obterInstanciaMp(): Promise<InstanciaMp> {
  if (promessa) return promessa

  promessa = carregarMpSdk()
    .then(() => {
      const MercadoPago = construtorMp()
      if (!MercadoPago) throw new Error('sdk_indisponivel')
      return new MercadoPago(chaveDosCampos(), { locale: 'pt-BR' })
    })
    .catch((causa: unknown) => {
      // Falha zera a memória para que a próxima tentativa não herde a rejeição
      // — mesma regra do carregador do <script>.
      promessa = null
      throw causa
    })

  return promessa
}

/** Descarta a instância memorizada. Existe para os testes; a página não usa —
 *  trocar de instância no meio de um checkout invalidaria os campos montados. */
export function esquecerInstanciaMp(): void {
  promessa = null
}
