import { describe, it, expect } from 'vitest'
import { calcularHash, jsonCanonico, primeiroEloQuebrado } from './evolucao-hash.js'
import type { CorpoDaEvolucao } from './evolucao-hash.js'

function corpo(over: Partial<CorpoDaEvolucao> = {}): CorpoDaEvolucao {
  return {
    jornada: 'j1',
    ordem: 1,
    tipo: 'evolucao',
    autorId: 'a1',
    em: '2026-01-01T10:00:00.000Z',
    texto: 'Paciente estável.',
    estruturado: null,
    visibilidade: 'familia',
    origem: 'humano',
    ...over,
  }
}

/** Monta uma cadeia bem-formada de n elos. */
function cadeia(n: number) {
  const elos: { hash: string; hashAnterior: string; corpo: CorpoDaEvolucao }[] = []
  let anterior = ''
  for (let i = 1; i <= n; i++) {
    const c = corpo({ ordem: i, texto: `Entrada ${i}` })
    const hash = calcularHash(anterior, c)
    elos.push({ hash, hashAnterior: anterior, corpo: c })
    anterior = hash
  }
  return elos
}

describe('jsonCanonico', () => {
  it('a ordem das chaves não muda o resultado', () => {
    expect(jsonCanonico({ b: 1, a: 2 })).toBe(jsonCanonico({ a: 2, b: 1 }))
  })

  it('ordena recursivamente, inclusive dentro de arrays', () => {
    expect(jsonCanonico({ x: [{ b: 1, a: 2 }] })).toBe(jsonCanonico({ x: [{ a: 2, b: 1 }] }))
  })

  it('distingue valores de verdade', () => {
    expect(jsonCanonico({ a: 1 })).not.toBe(jsonCanonico({ a: 2 }))
    expect(jsonCanonico(null)).not.toBe(jsonCanonico({}))
  })

  it('serializa Date de forma estável', () => {
    const d = new Date('2026-01-01T10:00:00.000Z')
    expect(jsonCanonico({ d })).toBe(jsonCanonico({ d: new Date(d.getTime()) }))
  })
})

describe('calcularHash', () => {
  it('é determinístico', () => {
    expect(calcularHash('', corpo())).toBe(calcularHash('', corpo()))
  })

  it('muda quando QUALQUER campo do corpo muda', () => {
    const base = calcularHash('', corpo())
    expect(calcularHash('', corpo({ texto: 'outra coisa' }))).not.toBe(base)
    expect(calcularHash('', corpo({ ordem: 2 }))).not.toBe(base)
    expect(calcularHash('', corpo({ autorId: 'a2' }))).not.toBe(base)
    expect(calcularHash('', corpo({ em: '2026-01-01T10:00:01.000Z' }))).not.toBe(base)
    expect(calcularHash('', corpo({ visibilidade: 'equipe' }))).not.toBe(base)
    expect(calcularHash('', corpo({ origem: 'ia-revisada' }))).not.toBe(base)
  })

  it('muda quando só o elo anterior muda — é isso que encadeia', () => {
    expect(calcularHash('abc', corpo())).not.toBe(calcularHash('def', corpo()))
  })
})

describe('primeiroEloQuebrado', () => {
  it('cadeia vazia está íntegra', () => {
    expect(primeiroEloQuebrado([])).toBeNull()
  })

  it('cadeia bem formada está íntegra', () => {
    expect(primeiroEloQuebrado(cadeia(5))).toBeNull()
  })

  it('adulterar o texto de uma entrada aponta exatamente aquela', () => {
    const elos = cadeia(5)
    elos[2]!.corpo.texto = 'texto trocado no banco'
    expect(primeiroEloQuebrado(elos)).toBe(2)
  })

  it('adulterar a PRIMEIRA entrada aponta o índice 0', () => {
    const elos = cadeia(3)
    elos[0]!.corpo.texto = 'trocado'
    expect(primeiroEloQuebrado(elos)).toBe(0)
  })

  /**
   * A propriedade que justifica encadear em vez de hashear item a item: quem
   * reescreve uma entrada do meio E recalcula o hash dela ainda quebra a
   * cadeia, porque o elo seguinte aponta para o hash antigo.
   */
  it('recalcular o hash da entrada adulterada não salva a cadeia', () => {
    const elos = cadeia(5)
    elos[2]!.corpo.texto = 'trocado'
    elos[2]!.hash = calcularHash(elos[2]!.hashAnterior, elos[2]!.corpo)
    expect(primeiroEloQuebrado(elos)).toBe(3)
  })

  it('remover uma entrada do meio quebra a cadeia', () => {
    const elos = cadeia(5)
    elos.splice(2, 1)
    expect(primeiroEloQuebrado(elos)).toBe(2)
  })

  it('reordenar entradas quebra a cadeia', () => {
    const elos = cadeia(4)
    ;[elos[1], elos[2]] = [elos[2]!, elos[1]!]
    expect(primeiroEloQuebrado(elos)).toBe(1)
  })

  it('só uma reescrita completa e coerente passa — e ela muda todos os hashes', () => {
    const original = cadeia(4)
    const reescrita = cadeia(4)
    reescrita[1]!.corpo.texto = 'história diferente'
    // Recalcula tudo a partir dali, como faria quem reescrevesse o banco inteiro.
    let anterior = reescrita[0]!.hash
    for (let i = 1; i < reescrita.length; i++) {
      reescrita[i]!.hashAnterior = anterior
      reescrita[i]!.hash = calcularHash(anterior, reescrita[i]!.corpo)
      anterior = reescrita[i]!.hash
    }
    expect(primeiroEloQuebrado(reescrita)).toBeNull()
    // …mas o hash final delata: não é a mesma história.
    expect(reescrita[3]!.hash).not.toBe(original[3]!.hash)
  })
})
