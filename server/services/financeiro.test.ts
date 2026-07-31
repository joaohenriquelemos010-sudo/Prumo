import { describe, it, expect } from 'vitest'
import { resumir, paraCentavos, reais, ehConvenio } from './financeiro.js'
import type { LinhaFinanceira } from './financeiro.js'
import { competenciaDe } from '../models/Recebimento.js'

function linha(over: Partial<LinhaFinanceira> = {}): LinhaFinanceira {
  return {
    valorCentavos: 30000,
    forma: 'pix',
    estado: 'recebido',
    dataAtendimento: '2026-03-10T14:00:00.000Z',
    ...over,
  }
}

describe('paraCentavos', () => {
  /**
   * O teste que justifica a função existir. `Number('1234.56') * 100` dá
   * `123455.99999999999` — arredondar isso na hora errada é como um centavo
   * some por atendimento e o mês fecha com diferença.
   */
  it('não perde centavo em ponto flutuante', () => {
    expect(paraCentavos('1234.56')).toBe(123456)
    expect(paraCentavos('0.07')).toBe(7)
    expect(paraCentavos('0.29')).toBe(29)
    expect(paraCentavos('8.11')).toBe(811)
  })

  it('entende o formato brasileiro', () => {
    expect(paraCentavos('1.234,56')).toBe(123456)
    expect(paraCentavos('350,00')).toBe(35000)
    expect(paraCentavos('R$ 1.234,56')).toBe(123456)
  })

  it('entende o formato com ponto decimal', () => {
    expect(paraCentavos('1,234.56')).toBe(123456)
    expect(paraCentavos('350.00')).toBe(35000)
  })

  it('sem casas decimais vira reais inteiros', () => {
    expect(paraCentavos('350')).toBe(35000)
  })

  /**
   * A ambiguidade que mais custa caro: `1.500` são mil e quinhentos reais ou um
   * real e cinquenta? A diferença é de mil vezes, e o erro não daria exceção
   * nenhuma — sairia uma cobrança de R$ 1,50 por uma consulta de R$ 1.500.
   *
   * A regra: um separador seguido de exatamente três dígitos é milhar, porque
   * moeda brasileira não tem três casas decimais.
   */
  it('desempata separador de milhar de separador decimal', () => {
    expect(paraCentavos('1.500')).toBe(150000)
    expect(paraCentavos('1,500')).toBe(150000)
    expect(paraCentavos('1.50')).toBe(150)
    expect(paraCentavos('1,50')).toBe(150)
    expect(paraCentavos('1.5')).toBe(150)
    // Com dois separadores não há dúvida: o último é o decimal.
    expect(paraCentavos('1.500,00')).toBe(150000)
    expect(paraCentavos('1,500.00')).toBe(150000)
    expect(paraCentavos('12.500,50')).toBe(1250050)
  })

  it('uma casa decimal só é completada, e não truncada', () => {
    // "10,5" é dez reais e cinquenta, não dez e cinco centavos.
    expect(paraCentavos('10,5')).toBe(1050)
  })

  it('mais de duas casas decimais é truncado, e não arredondado para cima', () => {
    // Quatro dígitos não é milhar (a regra é "exatamente três"), então vira
    // decimal e sobra. Truncar: cobrar um centavo a mais do que a pessoa
    // digitou é pior do que um a menos.
    expect(paraCentavos('10,9999')).toBe(1099)
    expect(paraCentavos('10.9999')).toBe(1099)
  })

  it('lixo vira zero em vez de NaN', () => {
    expect(paraCentavos('')).toBe(0)
    expect(paraCentavos('abc')).toBe(0)
  })

  it('número entra direto', () => {
    expect(paraCentavos(350)).toBe(35000)
    expect(paraCentavos(1234.56)).toBe(123456)
  })
})

describe('reais', () => {
  it('formata em BRL', () => {
    // O espaço do Intl é não-quebrável — comparar por conteúdo, não por byte.
    expect(reais(123456).replace(/\s/g, ' ')).toBe('R$ 1.234,56')
    expect(reais(0).replace(/\s/g, ' ')).toBe('R$ 0,00')
  })

  it('a ida e a volta fecham', () => {
    for (const centavos of [1, 7, 99, 35000, 123456, 999999]) {
      expect(paraCentavos(reais(centavos))).toBe(centavos)
    }
  })
})

describe('resumir', () => {
  it('separa o que entrou do que está prometido', () => {
    const r = resumir([
      linha({ valorCentavos: 30000, estado: 'recebido' }),
      linha({ valorCentavos: 25000, estado: 'previsto' }),
    ])
    expect(r.recebidoCentavos).toBe(30000)
    expect(r.previstoCentavos).toBe(25000)
    expect(r.totalCentavos).toBe(55000)
  })

  /**
   * Cancelado existe para o histórico, não para a soma. Contá-lo em "previsto"
   * faria o mês parecer maior do que é — que é exatamente o erro que uma pessoa
   * não percebe até fechar o caixa.
   */
  it('cancelado não conta em lugar nenhum', () => {
    const r = resumir([
      linha({ valorCentavos: 30000, estado: 'recebido' }),
      linha({ valorCentavos: 99900, estado: 'cancelado' }),
    ])
    expect(r.recebidoCentavos).toBe(30000)
    expect(r.previstoCentavos).toBe(0)
    expect(r.totalCentavos).toBe(30000)
    expect(r.atendimentos).toBe(1)
  })

  it('separa particular de convênio', () => {
    const r = resumir([
      linha({ valorCentavos: 30000, forma: 'pix' }),
      linha({ valorCentavos: 20000, forma: 'dinheiro' }),
      linha({ valorCentavos: 18000, forma: 'convenio', convenio: 'Unimed' }),
    ])
    expect(r.convenioCentavos).toBe(18000)
    expect(r.particularCentavos).toBe(50000)
    expect(r.particularCentavos + r.convenioCentavos).toBe(r.recebidoCentavos)
  })

  it('agrupa por forma, da maior para a menor', () => {
    const r = resumir([
      linha({ valorCentavos: 10000, forma: 'dinheiro' }),
      linha({ valorCentavos: 30000, forma: 'pix' }),
      linha({ valorCentavos: 20000, forma: 'pix' }),
    ])
    expect(r.porForma[0]).toEqual({ forma: 'pix', centavos: 50000, atendimentos: 2 })
    expect(r.porForma[1]).toEqual({ forma: 'dinheiro', centavos: 10000, atendimentos: 1 })
  })

  it('o previsto não entra no agrupamento por forma — ele ainda não entrou', () => {
    const r = resumir([
      linha({ valorCentavos: 30000, forma: 'pix', estado: 'recebido' }),
      linha({ valorCentavos: 99900, forma: 'pix', estado: 'previsto' }),
    ])
    expect(r.porForma[0].centavos).toBe(30000)
  })

  it('ticket médio usa só o recebido', () => {
    const r = resumir([
      linha({ valorCentavos: 30000, estado: 'recebido' }),
      linha({ valorCentavos: 20000, estado: 'recebido' }),
      linha({ valorCentavos: 99900, estado: 'previsto' }),
    ])
    expect(r.ticketMedioCentavos).toBe(25000)
  })

  it('mês vazio não vira divisão por zero', () => {
    const r = resumir([])
    expect(r.ticketMedioCentavos).toBe(0)
    expect(r.totalCentavos).toBe(0)
    expect(r.porForma).toEqual([])
  })

  it('mês só com previsto tem ticket médio zero, e não NaN', () => {
    const r = resumir([linha({ estado: 'previsto' })])
    expect(r.ticketMedioCentavos).toBe(0)
  })

  /** Cem consultas somadas têm que fechar exatamente. É o ponto de tudo isto. */
  it('cem atendimentos fecham no centavo', () => {
    const linhas = Array.from({ length: 100 }, (_, i) =>
      linha({ valorCentavos: 30000 + i, estado: 'recebido' }),
    )
    const esperado = 100 * 30000 + (99 * 100) / 2
    expect(resumir(linhas).recebidoCentavos).toBe(esperado)
  })
})

describe('ehConvenio', () => {
  it('só a forma convenio', () => {
    expect(ehConvenio('convenio')).toBe(true)
    expect(ehConvenio('pix')).toBe(false)
  })
})

describe('competenciaDe', () => {
  it('devolve AAAA-MM com mês de dois dígitos', () => {
    expect(competenciaDe(new Date(2026, 0, 15))).toBe('2026-01')
    expect(competenciaDe(new Date(2026, 11, 1))).toBe('2026-12')
  })

  /** Ordenar competências como string tem que dar a ordem cronológica. */
  it('ordena cronologicamente como string', () => {
    const meses = [
      competenciaDe(new Date(2026, 10, 1)),
      competenciaDe(new Date(2026, 0, 1)),
      competenciaDe(new Date(2025, 11, 1)),
    ]
    expect([...meses].sort()).toEqual(['2025-12', '2026-01', '2026-11'])
  })
})
