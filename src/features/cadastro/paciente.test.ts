import { describe, expect, it } from 'vitest'
import {
  PACIENTE_VAZIA,
  daApi,
  formatarCEP,
  formatarValidade,
  limparRG,
  paraApi,
  secaoDoErro,
  secoesPreenchidas,
  temErro,
  validarPaciente,
} from './paciente'
import type { DadosPaciente } from './paciente'

/** Uma ficha que passa em tudo — cada teste estraga só o campo que investiga. */
const COMPLETA: DadosPaciente = {
  ...PACIENTE_VAZIA,
  nome: 'Maria Souza',
  cpf: '529.982.247-25', // CPF válido de teste (dígitos conferem)
  dataNascimento: '1992-04-13',
  sexo: 'feminino',
  telefone: '(11) 91234-5678',
}

describe('validarPaciente', () => {
  it('aceita a ficha completa', () => {
    expect(validarPaciente(COMPLETA)).toEqual({})
  })

  it('exige identificação e contato no modo completo', () => {
    const erros = validarPaciente(PACIENTE_VAZIA)
    expect(erros.nome).toBeDefined()
    expect(erros.cpf).toBeDefined()
    expect(erros.dataNascimento).toBeDefined()
    expect(erros.telefone).toBeDefined()
  })

  it('no cadastro rápido, só o nome trava', () => {
    const erros = validarPaciente({ ...PACIENTE_VAZIA, nome: 'Ana' }, { completo: false })
    expect(temErro(erros)).toBe(false)
  })

  it('campo opcional preenchido errado continua sendo erro no cadastro rápido', () => {
    const erros = validarPaciente(
      { ...PACIENTE_VAZIA, nome: 'Ana', cpf: '111.111.111-11' },
      { completo: false },
    )
    expect(erros.cpf).toBeDefined()
  })

  it('exige sobrenome só no modo completo', () => {
    expect(validarPaciente({ ...COMPLETA, nome: 'Maria' }).nome).toBeDefined()
    expect(
      validarPaciente({ ...PACIENTE_VAZIA, nome: 'Maria' }, { completo: false }).nome,
    ).toBeUndefined()
  })

  it('recusa nascimento no futuro', () => {
    const amanha = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)
    expect(validarPaciente({ ...COMPLETA, dataNascimento: amanha }).dataNascimento).toBeDefined()
  })

  it('recusa uma DPP implausível e aceita a vazia', () => {
    expect(validarPaciente({ ...COMPLETA, momento: 'gestante', dpp: '2019-01-01' }).dpp).toBeDefined()
    expect(validarPaciente({ ...COMPLETA, momento: 'gestante', dpp: '' }).dpp).toBeUndefined()
  })

  it('valida a validade do convênio no formato do cartão', () => {
    const erro = (validade: string) =>
      validarPaciente({ ...COMPLETA, convenio: { ...COMPLETA.convenio, validade } })[
        'convenio.validade'
      ]
    expect(erro('07/2027')).toBeUndefined()
    expect(erro('13/2027')).toBeDefined()
    expect(erro('2027-07')).toBeDefined()
  })

  it('ignora a linha de filho que ninguém preencheu', () => {
    const erros = validarPaciente({
      ...COMPLETA,
      familia: { companheiro: '', filhos: [{ nome: '', dataNascimento: '' }] },
    })
    expect(temErro(erros)).toBe(false)
  })
})

describe('máscaras', () => {
  it('formata o CEP e para nos oito dígitos', () => {
    expect(formatarCEP('01001')).toBe('01001')
    expect(formatarCEP('01001000')).toBe('01001-000')
    expect(formatarCEP('010010009999')).toBe('01001-000')
  })

  it('formata a validade como mês/ano', () => {
    expect(formatarValidade('07')).toBe('07')
    expect(formatarValidade('072027')).toBe('07/2027')
  })

  it('não inventa pontuação no RG — cada estado tem a sua', () => {
    expect(limparRG('12.345.678-9')).toBe('12.345.678-9')
    expect(limparRG('MG-14.123.456')).toBe('MG-14.123.456')
    expect(limparRG('12@345#678')).toBe('12345678')
  })
})

describe('paraApi', () => {
  it('manda documento e telefone só com dígitos', () => {
    const corpo = paraApi(COMPLETA)
    expect(corpo.cpf).toBe('52998224725')
    expect(corpo.telefone).toBe('11912345678')
  })

  it('descarta a data que não pertence ao momento escolhido', () => {
    const corpo = paraApi({
      ...COMPLETA,
      momento: 'ja-nasceu',
      dpp: '2026-01-01',
      dataNascimentoBebe: '2025-12-01',
    })
    expect(corpo.dpp).toBe('')
    expect(corpo.dataNascimentoBebe).toBe('2025-12-01')
  })

  it('não manda filho sem nome', () => {
    const corpo = paraApi({
      ...COMPLETA,
      familia: {
        companheiro: 'João',
        filhos: [
          { nome: '', dataNascimento: '2020-01-01' },
          { nome: 'Rita', dataNascimento: '2021-02-03' },
        ],
      },
    })
    expect(corpo.familia.filhos).toEqual([{ nome: 'Rita', dataNascimento: '2021-02-03' }])
  })
})

describe('daApi', () => {
  it('traz a ficha gravada de volta já mascarada', () => {
    const dados = daApi({
      nome: 'Maria Souza',
      momento: 'gestante',
      dpp: '2026-03-10T00:00:00.000Z',
      titular: {
        nome: 'Maria Souza',
        cpf: '52998224725',
        telefone: '11912345678',
        dataNascimento: '1992-04-13T00:00:00.000Z',
        endereco: { cep: '01001000', cidade: 'São Paulo', uf: 'SP' },
      },
      convenio: { operadora: 'Unimed', validade: '07/2027' },
    })

    expect(dados.cpf).toBe('529.982.247-25')
    expect(dados.telefone).toBe('(11) 91234-5678')
    // O `<input type="date">` recusa o ISO com hora.
    expect(dados.dataNascimento).toBe('1992-04-13')
    expect(dados.dpp).toBe('2026-03-10')
    expect(dados.endereco.cep).toBe('01001-000')
    expect(dados.convenio.validade).toBe('07/2027')
  })

  it('aceita a validade em ISO — documento antigo, import, rota sem serializador', () => {
    const dados = daApi({
      nome: 'Ana',
      convenio: { validade: '2027-07-31T23:59:59.000Z' },
    })
    expect(dados.convenio.validade).toBe('07/2027')
  })

  it('sobrevive a uma jornada antiga, sem nenhum dos campos novos', () => {
    const dados = daApi({ nome: 'Ana' })
    expect(dados.nome).toBe('Ana')
    expect(dados.familia.filhos).toEqual([])
    expect(dados.preferencias.dias).toEqual([])
  })

  it('a ida e a volta preservam o que foi digitado', () => {
    const original: DadosPaciente = {
      ...COMPLETA,
      endereco: { ...COMPLETA.endereco, cep: '01001-000', cidade: 'São Paulo', uf: 'SP' },
      convenio: { operadora: 'Unimed', plano: 'Nacional', carteirinha: '1234', validade: '07/2027' },
    }
    const corpo = paraApi(original)
    const volta = daApi({
      nome: corpo.nome,
      momento: corpo.momento,
      titular: {
        ...corpo,
        endereco: corpo.endereco,
      },
      convenio: corpo.convenio,
    })

    expect(volta.cpf).toBe(original.cpf)
    expect(volta.telefone).toBe(original.telefone)
    expect(volta.endereco.cidade).toBe('São Paulo')
    expect(volta.convenio.validade).toBe('07/2027')
  })
})

describe('secoesPreenchidas', () => {
  it('marca só o que tem conteúdo', () => {
    const feitas = secoesPreenchidas(COMPLETA)
    expect(feitas.identificacao).toBe(true)
    expect(feitas.contato).toBe(true)
    expect(feitas.endereco).toBe(false)
    expect(feitas.convenio).toBe(false)
  })
})

describe('secaoDoErro', () => {
  it('leva cada campo à seção onde ele mora', () => {
    expect(secaoDoErro('nome')).toBe('identificacao')
    expect(secaoDoErro('telefone')).toBe('contato')
    expect(secaoDoErro('endereco.cep')).toBe('endereco')
    expect(secaoDoErro('convenio.validade')).toBe('convenio')
    expect(secaoDoErro('emergencia.telefone')).toBe('emergencia')
    expect(secaoDoErro('filhos.0.nome')).toBe('familia')
    expect(secaoDoErro('dpp')).toBe('momento')
  })
})
