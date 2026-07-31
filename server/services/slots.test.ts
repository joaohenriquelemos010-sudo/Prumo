import { describe, it, expect } from 'vitest'
import { expandirSlots, slotDisponivel } from './slots.js'
import type { ConfigDisponibilidade } from './slots.js'

/**
 * O motor de agenda.
 *
 * É o módulo mais puro do servidor — sem banco, sem relógio implícito — e é
 * também aquele em que um erro custa mais caro de forma invisível: um slot
 * oferecido que não existe vira uma paciente na porta de um consultório fechado,
 * e um slot escondido vira faturamento perdido que ninguém nota.
 *
 * O horário de verão merece atenção especial. O Brasil não o observa hoje, mas o
 * motor calcula em `America/Sao_Paulo` via `Intl`, e o dia em que a regra voltar
 * — ou o dia em que uma clínica de outro fuso entrar — o comportamento tem que
 * ser o que está fixado aqui.
 */
function config(over: Partial<ConfigDisponibilidade> = {}): ConfigDisponibilidade {
  return {
    ativo: true,
    duracaoPadraoMin: 30,
    antecedenciaMinHoras: 0,
    janelaMaxDias: 60,
    fuso: 'America/Sao_Paulo',
    regras: [
      { diaSemana: 1, inicio: '09:00', fim: '12:00', modalidades: ['presencial'], local: 'Sala 1' },
    ],
    bloqueios: [],
    ...over,
  } as ConfigDisponibilidade
}

/** Uma segunda-feira bem longe de qualquer transição. */
const SEGUNDA = '2026-03-09'
/** Meia-noite UTC do domingo anterior — "agora" sem antecedência atrapalhando. */
const ANTES = new Date('2026-03-08T00:00:00Z')

describe('expandirSlots', () => {
  it('fatia a janela na duração padrão', () => {
    const dias = expandirSlots(config(), SEGUNDA, SEGUNDA, [], ANTES)
    expect(dias).toHaveLength(1)
    // 09:00–12:00 em fatias de 30 min = 6 slots.
    expect(dias[0].slots).toHaveLength(6)
  })

  it('agenda desativada não oferece nada', () => {
    expect(expandirSlots(config({ ativo: false }), SEGUNDA, SEGUNDA, [], ANTES)).toEqual([])
  })

  it('sem regras não oferece nada', () => {
    expect(expandirSlots(config({ regras: [] }), SEGUNDA, SEGUNDA, [], ANTES)).toEqual([])
  })

  it('só o dia da semana da regra aparece', () => {
    // Terça a quinta: nenhuma regra de segunda se aplica.
    const dias = expandirSlots(config(), '2026-03-10', '2026-03-12', [], ANTES)
    expect(dias).toEqual([])
  })

  it('não cria dia vazio — um dia sem slot simplesmente não entra', () => {
    const dias = expandirSlots(config(), '2026-03-08', '2026-03-10', [], ANTES)
    expect(dias.map((d) => d.dia)).toEqual([SEGUNDA])
  })

  it('uma regra que termina antes de começar é ignorada, e não invertida', () => {
    const dias = expandirSlots(
      config({
        regras: [
          { diaSemana: 1, inicio: '12:00', fim: '09:00', modalidades: [], local: '' },
        ],
      } as Partial<ConfigDisponibilidade>),
      SEGUNDA,
      SEGUNDA,
      [],
      ANTES,
    )
    expect(dias).toEqual([])
  })

  it('a fatia final que não cabe inteira não é oferecida', () => {
    // 09:00–10:20 com 30 min: cabem duas fatias (09:00 e 09:30); a terceira
    // terminaria 10:30, depois do fim. Oferecer meia consulta é pior que nada.
    const dias = expandirSlots(
      config({
        regras: [{ diaSemana: 1, inicio: '09:00', fim: '10:20', modalidades: [], local: '' }],
      } as Partial<ConfigDisponibilidade>),
      SEGUNDA,
      SEGUNDA,
      [],
      ANTES,
    )
    expect(dias[0].slots).toHaveLength(2)
  })

  describe('antecedência mínima', () => {
    it('esconde o que está perto demais de agora', () => {
      // "Agora" é 09:00 do próprio dia, com 4h de antecedência: some tudo
      // antes das 13:00 — ou seja, a manhã inteira.
      const agora = new Date('2026-03-09T12:00:00Z') // 09:00 em São Paulo (UTC-3)
      const dias = expandirSlots(config({ antecedenciaMinHoras: 4 }), SEGUNDA, SEGUNDA, [], agora)
      expect(dias).toEqual([])
    })

    it('sem antecedência, o dia inteiro continua disponível', () => {
      const agora = new Date('2026-03-09T11:00:00Z') // 08:00 em São Paulo
      const dias = expandirSlots(config({ antecedenciaMinHoras: 0 }), SEGUNDA, SEGUNDA, [], agora)
      expect(dias[0].slots).toHaveLength(6)
    })
  })

  describe('horizonte de agendamento', () => {
    it('não oferece além da janela máxima', () => {
      const dias = expandirSlots(config({ janelaMaxDias: 0 }), SEGUNDA, SEGUNDA, [], ANTES)
      expect(dias).toEqual([])
    })

    it('um intervalo absurdo não trava o motor', () => {
      // A parada dura é o horizonte, não o `ate`. Sem ela, `de` mal formado
      // com `ate` distante giraria por anos.
      const dias = expandirSlots(config({ janelaMaxDias: 7 }), SEGUNDA, '2099-01-01', [], ANTES)
      expect(dias.length).toBeLessThanOrEqual(8)
    })
  })

  describe('bloqueios e horários ocupados', () => {
    it('um bloqueio remove os slots que ele cobre', () => {
      const dias = expandirSlots(
        config({
          bloqueios: [
            { de: new Date('2026-03-09T12:00:00Z'), ate: new Date('2026-03-09T13:00:00Z') },
          ],
        } as Partial<ConfigDisponibilidade>),
        SEGUNDA,
        SEGUNDA,
        [],
        ANTES,
      )
      // 09:00 e 09:30 (horário local) saem; sobram 4.
      expect(dias[0].slots).toHaveLength(4)
    })

    it('um agendamento existente remove o horário dele', () => {
      const ocupados = [{ inicio: new Date('2026-03-09T12:00:00Z'), duracaoMin: 30 }]
      const dias = expandirSlots(config(), SEGUNDA, SEGUNDA, ocupados, ANTES)
      expect(dias[0].slots).toHaveLength(5)
    })

    /**
     * O caso que um teste de igualdade de horário não pega: uma consulta de 45
     * min começando às 09:00 invade a fatia das 09:30, que não começa no mesmo
     * instante que ela.
     */
    it('sobreposição parcial também remove', () => {
      const ocupados = [{ inicio: new Date('2026-03-09T12:00:00Z'), duracaoMin: 45 }]
      const dias = expandirSlots(config(), SEGUNDA, SEGUNDA, ocupados, ANTES)
      expect(dias[0].slots).toHaveLength(4)
    })

    it('encostar não é sobrepor — uma consulta que termina às 09:30 libera as 09:30', () => {
      const ocupados = [{ inicio: new Date('2026-03-09T11:30:00Z'), duracaoMin: 30 }]
      const dias = expandirSlots(config(), SEGUNDA, SEGUNDA, ocupados, ANTES)
      expect(dias[0].slots).toHaveLength(6)
    })
  })

  it('os slots saem em ordem cronológica', () => {
    const dias = expandirSlots(
      config({
        regras: [
          { diaSemana: 1, inicio: '14:00', fim: '16:00', modalidades: [], local: 'Tarde' },
          { diaSemana: 1, inicio: '09:00', fim: '11:00', modalidades: [], local: 'Manhã' },
        ],
      } as Partial<ConfigDisponibilidade>),
      SEGUNDA,
      SEGUNDA,
      [],
      ANTES,
    )
    const inicios = dias[0].slots.map((s) => s.inicio)
    expect(inicios).toEqual([...inicios].sort())
  })

  it('modalidade vazia cai em presencial em vez de sair vazia', () => {
    const dias = expandirSlots(
      config({
        regras: [{ diaSemana: 1, inicio: '09:00', fim: '10:00', modalidades: [], local: '' }],
      } as Partial<ConfigDisponibilidade>),
      SEGUNDA,
      SEGUNDA,
      [],
      ANTES,
    )
    expect(dias[0].slots[0].modalidades).toEqual(['presencial'])
  })

  it('data mal formada devolve vazio, e não uma exceção', () => {
    expect(expandirSlots(config(), 'ontem', SEGUNDA, [], ANTES)).toEqual([])
    expect(expandirSlots(config(), SEGUNDA, '32/13/2026', [], ANTES)).toEqual([])
  })
})

describe('slotDisponivel', () => {
  /**
   * A rota de agendamento pergunta isto em vez de confiar no slot que o cliente
   * devolveu: a lista de onde ele saiu pode ter segundos de idade, e duas
   * pessoas podem querer as mesmas 09:00.
   */
  const noSlot = new Date('2026-03-09T12:00:00Z') // 09:00 em São Paulo

  it('aceita um horário que está na grade', () => {
    expect(slotDisponivel(config(), noSlot, [], ANTES)).toBe(true)
  })

  it('recusa um horário fora da grade', () => {
    const foraDaJanela = new Date('2026-03-09T20:00:00Z') // 17:00 local
    expect(slotDisponivel(config(), foraDaJanela, [], ANTES)).toBe(false)
  })

  it('recusa um horário desalinhado com a fatia', () => {
    const desalinhado = new Date('2026-03-09T12:10:00Z') // 09:10 local
    expect(slotDisponivel(config(), desalinhado, [], ANTES)).toBe(false)
  })

  it('recusa quando alguém já pegou', () => {
    const ocupados = [{ inicio: noSlot, duracaoMin: 30 }]
    expect(slotDisponivel(config(), noSlot, ocupados, ANTES)).toBe(false)
  })

  it('recusa em dia da semana sem regra', () => {
    const terca = new Date('2026-03-10T12:00:00Z')
    expect(slotDisponivel(config(), terca, [], ANTES)).toBe(false)
  })
})
