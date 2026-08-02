import { describe, expect, it } from 'vitest'
import { formatarTelefone, hojeISO, idadeEm, validarTelefone } from './br-docs'

describe('validarTelefone', () => {
  it('aceita celular com nono dígito e fixo de oito', () => {
    expect(validarTelefone('(11) 91234-5678')).toBe(true)
    expect(validarTelefone('11912345678')).toBe(true)
    expect(validarTelefone('(21) 2555-1234')).toBe(true)
  })

  it('recusa celular de 11 dígitos que não começa com 9', () => {
    // É o erro que mais aparece: um dígito a mais colado num número fixo.
    expect(validarTelefone('11812345678')).toBe(false)
  })

  it('recusa DDD inexistente', () => {
    expect(validarTelefone('(01) 91234-5678')).toBe(false)
    expect(validarTelefone('0912345678')).toBe(false)
  })

  it('recusa comprimentos fora de 10 ou 11 dígitos', () => {
    expect(validarTelefone('1191234567')).toBe(true)
    expect(validarTelefone('119123456')).toBe(false)
    expect(validarTelefone('119123456789')).toBe(false)
    expect(validarTelefone('')).toBe(false)
  })

  it('recusa fixo começando com 0 ou 1', () => {
    expect(validarTelefone('1101234567')).toBe(false)
    expect(validarTelefone('1112345678')).toBe(false)
  })
})

describe('formatarTelefone', () => {
  it('formata estados parciais sem travar a digitação', () => {
    expect(formatarTelefone('')).toBe('')
    expect(formatarTelefone('1')).toBe('(1')
    expect(formatarTelefone('11')).toBe('(11')
    expect(formatarTelefone('119')).toBe('(11) 9')
    expect(formatarTelefone('119123')).toBe('(11) 9123')
  })

  it('quebra 9 dígitos em 5+4 e 8 dígitos em 4+4', () => {
    expect(formatarTelefone('11912345678')).toBe('(11) 91234-5678')
    expect(formatarTelefone('2125551234')).toBe('(21) 2555-1234')
  })

  it('ignora o que passa de onze dígitos e o que não é número', () => {
    expect(formatarTelefone('11912345678999')).toBe('(11) 91234-5678')
    expect(formatarTelefone('(11) 91234-5678')).toBe('(11) 91234-5678')
  })
})

describe('idadeEm', () => {
  const referencia = new Date('2026-08-02T12:00:00')

  it('conta anos completos', () => {
    expect(idadeEm('2000-08-02', referencia)).toBe(26)
    expect(idadeEm('2000-08-01', referencia)).toBe(26)
  })

  it('não conta o aniversário que ainda não chegou', () => {
    expect(idadeEm('2000-08-03', referencia)).toBe(25)
    expect(idadeEm('2000-12-31', referencia)).toBe(25)
  })

  it('devolve null — não NaN — para o que não é data', () => {
    // Um NaN silencioso passaria por qualquer comparação numérica como "não".
    expect(idadeEm('', referencia)).toBeNull()
    expect(idadeEm('nem-data', referencia)).toBeNull()
  })

  it('aceita ISO completo além de YYYY-MM-DD', () => {
    expect(idadeEm('2000-08-02T00:00:00.000Z', referencia)).toBe(26)
  })

  it('devolve negativo para data no futuro', () => {
    expect(idadeEm('2030-01-01', referencia)).toBeLessThan(0)
  })
})

describe('hojeISO', () => {
  it('usa o dia local, não o UTC', () => {
    // 23h de 2 de agosto em UTC-3 ainda é dia 2 — `toISOString()` cru diria 3.
    const local = new Date(2026, 7, 2, 23, 30)
    expect(hojeISO(local)).toBe('2026-08-02')
  })
})
