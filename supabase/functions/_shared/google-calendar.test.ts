/**
 * Horários livres da marcação de call — sem rede.
 *
 *   deno test supabase/functions/_shared/google-calendar.test.ts
 */
import { assert, assertEquals } from 'jsr:@std/assert@1'
import { DURACAO_MIN, FUSO, horariosLivres } from './google-calendar.ts'

function horaSP(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso))
}
function diaSemanaSP(iso: string): string {
  return new Intl.DateTimeFormat('en-US', { timeZone: FUSO, weekday: 'short' }).format(new Date(iso))
}

// Terça-feira, 15/09/2026 10:00 em São Paulo (13:00Z).
const AGORA = new Date('2026-09-15T13:00:00.000Z')

Deno.test('todo dia da semana, só entre 9h e 22h de São Paulo, de 30 em 30 min', () => {
  const livres = horariosLivres(AGORA, [])
  assert(livres.length > 0)
  const dias = new Set(livres.map(diaSemanaSP))
  assert(dias.has('Sat') && dias.has('Sun'), 'fim de semana entra na agenda')
  for (const iso of livres) {
    const [h, m] = horaSP(iso).split(':').map(Number)
    assert(h >= 9 && h < 22, `fora do expediente: ${iso}`)
    assert(m % DURACAO_MIN === 0, `fora da grade: ${iso}`)
  }
  // Último horário do dia começa às 21:30 e termina às 22:00.
  assert(livres.some((iso) => horaSP(iso) === '21:30'))
  // Ordenado.
  const ts = livres.map((i) => Date.parse(i))
  assertEquals([...ts].sort((a, b) => a - b), ts)
})

Deno.test('nada antes de 24 h: às 10h de terça, o primeiro horário é quarta 10h', () => {
  const [primeiro] = horariosLivres(AGORA, [])
  assertEquals(diaSemanaSP(primeiro), 'Wed')
  assertEquals(horaSP(primeiro), '10:00')
})

Deno.test('um período ocupado tira os horários que batem nele, e só eles', () => {
  // Quarta 16/09, 14:00–15:00 SP = 17:00–18:00Z.
  const ocupado = [{ inicio: '2026-09-16T17:00:00.000Z', fim: '2026-09-16T18:00:00.000Z' }]
  const semNada = horariosLivres(AGORA, [])
  const comOcupado = horariosLivres(AGORA, ocupado)
  assertEquals(semNada.length - comOcupado.length, 2) // 14:00 e 14:30
  assert(!comOcupado.includes('2026-09-16T17:00:00.000Z'))
  assert(!comOcupado.includes('2026-09-16T17:30:00.000Z'))
  assert(comOcupado.includes('2026-09-16T18:00:00.000Z')) // 15:00 continua livre
})

Deno.test('ocupado que encosta na borda não bloqueia o vizinho', () => {
  // 13:30–14:00 SP bloqueia só o de 13:30.
  const ocupado = [{ inicio: '2026-09-16T16:30:00.000Z', fim: '2026-09-16T17:00:00.000Z' }]
  const livres = horariosLivres(AGORA, ocupado)
  assert(!livres.includes('2026-09-16T16:30:00.000Z'))
  assert(livres.includes('2026-09-16T16:00:00.000Z'))
  assert(livres.includes('2026-09-16T17:00:00.000Z'))
})
