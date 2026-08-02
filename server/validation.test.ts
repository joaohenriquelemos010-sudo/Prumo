import { describe, expect, it } from 'vitest'
import { registerSchema } from './validation.js'
import { validarCPF } from './br-docs.js'

/**
 * O cadastro é a única porta pública que grava um usuário. O que estes testes
 * protegem não é a forma dos campos — é a regra de que **nada entra sem passar
 * por aqui**: consentimento, idade mínima, identidade profissional e o momento
 * da jornada.
 */

/** CPF de teste com dígitos verificadores válidos. */
const CPF_VALIDO = '529.982.247-25'

const BASE = {
  nome: 'Ana Souza',
  email: 'Ana@Exemplo.com ',
  senha: 'trilha2026',
  telefone: '(11) 91234-5678',
  cpf: CPF_VALIDO,
  dataNascimento: '1994-03-12',
  aceiteTermos: true as const,
}

const FAMILIA = { ...BASE, papel: 'gestante' as const, momento: 'gestante' as const }

const MEDICO = {
  ...BASE,
  papel: 'medico' as const,
  crm: '123456',
  crmUf: 'sp',
  especialidade: 'Pediatria',
}

describe('o CPF de teste', () => {
  it('é realmente válido — senão os testes abaixo não provam nada', () => {
    expect(validarCPF(CPF_VALIDO)).toBe(true)
  })
})

describe('registerSchema · identidade e contato', () => {
  it('normaliza e-mail, CPF e telefone', () => {
    const parsed = registerSchema.parse(FAMILIA)
    expect(parsed.email).toBe('ana@exemplo.com')
    expect(parsed.cpf).toBe('52998224725')
    expect(parsed.telefone).toBe('11912345678')
  })

  it('exige nome e sobrenome', () => {
    expect(registerSchema.safeParse({ ...FAMILIA, nome: 'Ana' }).success).toBe(false)
    expect(registerSchema.safeParse({ ...FAMILIA, nome: 'Ana de Souza' }).success).toBe(true)
  })

  it('recusa CPF e telefone inválidos', () => {
    expect(registerSchema.safeParse({ ...FAMILIA, cpf: '111.111.111-11' }).success).toBe(false)
    expect(registerSchema.safeParse({ ...FAMILIA, telefone: '(11) 81234-5678' }).success).toBe(false)
  })

  it('exige senha com letra e número', () => {
    expect(registerSchema.safeParse({ ...FAMILIA, senha: 'trilhatrilha' }).success).toBe(false)
    expect(registerSchema.safeParse({ ...FAMILIA, senha: '20262026' }).success).toBe(false)
    expect(registerSchema.safeParse({ ...FAMILIA, senha: 'trilha26' }).success).toBe(true)
  })
})

describe('registerSchema · consentimento e idade', () => {
  it('não aceita cadastro sem o aceite dos termos', () => {
    // Ausente não é "campo faltando" — é cadastro sem consentimento.
    const semAceite = { ...FAMILIA, aceiteTermos: undefined }
    expect(registerSchema.safeParse(semAceite).success).toBe(false)
    expect(registerSchema.safeParse({ ...FAMILIA, aceiteTermos: false }).success).toBe(false)
  })

  it('marketing é opt-in separado e começa desligado', () => {
    expect(registerSchema.parse(FAMILIA).aceiteComunicacoes).toBe(false)
    expect(registerSchema.parse({ ...FAMILIA, aceiteComunicacoes: true }).aceiteComunicacoes).toBe(true)
  })

  it('recusa quem tem menos de 16 anos', () => {
    const doisAnosAtras = new Date()
    doisAnosAtras.setFullYear(doisAnosAtras.getFullYear() - 2)
    const recente = doisAnosAtras.toISOString().slice(0, 10)
    expect(registerSchema.safeParse({ ...FAMILIA, dataNascimento: recente }).success).toBe(false)
  })

  it('recusa data de nascimento impossível', () => {
    expect(registerSchema.safeParse({ ...FAMILIA, dataNascimento: '1830-01-01' }).success).toBe(false)
    expect(registerSchema.safeParse({ ...FAMILIA, dataNascimento: 'ontem' }).success).toBe(false)
  })
})

describe('registerSchema · médico', () => {
  it('aceita e normaliza CRM + UF', () => {
    const parsed = registerSchema.parse(MEDICO)
    expect(parsed.crm).toBe('123456')
    expect(parsed.crmUf).toBe('SP')
  })

  it('exige CRM válido e UF real', () => {
    expect(registerSchema.safeParse({ ...MEDICO, crm: '12' }).success).toBe(false)
    expect(registerSchema.safeParse({ ...MEDICO, crmUf: 'ZZ' }).success).toBe(false)
    expect(registerSchema.safeParse({ ...MEDICO, crm: undefined }).success).toBe(false)
  })

  it('exige especialidade — ela decide o compartilhamento entre médicos', () => {
    expect(registerSchema.safeParse({ ...MEDICO, especialidade: '' }).success).toBe(false)
  })

  it('não pede momento de jornada ao médico', () => {
    expect(registerSchema.safeParse(MEDICO).success).toBe(true)
  })
})

describe('registerSchema · família', () => {
  it('exige o momento da jornada', () => {
    expect(registerSchema.safeParse({ ...FAMILIA, momento: undefined }).success).toBe(false)
  })

  it('exige a data de nascimento do bebê quando ele já nasceu', () => {
    const semData = { ...FAMILIA, papel: 'mae' as const, momento: 'ja-nasceu' as const }
    expect(registerSchema.safeParse(semData).success).toBe(false)
    expect(registerSchema.safeParse({ ...semData, dataNascimentoBebe: '2025-11-04' }).success).toBe(true)
  })

  it('deixa a DPP opcional — exigi-la seria pedir um exame para poder marcar o exame', () => {
    expect(registerSchema.safeParse({ ...FAMILIA, dpp: undefined }).success).toBe(true)
    expect(registerSchema.safeParse({ ...FAMILIA, dpp: '2026-12-01' }).success).toBe(true)
  })
})
