import { describe, expect, it } from 'vitest'
import { forcaSenha, senhaAceitavel } from './senha'

describe('senhaAceitavel', () => {
  it('exige 8 caracteres com letra e número', () => {
    expect(senhaAceitavel('trilha24')).toBe(true)
    expect(senhaAceitavel('trilha2')).toBe(false)
    expect(senhaAceitavel('trilhaboa')).toBe(false)
    expect(senhaAceitavel('12345678')).toBe(false)
  })

  it('conta letras acentuadas como letra', () => {
    expect(senhaAceitavel('gestação1')).toBe(true)
  })
})

describe('forcaSenha', () => {
  it('não pontua senha vazia e diz o que se espera', () => {
    const forca = forcaSenha('')
    expect(forca.nivel).toBe(0)
    expect(forca.dica).toContain('8 caracteres')
  })

  it('sobe de nível com comprimento e variedade', () => {
    expect(forcaSenha('trilha24').nivel).toBeLessThan(forcaSenha('Trilha2426!').nivel)
    expect(forcaSenha('Trilha-Segura-2026!').nivel).toBe(4)
  })

  it('nunca passa de 4', () => {
    expect(forcaSenha('Trilha-Muito-Segura-2026!!').nivel).toBe(4)
  })

  it('dá uma dica por vez, na ordem que destrava a senha', () => {
    expect(forcaSenha('tri').dica).toBe('Faltam 5 caracteres.')
    expect(forcaSenha('t').dica).toBe('Faltam 7 caracteres.')
    expect(forcaSenha('12345678').dica).toBe('Inclua ao menos uma letra.')
    expect(forcaSenha('trilhaboa').dica).toBe('Inclua ao menos um número.')
    expect(forcaSenha('trilha24').dica).toContain('longas')
  })

  it('aceita a senha forte sem pedir mais nada', () => {
    expect(forcaSenha('Trilha-Segura-2026!').dica).toContain('protege bem')
  })
})
