import { describe, it, expect } from 'vitest'
import {
  daDisponibilidade,
  faixaInvalida,
  faixasInvalidas,
  paraCorpoApi,
  repetirDia,
  substituirDia,
} from './semana'
import type { SemanaConfig } from './semana'

function semana(over: Partial<SemanaConfig> = {}): SemanaConfig {
  return {
    periodos: [
      { diaSemana: 1, inicio: '08:00', fim: '18:00', modalidades: ['presencial'], local: '' },
    ],
    intervalos: [],
    bloqueios: [],
    reposicoes: [],
    ...over,
  }
}

describe('faixaInvalida', () => {
  it('aceita a faixa que fecha', () => {
    expect(faixaInvalida({ inicio: '08:00', fim: '18:00' })).toBe(false)
  })

  it('recusa a faixa invertida e a de duração zero', () => {
    // Não é atendimento que vira a madrugada: é dedo trocado. O motor de slots
    // descarta as duas, e a tela precisa dizer isso antes de salvar.
    expect(faixaInvalida({ inicio: '18:00', fim: '08:00' })).toBe(true)
    expect(faixaInvalida({ inicio: '12:00', fim: '12:00' })).toBe(true)
  })

  it('recusa hora vazia ou sem sentido', () => {
    expect(faixaInvalida({ inicio: '', fim: '18:00' })).toBe(true)
    expect(faixaInvalida({ inicio: '08:00', fim: '99:99' })).toBe(true)
  })
})

describe('faixasInvalidas', () => {
  it('conta em todas as quatro listas, não só nos períodos', () => {
    const contagem = faixasInvalidas(
      semana({
        periodos: [
          { diaSemana: 1, inicio: '18:00', fim: '08:00', modalidades: ['presencial'], local: '' },
        ],
        intervalos: [{ diaSemana: 1, inicio: '13:00', fim: '12:00' }],
        bloqueios: [{ diaSemana: 1, inicio: '16:00', fim: '16:20' }],
        reposicoes: [{ diaSemana: 1, inicio: '19:30', fim: '19:00' }],
      }),
    )
    expect(contagem).toBe(3)
  })
})

describe('substituirDia', () => {
  it('troca só o dia pedido e devolve a semana ordenada', () => {
    const lista = [
      { diaSemana: 3, inicio: '08:00', fim: '12:00' },
      { diaSemana: 1, inicio: '08:00', fim: '12:00' },
    ]
    const nova = substituirDia(lista, 1, [{ diaSemana: 1, inicio: '14:00', fim: '18:00' }])
    expect(nova).toEqual([
      { diaSemana: 1, inicio: '14:00', fim: '18:00' },
      { diaSemana: 3, inicio: '08:00', fim: '12:00' },
    ])
  })

  it('lista vazia para um dia apaga o dia', () => {
    const lista = [{ diaSemana: 1, inicio: '08:00', fim: '12:00' }]
    expect(substituirDia(lista, 1, [])).toEqual([])
  })
})

describe('repetirDia', () => {
  it('copia as quatro listas do dia de origem, reescrevendo o dia de destino', () => {
    const nova = repetirDia(
      semana({
        periodos: [
          { diaSemana: 1, inicio: '08:00', fim: '18:00', modalidades: ['presencial'], local: 'Sala 3' },
        ],
        intervalos: [{ diaSemana: 1, inicio: '12:00', fim: '13:00' }],
      }),
      1,
      [2, 3],
    )

    expect(nova.periodos).toEqual([
      { diaSemana: 1, inicio: '08:00', fim: '18:00', modalidades: ['presencial'], local: 'Sala 3' },
      { diaSemana: 2, inicio: '08:00', fim: '18:00', modalidades: ['presencial'], local: 'Sala 3' },
      { diaSemana: 3, inicio: '08:00', fim: '18:00', modalidades: ['presencial'], local: 'Sala 3' },
    ])
    expect(nova.intervalos.map((f) => f.diaSemana)).toEqual([1, 2, 3])
  })

  it('substitui o que o destino tinha em vez de somar', () => {
    // Repetir é "a terça fica igual à segunda", não "a terça ganha mais uma faixa".
    const nova = repetirDia(
      semana({
        periodos: [
          { diaSemana: 1, inicio: '08:00', fim: '12:00', modalidades: ['presencial'], local: '' },
          { diaSemana: 2, inicio: '14:00', fim: '20:00', modalidades: ['presencial'], local: '' },
        ],
      }),
      1,
      [2],
    )
    expect(nova.periodos).toHaveLength(2)
    expect(nova.periodos[1]).toMatchObject({ diaSemana: 2, inicio: '08:00', fim: '12:00' })
  })

  it('apaga no destino a lista que a origem não tem', () => {
    const nova = repetirDia(
      semana({ intervalos: [{ diaSemana: 2, inicio: '12:00', fim: '13:00' }] }),
      1,
      [2],
    )
    expect(nova.intervalos).toEqual([])
  })

  it('ignora a própria origem e a lista vazia de destinos', () => {
    const original = semana()
    expect(repetirDia(original, 1, [1])).toBe(original)
    expect(repetirDia(original, 1, [])).toBe(original)
  })
})

/**
 * A ponte com o servidor.
 *
 * O caso que importa é o almoço legado: a agenda de quem configurou antes da
 * grade tem uma pausa só, global. Se ela não aparecesse na tela, a médica veria
 * uma semana sem almoço, salvaria, e o almoço continuaria fechando horário no
 * motor — invisível e inexplicável.
 */
describe('daDisponibilidade', () => {
  it('converte o almoço global em um intervalo por dia atendido', () => {
    const s = daDisponibilidade({
      almoco: { inicio: '12:00', fim: '13:00' },
      regras: [
        { diaSemana: 1, inicio: '08:00', fim: '18:00', modalidades: ['presencial'], local: '' },
        { diaSemana: 3, inicio: '08:00', fim: '18:00', modalidades: ['presencial'], local: '' },
      ],
    })
    expect(s.intervalos).toEqual([
      { diaSemana: 1, inicio: '12:00', fim: '13:00' },
      { diaSemana: 3, inicio: '12:00', fim: '13:00' },
    ])
  })

  it('não duplica o almoço quando já existem intervalos por dia', () => {
    const s = daDisponibilidade({
      almoco: { inicio: '12:00', fim: '13:00' },
      regras: [
        { diaSemana: 1, inicio: '08:00', fim: '18:00', modalidades: ['presencial'], local: '' },
      ],
      intervalos: [{ diaSemana: 1, inicio: '11:30', fim: '12:30' }],
    })
    expect(s.intervalos).toEqual([{ diaSemana: 1, inicio: '11:30', fim: '12:30' }])
  })

  it('dois períodos no mesmo dia geram um intervalo só, não dois', () => {
    const s = daDisponibilidade({
      almoco: { inicio: '12:00', fim: '13:00' },
      regras: [
        { diaSemana: 1, inicio: '08:00', fim: '12:00', modalidades: ['presencial'], local: '' },
        { diaSemana: 1, inicio: '13:00', fim: '18:00', modalidades: ['presencial'], local: '' },
      ],
    })
    expect(s.intervalos).toHaveLength(1)
  })

  it('disponibilidade em branco vira semana vazia, e não quebra', () => {
    expect(daDisponibilidade({})).toEqual({
      periodos: [],
      intervalos: [],
      bloqueios: [],
      reposicoes: [],
    })
  })
})

describe('paraCorpoApi', () => {
  it('limpa o almoço global — a grade é a dona das pausas agora', () => {
    const corpo = paraCorpoApi(semana({ intervalos: [{ diaSemana: 1, inicio: '12:00', fim: '13:00' }] }))
    expect(corpo.almoco).toEqual({ inicio: '', fim: '' })
    expect(corpo.intervalos).toEqual([
      { diaSemana: 1, inicio: '12:00', fim: '13:00', motivo: '' },
    ])
  })

  it('não manda o que esta tela não edita', () => {
    // O PUT aplica o que recebe: mandar duração ou convênios daqui reescreveria
    // com cópia velha o que a outra tela acabou de salvar.
    const corpo = paraCorpoApi(semana())
    expect(Object.keys(corpo).sort()).toEqual([
      'almoco',
      'bloqueiosSemanais',
      'intervalos',
      'regras',
      'reposicoes',
    ])
  })

  it('período sem modalidade sai como presencial', () => {
    const corpo = paraCorpoApi(
      semana({ periodos: [{ diaSemana: 1, inicio: '08:00', fim: '18:00', modalidades: [], local: '' }] }),
    )
    expect(corpo.regras[0].modalidades).toEqual(['presencial'])
  })
})
