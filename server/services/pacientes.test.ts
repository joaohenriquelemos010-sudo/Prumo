import { describe, it, expect } from 'vitest'
import {
  codigoValido,
  codigoNovo,
  formatarCodigo,
  gerarCodigo,
  normalizarCodigo,
  semConta,
} from './pacientes.js'

/**
 * O código de vinculação é a única prova de que quem reivindica um prontuário é
 * quem esteve na consulta. Errar aqui não é um bug de tela: é entregar o
 * histórico de saúde de alguém para outra pessoa.
 */
describe('código de vinculação', () => {
  it('não usa caracteres que se confundem quando ditados', () => {
    // O código é lido em voz alta no balcão e digitado depois, por outra pessoa.
    const proibidos = ['O', '0', 'I', '1', 'L', 'S', '5']
    const amostra = Array.from({ length: 300 }, () => gerarCodigo()).join('')
    for (const c of proibidos) {
      expect(amostra.includes(c), `gerou o caractere ambíguo ${c}`).toBe(false)
    }
  })

  it('tem oito caracteres', () => {
    expect(gerarCodigo()).toHaveLength(8)
  })

  it('não repete em 500 gerações', () => {
    const vistos = new Set(Array.from({ length: 500 }, () => gerarCodigo()))
    expect(vistos.size).toBe(500)
  })

  it('é exibido em dois blocos', () => {
    expect(formatarCodigo('ABCD2468')).toBe('ABCD-2468')
  })

  it('deixa em paz o que não tem oito caracteres', () => {
    expect(formatarCodigo('ABC')).toBe('ABC')
  })
})

describe('normalizarCodigo', () => {
  // Quem digita não deve ter que saber se o hífen conta.
  it.each([
    ['abcd-2468', 'ABCD2468'],
    ['ABCD 2468', 'ABCD2468'],
    ['  abcd2468  ', 'ABCD2468'],
    ['a-b c.d/2,4;6:8', 'ABCD2468'],
  ])('aceita %s', (entrada, esperado) => {
    expect(normalizarCodigo(entrada)).toBe(esperado)
  })

  it('não explode com nada', () => {
    expect(normalizarCodigo(undefined)).toBe('')
    expect(normalizarCodigo(null)).toBe('')
  })
})

describe('codigoValido', () => {
  it('recusa quando não há código', () => {
    expect(codigoValido(null)).toBe(false)
    expect(codigoValido({ codigo: '', expiraEm: new Date(Date.now() + 1000) })).toBe(false)
  })

  it('recusa código sem validade — data ausente não é validade eterna', () => {
    expect(codigoValido({ codigo: 'ABCD2468', expiraEm: null })).toBe(false)
  })

  it('recusa código expirado', () => {
    expect(
      codigoValido({ codigo: 'ABCD2468', expiraEm: new Date(Date.now() - 1) }),
    ).toBe(false)
  })

  it('aceita código dentro da validade', () => {
    expect(codigoValido(codigoNovo())).toBe(true)
  })

  it('vale sete dias, não mais', () => {
    const { expiraEm, geradoEm } = codigoNovo()
    const dias = (expiraEm.getTime() - geradoEm.getTime()) / 86_400_000
    expect(dias).toBeCloseTo(7, 5)
  })

  it('expira exatamente no limite, e não um instante depois', () => {
    const c = codigoNovo()
    expect(codigoValido(c, new Date(c.expiraEm.getTime() - 1))).toBe(true)
    expect(codigoValido(c, c.expiraEm)).toBe(false)
  })
})

describe('semConta', () => {
  it('é a ausência de responsável, e nada mais', () => {
    expect(semConta({})).toBe(true)
    expect(semConta({ responsavel: null })).toBe(true)
    expect(semConta({ responsavel: '' })).toBe(true)
    expect(semConta({ responsavel: '507f1f77bcf86cd799439011' })).toBe(false)
  })
})
