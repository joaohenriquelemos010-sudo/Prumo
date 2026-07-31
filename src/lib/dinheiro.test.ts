import { describe, it, expect } from 'vitest'
import { reais, paraCentavos, rotuloDaCompetencia } from './dinheiro'
import { reais as reaisServidor, paraCentavos as paraCentavosServidor } from '../../server/services/financeiro.js'

/**
 * O cliente e o servidor precisam concordar sobre dinheiro.
 *
 * As duas implementações são cópias — o split `tsconfig.app`/`tsconfig.server`
 * torna o compartilhamento caro, e trinta linhas duplicadas custam menos que a
 * plumbing. Mas cópias divergem, e esta divergiria em silêncio: o cliente
 * mandaria centavos calculados de um jeito e o relatório somaria de outro, e a
 * diferença só apareceria no fechamento do mês.
 *
 * Este teste é o que torna a duplicação aceitável.
 */
const CASOS = [
  '1234.56',
  '1.234,56',
  '1,234.56',
  '350',
  '350,00',
  '1.500',
  '1,500',
  '1.50',
  '1,5',
  '0.07',
  '0,29',
  '12.500,50',
  '10,9999',
  'R$ 1.234,56',
  '',
  'abc',
]

describe('cliente e servidor concordam', () => {
  it.each(CASOS)('paraCentavos(%o) dá o mesmo dos dois lados', (entrada) => {
    expect(paraCentavos(entrada)).toBe(paraCentavosServidor(entrada))
  })

  it.each([0, 1, 7, 99, 35000, 123456, 1250050, 99999999])(
    'reais(%i) dá o mesmo dos dois lados',
    (centavos) => {
      expect(reais(centavos)).toBe(reaisServidor(centavos))
    },
  )
})

describe('paraCentavos', () => {
  /**
   * A ambiguidade que mais custa caro: errar aqui cobraria R$ 1,50 por uma
   * consulta de R$ 1.500, e não daria erro nenhum.
   */
  it('trata três dígitos depois do separador como milhar', () => {
    expect(paraCentavos('1.500')).toBe(150000)
    expect(paraCentavos('1,500')).toBe(150000)
  })

  it('trata uma ou duas casas como decimal', () => {
    expect(paraCentavos('1.50')).toBe(150)
    expect(paraCentavos('1,5')).toBe(150)
  })

  it('a ida e a volta fecham', () => {
    for (const c of [1, 7, 99, 35000, 123456]) {
      expect(paraCentavos(reais(c))).toBe(c)
    }
  })
})

describe('rotuloDaCompetencia', () => {
  it('vira mês por extenso', () => {
    expect(rotuloDaCompetencia('2026-03')).toContain('2026')
    expect(rotuloDaCompetencia('2026-03').toLowerCase()).toContain('março')
  })

  it('lixo volta como veio, em vez de virar Invalid Date', () => {
    expect(rotuloDaCompetencia('nada')).toBe('nada')
  })
})
