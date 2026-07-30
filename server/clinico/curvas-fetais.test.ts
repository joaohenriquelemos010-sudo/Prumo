import { describe, it, expect } from 'vitest'
import { faixaPara, percentilAproximado, faixasDaSemana, curvaPfe } from './curvas-fetais.js'

/**
 * Estes números são a referência de Hadlock (1991) que a prática obstétrica
 * brasileira lê por padrão, e são também **os valores em que os alertas
 * disparam**. Uma regressão silenciosa aqui não é um bug de UI — é um incidente
 * clínico: um peso fetal fora de faixa que deixa de ser sinalizado, ou um dentro
 * da faixa que passa a assustar a paciente sem motivo.
 *
 * Por isso os valores estão fixados à mão, copiados da tabela, e não derivados da
 * própria implementação.
 */
describe('faixaPara — peso fetal estimado', () => {
  it('devolve a linha tabulada exata quando a semana existe na tabela', () => {
    expect(faixaPara('pfeG', 20)).toEqual({ p3: 248, p10: 275, p50: 331, p90: 387, p97: 415 })
    expect(faixaPara('pfeG', 28)).toEqual({ p3: 908, p10: 1004, p50: 1210, p90: 1416, p97: 1518 })
    expect(faixaPara('pfeG', 40)).toEqual({ p3: 2714, p10: 3004, p50: 3619, p90: 4234, p97: 4539 })
  })

  it('devolve null fora do intervalo tabulado', () => {
    expect(faixaPara('pfeG', 13)).toBeNull()
    expect(faixaPara('pfeG', 41)).toBeNull()
  })
})

describe('faixaPara — interpolação em medidas tabuladas de 2 em 2 semanas', () => {
  it('a semana ímpar cai exatamente no meio das duas vizinhas', () => {
    // CC: semana 20 = p50 189, semana 22 = p50 216 → 21 fica em 202,5 → 203.
    expect(faixaPara('ccMm', 21)?.p50).toBe(203)
  })

  it('a semana par tabulada não é interpolada', () => {
    expect(faixaPara('ccMm', 20)).toEqual({ p3: 168, p10: 175, p50: 189, p90: 203, p97: 210 })
  })
})

describe('percentilAproximado', () => {
  it('o valor na mediana devolve exatamente P50', () => {
    expect(percentilAproximado('pfeG', 28, 1210)).toBe(50)
  })

  it('os pontos tabulados internos devolvem os próprios percentis', () => {
    expect(percentilAproximado('pfeG', 28, 1004)).toBe(10)
    expect(percentilAproximado('pfeG', 28, 1416)).toBe(90)
  })

  /**
   * Nas extremidades o clamp usa `<=` e `>=`, então um valor exatamente **em**
   * p3 sai como 1 e exatamente em p97 sai como 99, em vez de 3 e 97.
   *
   * Fixado aqui como está de propósito. O desvio é de um ponto tabulado e sempre
   * na direção conservadora — empurra para fora da faixa, nunca para dentro —
   * então um caso limítrofe é sinalizado em vez de silenciado. Mudar isso altera
   * quando os alertas de antropometria disparam e é decisão clínica, não de
   * refatoração.
   */
  it('nas bordas o clamp achata para 1 e 99', () => {
    expect(percentilAproximado('pfeG', 28, 908)).toBe(1) // exatamente em p3
    expect(percentilAproximado('pfeG', 28, 1518)).toBe(99) // exatamente em p97
  })

  it('interpola entre dois pontos tabulados', () => {
    // Metade do caminho entre p50 (1210) e p90 (1416) → metade entre 50 e 90.
    expect(percentilAproximado('pfeG', 28, 1313)).toBe(70)
  })

  it('as caudas são achatadas em 1 e 99 — a tabela não as resolve', () => {
    expect(percentilAproximado('pfeG', 28, 400)).toBe(1)
    expect(percentilAproximado('pfeG', 28, 5000)).toBe(99)
  })

  it('devolve null quando não há faixa para a semana', () => {
    expect(percentilAproximado('pfeG', 10, 500)).toBeNull()
  })
})

describe('faixasDaSemana', () => {
  it('traz todas as medidas que têm faixa naquela semana', () => {
    const faixas = faixasDaSemana(28)
    expect(Object.keys(faixas).sort()).toEqual(['caMm', 'ccMm', 'cfMm', 'dbpMm', 'pfeG'])
    expect(faixas.pfeG?.p50).toBe(1210)
  })

  it('vem vazio fora do intervalo de qualquer tabela', () => {
    expect(faixasDaSemana(5)).toEqual({})
  })
})

describe('curvaPfe', () => {
  const curva = curvaPfe()

  it('vem ordenada por semana e cobre 14 a 40', () => {
    expect(curva[0]?.semana).toBe(14)
    expect(curva[curva.length - 1]?.semana).toBe(40)
    expect(curva.map((p) => p.semana)).toEqual([...curva.map((p) => p.semana)].sort((a, b) => a - b))
  })

  it('a mediana é monotonicamente crescente — um bebê não encolhe', () => {
    for (let i = 1; i < curva.length; i++) {
      expect(curva[i]!.faixa.p50).toBeGreaterThan(curva[i - 1]!.faixa.p50)
    }
  })

  it('os percentis estão ordenados em toda semana', () => {
    for (const { faixa } of curva) {
      expect(faixa.p3).toBeLessThan(faixa.p10)
      expect(faixa.p10).toBeLessThan(faixa.p50)
      expect(faixa.p50).toBeLessThan(faixa.p90)
      expect(faixa.p90).toBeLessThan(faixa.p97)
    }
  })
})
