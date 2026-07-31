import { describe, it, expect } from 'vitest'
import {
  ZONA_PADRAO,
  chaveDia,
  diaSemanaNaZona,
  horaNaZona,
  minutosDoDia,
  partesDaData,
  somarDias,
  diaSemanaDaChave,
  zonaParaUtc,
} from './fuso.js'

/**
 * O fuso.
 *
 * Todo horário do produto passa por aqui, e é o tipo de módulo em que um erro
 * não quebra nada visivelmente — só coloca a consulta uma hora fora do lugar, o
 * que ninguém percebe até alguém chegar atrasado.
 *
 * Os testes usam `America/New_York` para o horário de verão. O Brasil não o
 * observa desde 2019, mas o motor calcula via `Intl` e uma clínica em outro fuso
 * é uma linha de configuração — o comportamento na transição precisa estar
 * fixado antes de alguém depender dele.
 */
describe('chaveDia', () => {
  it('usa o dia do fuso, e não o dia UTC', () => {
    // 02:00 UTC de 10/03 é ainda 23:00 de 09/03 em São Paulo.
    const instante = new Date('2026-03-10T02:00:00Z')
    expect(chaveDia(instante, ZONA_PADRAO)).toBe('2026-03-09')
  })

  it('o padrão é São Paulo', () => {
    const instante = new Date('2026-03-10T02:00:00Z')
    expect(chaveDia(instante)).toBe(chaveDia(instante, ZONA_PADRAO))
  })
})

describe('diaSemanaNaZona', () => {
  it('0 é domingo', () => {
    expect(diaSemanaNaZona(new Date('2026-03-08T15:00:00Z'), ZONA_PADRAO)).toBe(0)
  })

  it('vira o dia no fuso, não no UTC', () => {
    // 02:00 UTC de segunda ainda é domingo em São Paulo.
    expect(diaSemanaNaZona(new Date('2026-03-09T02:00:00Z'), ZONA_PADRAO)).toBe(0)
  })
})

describe('horaNaZona', () => {
  it('devolve HH:MM no fuso pedido', () => {
    expect(horaNaZona(new Date('2026-03-09T12:00:00Z'), ZONA_PADRAO)).toBe('09:00')
  })

  it('usa 24 horas, e não am/pm', () => {
    expect(horaNaZona(new Date('2026-03-09T23:30:00Z'), ZONA_PADRAO)).toBe('20:30')
  })
})

describe('minutosDoDia', () => {
  it('converte HH:MM em minutos desde a meia-noite', () => {
    expect(minutosDoDia('00:00')).toBe(0)
    expect(minutosDoDia('09:30')).toBe(570)
    expect(minutosDoDia('23:59')).toBe(1439)
  })

  it('devolve null para o que não é hora — e não zero', () => {
    // Zero seria meia-noite, um horário válido. Confundir "inválido" com
    // "meia-noite" faria uma regra quebrada virar um turno da madrugada.
    expect(minutosDoDia('')).toBeNull()
    expect(minutosDoDia('nove horas')).toBeNull()
    expect(minutosDoDia('25:00')).toBeNull()
    expect(minutosDoDia('09:70')).toBeNull()
  })
})

describe('partesDaData', () => {
  it('quebra YYYY-MM-DD', () => {
    expect(partesDaData('2026-03-09')).toEqual({ ano: 2026, mes: 3, dia: 9 })
  })

  it('recusa o que não é data', () => {
    expect(partesDaData('09/03/2026')).toBeNull()
    expect(partesDaData('2026-13-01')).toBeNull()
    expect(partesDaData('')).toBeNull()
  })
})

describe('somarDias', () => {
  it('anda um dia', () => {
    expect(somarDias('2026-03-09', 1)).toBe('2026-03-10')
  })

  it('atravessa o fim do mês', () => {
    expect(somarDias('2026-01-31', 1)).toBe('2026-02-01')
  })

  it('atravessa o fim do ano', () => {
    expect(somarDias('2026-12-31', 1)).toBe('2027-01-01')
  })

  it('acerta fevereiro em ano bissexto', () => {
    expect(somarDias('2028-02-28', 1)).toBe('2028-02-29')
    expect(somarDias('2026-02-28', 1)).toBe('2026-03-01')
  })

  it('anda para trás', () => {
    expect(somarDias('2026-03-01', -1)).toBe('2026-02-28')
  })
})

describe('diaSemanaDaChave', () => {
  it('casa com o dia da semana real', () => {
    expect(diaSemanaDaChave('2026-03-08')).toBe(0) // domingo
    expect(diaSemanaDaChave('2026-03-09')).toBe(1) // segunda
    expect(diaSemanaDaChave('2026-03-14')).toBe(6) // sábado
  })

  /**
   * Uma chave de dia não tem hora, então não pode depender de fuso: se
   * dependesse, uma agenda de segunda apareceria no domingo para metade do
   * mundo.
   */
  it('não desliza com o fuso do processo', () => {
    expect(diaSemanaDaChave('2026-01-01')).toBe(4) // quinta
  })
})

describe('zonaParaUtc', () => {
  it('converte hora local em instante UTC', () => {
    // 09:00 em São Paulo (UTC−3) é 12:00 UTC.
    const utc = zonaParaUtc(2026, 3, 9, 9, 0, ZONA_PADRAO)
    expect(utc.toISOString()).toBe('2026-03-09T12:00:00.000Z')
  })

  it('a volta é consistente com horaNaZona', () => {
    const utc = zonaParaUtc(2026, 7, 15, 14, 30, ZONA_PADRAO)
    expect(horaNaZona(utc, ZONA_PADRAO)).toBe('14:30')
  })

  describe('horário de verão (America/New_York)', () => {
    /**
     * O que fixa o comportamento nos dois lados da transição. Em 08/03/2026 os
     * EUA entram no DST às 02:00 locais.
     */
    it('antes da virada usa o deslocamento de inverno (UTC−5)', () => {
      const utc = zonaParaUtc(2026, 3, 7, 12, 0, 'America/New_York')
      expect(utc.toISOString()).toBe('2026-03-07T17:00:00.000Z')
    })

    it('depois da virada usa o de verão (UTC−4)', () => {
      const utc = zonaParaUtc(2026, 3, 9, 12, 0, 'America/New_York')
      expect(utc.toISOString()).toBe('2026-03-09T16:00:00.000Z')
    })

    it('a ida e a volta continuam batendo nos dois lados', () => {
      for (const dia of [7, 9]) {
        const utc = zonaParaUtc(2026, 3, dia, 12, 0, 'America/New_York')
        expect(horaNaZona(utc, 'America/New_York')).toBe('12:00')
        expect(chaveDia(utc, 'America/New_York')).toBe(`2026-03-0${dia}`)
      }
    })
  })
})
