import { describe, it, expect } from 'vitest'
import {
  zScore,
  valorParaZ,
  faixaInfantil,
  curvaInfantil,
  percentilDeZ,
} from './curvas-pediatricas.js'

/**
 * Curvas OMS (2006) via parâmetros LMS. Mesmo raciocínio dos testes fetais: são
 * os números em que os alertas de antropometria disparam, então ficam fixados.
 *
 * A âncora mais forte é a mediana: por definição de LMS, o valor `m` tem z = 0.
 * Se a interpolação ou a fórmula quebrar, este é o primeiro teste a cair.
 */
describe('zScore', () => {
  it('a mediana da OMS tem z-score zero', () => {
    // M ao nascer: 3.2322 kg (F) e 3.3464 kg (M) na tabela de peso.
    expect(zScore('pesoKg', 'F', 0, 3.2322)).toBe(0)
    expect(zScore('pesoKg', 'M', 0, 3.3464)).toBe(0)
  })

  it('acima da mediana dá z positivo, abaixo dá negativo', () => {
    expect(zScore('pesoKg', 'F', 0, 4)!).toBeGreaterThan(0)
    expect(zScore('pesoKg', 'F', 0, 2.5)!).toBeLessThan(0)
  })

  it('é o inverso de valorParaZ', () => {
    for (const z of [-2, -1, 0, 1, 2]) {
      const valor = valorParaZ('pesoKg', 'M', 6, z)!
      expect(zScore('pesoKg', 'M', 6, valor)).toBeCloseTo(z, 1)
    }
  })

  it('devolve null fora do intervalo tabulado e para valores inválidos', () => {
    expect(zScore('pesoKg', 'F', 240, 12)).toBeNull()
    expect(zScore('pesoKg', 'F', 6, 0)).toBeNull()
    expect(zScore('pesoKg', 'F', 6, -1)).toBeNull()
  })
})

describe('faixaInfantil', () => {
  it('os percentis vêm ordenados', () => {
    const faixa = faixaInfantil('pesoKg', 6)!
    expect(faixa.p3).toBeLessThan(faixa.p10)
    expect(faixa.p10).toBeLessThan(faixa.p50)
    expect(faixa.p50).toBeLessThan(faixa.p90)
    expect(faixa.p90).toBeLessThan(faixa.p97)
  })

  it('a faixa é a UNIÃO dos dois sexos — a jornada não registra sexo', () => {
    const faixa = faixaInfantil('pesoKg', 6)!
    const menorP3 = Math.min(valorParaZ('pesoKg', 'F', 6, -1.881)!, valorParaZ('pesoKg', 'M', 6, -1.881)!)
    const maiorP97 = Math.max(valorParaZ('pesoKg', 'F', 6, 1.881)!, valorParaZ('pesoKg', 'M', 6, 1.881)!)
    expect(faixa.p3).toBeCloseTo(menorP3, 2)
    expect(faixa.p97).toBeCloseTo(maiorP97, 2)
  })

  it('devolve null fora do intervalo tabulado', () => {
    expect(faixaInfantil('pesoKg', 999)).toBeNull()
  })
})

describe('curvaInfantil', () => {
  it.each(['pesoKg', 'comprimentoCm', 'perimetroCefalicoCm'] as const)(
    '%s cresce monotonicamente na mediana de 0 a 24 meses',
    (medida) => {
      const curva = curvaInfantil(medida)
      expect(curva.length).toBeGreaterThan(20)
      for (let i = 1; i < curva.length; i++) {
        expect(curva[i]!.faixa.p50).toBeGreaterThan(curva[i - 1]!.faixa.p50)
      }
    },
  )
})

describe('percentilDeZ', () => {
  it('z = 0 é a mediana', () => {
    expect(percentilDeZ(0)).toBe(50)
  })

  it('bate com a normal padrão nos pontos conhecidos', () => {
    // ±1σ ≈ 15,9 / 84,1 · ±1,96σ ≈ 2,5 / 97,5
    expect(percentilDeZ(1)).toBeGreaterThanOrEqual(83)
    expect(percentilDeZ(1)).toBeLessThanOrEqual(85)
    expect(percentilDeZ(-1)).toBeGreaterThanOrEqual(15)
    expect(percentilDeZ(-1)).toBeLessThanOrEqual(17)
    expect(percentilDeZ(1.96)).toBeGreaterThanOrEqual(97)
    expect(percentilDeZ(-1.96)).toBeLessThanOrEqual(3)
  })

  it('é simétrico em torno de 50', () => {
    for (const z of [0.5, 1, 1.5, 2]) {
      expect(percentilDeZ(z) + percentilDeZ(-z)).toBe(100)
    }
  })

  it('as caudas são achatadas em 1 e 99', () => {
    expect(percentilDeZ(6)).toBe(99)
    expect(percentilDeZ(-6)).toBe(1)
  })
})
