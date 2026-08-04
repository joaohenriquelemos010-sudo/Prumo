import { describe, expect, it } from 'vitest'
import { dataParaValidade, validadeParaData } from './cadastroPaciente.js'

describe('validade do convênio', () => {
  it('guarda o mês inteiro, não o primeiro dia dele', () => {
    const d = validadeParaData('07/2027')
    expect(d?.toISOString().slice(0, 10)).toBe('2027-07-31')
  })

  it('cobre fevereiro bissexto', () => {
    expect(validadeParaData('02/2028')?.toISOString().slice(0, 10)).toBe('2028-02-29')
    expect(validadeParaData('02/2027')?.toISOString().slice(0, 10)).toBe('2027-02-28')
  })

  it('recusa o que não é mês/ano plausível', () => {
    expect(validadeParaData('13/2027')).toBeNull()
    expect(validadeParaData('00/2027')).toBeNull()
    expect(validadeParaData('07/1800')).toBeNull()
    expect(validadeParaData('2027-07')).toBeNull()
    expect(validadeParaData('')).toBeNull()
    expect(validadeParaData(undefined)).toBeNull()
  })

  it('volta no formato impresso no cartão', () => {
    expect(dataParaValidade(new Date('2027-07-31T23:59:59.000Z'))).toBe('07/2027')
    expect(dataParaValidade(null)).toBe('')
    expect(dataParaValidade(new Date('quebrado'))).toBe('')
  })

  it('ida e volta não perdem o mês', () => {
    for (const mes of ['01', '02', '06', '10', '12']) {
      const iso = validadeParaData(`${mes}/2030`)
      expect(dataParaValidade(iso)).toBe(`${mes}/2030`)
    }
  })
})
