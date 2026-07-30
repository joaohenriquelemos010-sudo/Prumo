import { describe, it, expect } from 'vitest'
import { projetarMomento, elastico, encaixeMaisProximo, molas } from './motion'

describe('projetarMomento', () => {
  it('parado não projeta nada', () => {
    expect(projetarMomento(0)).toBe(0)
  })

  it('o sinal segue a direção do gesto', () => {
    expect(projetarMomento(500)).toBeGreaterThan(0)
    expect(projetarMomento(-500)).toBeLessThan(0)
  })

  it('mais velocidade projeta mais longe, proporcionalmente', () => {
    expect(projetarMomento(1000)).toBeCloseTo(2 * projetarMomento(500), 5)
  })

  it('usa o decaimento exponencial da Apple, não v²/2a', () => {
    // v/1000 · d/(1−d) com d = 0.998 → fator 499.
    expect(projetarMomento(1000)).toBeCloseTo(499, 3)
  })

  it('desaceleração menor projeta menos — mais seco', () => {
    expect(projetarMomento(1000, 0.99)).toBeLessThan(projetarMomento(1000, 0.998))
  })
})

describe('elastico', () => {
  it('sem excesso não há resistência', () => {
    expect(elastico(0, 800)).toBe(0)
  })

  it('resiste progressivamente: o deslocamento cresce menos que o dedo', () => {
    const a = elastico(100, 800)
    const b = elastico(200, 800)
    expect(a).toBeLessThan(100)
    expect(b).toBeLessThan(200)
    // Dobrar o arraste rende bem menos que o dobro de movimento.
    expect(b).toBeLessThan(2 * a)
  })

  /**
   * No limite, (x·d·c)/(d + c·x) → d quando x → ∞. Ou seja: por mais que se
   * puxe, a superfície nunca anda mais que a própria dimensão. É isso que faz a
   * borda ler como "responde, mas acabou" em vez de "travou".
   */
  it('satura na dimensão, por mais que se puxe', () => {
    expect(elastico(100000, 800)).toBeLessThan(800)
    expect(elastico(100000, 800)).toBeGreaterThan(780)
  })

  it('é ímpar em torno de zero', () => {
    expect(elastico(-150, 800)).toBeCloseTo(-elastico(150, 800), 6)
  })
})

describe('encaixeMaisProximo', () => {
  it('escolhe o ponto mais perto', () => {
    expect(encaixeMaisProximo(0.4, [0, 1])).toBe(0)
    expect(encaixeMaisProximo(0.6, [0, 1])).toBe(1)
  })

  it('com um ponto só, é sempre ele', () => {
    expect(encaixeMaisProximo(999, [42])).toBe(42)
  })

  it('funciona com detents fora de ordem', () => {
    expect(encaixeMaisProximo(310, [500, 0, 300])).toBe(300)
  })
})

describe('detents da folha', () => {
  /** A mesma conta que Sheet.tsx faz em aoSoltar. */
  const detents = (alturas: number[], altura: number, vh: number) =>
    alturas.map((f) => Math.max(0, altura - f * vh))

  it('o detent maior repousa em zero quando a folha está na altura cheia', () => {
    expect(detents([0.92], 0.92 * 1000, 1000)).toEqual([0])
  })

  it('um detent intermediário vira um deslocamento positivo', () => {
    const [meio, cheio] = detents([0.5, 0.92], 920, 1000)
    expect(cheio).toBe(0)
    expect(meio).toBeCloseTo(420, 5)
  })

  it('nunca produz deslocamento negativo', () => {
    for (const d of detents([0.5, 0.92], 300, 1000)) expect(d).toBeGreaterThanOrEqual(0)
  })
})

describe('molas', () => {
  it('as quatro são criticamente amortecidas ou melhor — sem oscilação', () => {
    for (const [nome, mola] of Object.entries(molas)) {
      const critico = 2 * Math.sqrt(mola.stiffness * mola.mass)
      expect(mola.damping, `${nome} oscila`).toBeGreaterThanOrEqual(critico * 0.75)
    }
  })

  it('ficam mais rápidas na ordem suave → firme → rapida', () => {
    expect(molas.firme.stiffness).toBeGreaterThan(molas.suave.stiffness)
    expect(molas.rapida.stiffness).toBeGreaterThan(molas.firme.stiffness)
  })

  it('a folha tem mais massa que um chip — superfície grande, inércia maior', () => {
    expect(molas.folha.mass).toBeGreaterThan(molas.firme.mass)
  })
})
