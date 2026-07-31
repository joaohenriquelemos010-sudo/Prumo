import { describe, it, expect } from 'vitest'
import { quandoLembrar, dataDaSemanaGestacional, dataDoMesDeVida } from './quando.js'

const DIA = 86_400_000
/** DPP fixa, para que nenhuma asserção dependa de quando o teste roda. */
const DPP = new Date('2026-01-01T12:00:00Z')

describe('dataDaSemanaGestacional', () => {
  it('a semana 40 é a própria DPP', () => {
    expect(dataDaSemanaGestacional(DPP, 40).getTime()).toBe(DPP.getTime())
  })

  it('cada semana anterior recua exatamente sete dias', () => {
    const s24 = dataDaSemanaGestacional(DPP, 24)
    expect((DPP.getTime() - s24.getTime()) / DIA).toBe(16 * 7)
  })
})

describe('dataDoMesDeVida', () => {
  it('anda em meses de calendário, não em blocos de 30 dias', () => {
    const nasc = new Date('2026-01-31T00:00:00Z')
    // Fevereiro não tem dia 31 — o comportamento do Date é transbordar para
    // março, e isso é aceitável aqui: o lembrete de "2 meses" vale a semana,
    // não o dia exato. O teste existe para fixar o comportamento, não para
    // fingir que ele é outro.
    const doisMeses = dataDoMesDeVida(nasc, 2)
    expect(doisMeses.getUTCFullYear()).toBe(2026)
    expect(doisMeses.getUTCMonth()).toBe(2) // março
  })
})

describe('quandoLembrar', () => {
  const ancoraGestante = { dpp: DPP, nascimento: null }

  it('sem janela, não agenda nada', () => {
    expect(quandoLembrar(undefined, 0, ancoraGestante, new Date('2025-08-01'))).toBeNull()
  })

  it('sem âncora, não agenda nada — "semana 24" não aponta para nenhum dia', () => {
    const r = quandoLembrar({ desdeSemana: 24, ateSemana: 28 }, 0, { dpp: null }, new Date('2025-08-01'))
    expect(r).toBeNull()
  })

  it('agenda na abertura da janela quando ela ainda está no futuro', () => {
    const agora = new Date('2025-06-01T00:00:00Z')
    const r = quandoLembrar({ desdeSemana: 24, ateSemana: 28 }, 0, ancoraGestante, agora)
    expect(r?.toISOString()).toBe(dataDaSemanaGestacional(DPP, 24).toISOString())
  })

  it('respeita a antecedência em dias', () => {
    const agora = new Date('2025-06-01T00:00:00Z')
    const semAntecedencia = quandoLembrar({ desdeSemana: 24 }, 0, ancoraGestante, agora)!
    const comAntecedencia = quandoLembrar({ desdeSemana: 24 }, 7, ancoraGestante, agora)!
    expect((semAntecedencia.getTime() - comAntecedencia.getTime()) / DIA).toBe(7)
  })

  /**
   * O teste que justifica o módulo existir. Sem ele, atribuir um checklist na
   * semana 30 dispararia, de uma vez, o lembrete de cada grupo das semanas 1
   * a 29 — e a paciente receberia um resumo de coisas que já passaram.
   */
  it('não agenda nada para uma janela que já fechou', () => {
    // Semana 30 acontece 70 dias antes da DPP.
    const semana30 = dataDaSemanaGestacional(DPP, 30)
    const r = quandoLembrar({ desdeSemana: 6, ateSemana: 13 }, 0, ancoraGestante, semana30)
    expect(r).toBeNull()
  })

  it('janela aberta agora dispara agora, e nunca no passado', () => {
    const semana25 = dataDaSemanaGestacional(DPP, 25)
    const r = quandoLembrar({ desdeSemana: 24, ateSemana: 28 }, 0, ancoraGestante, semana25)!
    expect(r.getTime()).toBe(semana25.getTime())
  })

  it('janela sem fim declarado continua valendo depois da abertura', () => {
    const semana35 = dataDaSemanaGestacional(DPP, 35)
    const r = quandoLembrar({ desdeSemana: 20 }, 0, ancoraGestante, semana35)
    expect(r).not.toBeNull()
  })

  it('usa meses de vida quando a janela é pós-natal', () => {
    const nasc = new Date('2026-01-01T00:00:00Z')
    const agora = new Date('2026-01-05T00:00:00Z')
    const r = quandoLembrar({ desdeMes: 4, ateMes: 6 }, 0, { dpp: null, nascimento: nasc }, agora)
    expect(r?.getUTCMonth()).toBe(4) // maio
  })

  it('a semana ganha da idade em meses quando a jornada tem as duas âncoras', () => {
    const agora = new Date('2025-06-01T00:00:00Z')
    const r = quandoLembrar(
      { desdeSemana: 24, desdeMes: 4 },
      0,
      { dpp: DPP, nascimento: new Date('2020-01-01') },
      agora,
    )
    expect(r?.toISOString()).toBe(dataDaSemanaGestacional(DPP, 24).toISOString())
  })
})
