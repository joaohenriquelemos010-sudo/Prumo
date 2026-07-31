import { describe, it, expect } from 'vitest'
import { podeEnviar, emSilencio, fimDoSilencio, deveColapsar } from './politica.js'
import type { Preferencias, LembreteParaAvaliar } from './politica.js'

function prefs(over: Partial<Preferencias> = {}): Preferencias {
  return {
    canais: { email: true, inapp: true, push: false },
    silencio: { de: '21:00', ate: '08:00', fuso: 'America/Sao_Paulo' },
    limites: { porDia: 1, porSemana: 3 },
    tipos: { consulta: true, checklist: true, exame: true, vacina: true, resumo: true, sequencia: false },
    ...over,
  }
}

function lembrete(over: Partial<LembreteParaAvaliar> = {}): LembreteParaAvaliar {
  return { canal: 'email', tipo: 'checklist', prioridade: 3, agendadoPara: new Date(), ...over }
}

const vazio = { noDia: 0, naSemana: 0 }

/** 14h em São Paulo (UTC-3) — bem no meio da janela permitida. */
const TARDE = new Date('2026-03-15T17:00:00.000Z')
/** 2h da manhã em São Paulo — silêncio. */
const MADRUGADA = new Date('2026-03-15T05:00:00.000Z')

describe('emSilencio', () => {
  it('madrugada é silêncio', () => {
    expect(emSilencio(MADRUGADA, prefs().silencio)).toBe(true)
  })

  it('meio da tarde não é', () => {
    expect(emSilencio(TARDE, prefs().silencio)).toBe(false)
  })

  /** A janela cruza a meia-noite — 22h e 3h são ambos silêncio. */
  it('a janela que cruza a meia-noite pega os dois lados', () => {
    const dezDaNoite = new Date('2026-03-16T01:00:00.000Z') // 22h em SP
    const tresDaManha = new Date('2026-03-15T06:00:00.000Z') // 3h em SP
    expect(emSilencio(dezDaNoite, prefs().silencio)).toBe(true)
    expect(emSilencio(tresDaManha, prefs().silencio)).toBe(true)
  })

  it('uma janela que não cruza a meia-noite também funciona', () => {
    const s = { de: '12:00', ate: '14:00', fuso: 'America/Sao_Paulo' }
    expect(emSilencio(new Date('2026-03-15T16:00:00.000Z'), s)).toBe(true) // 13h SP
    expect(emSilencio(new Date('2026-03-15T18:00:00.000Z'), s)).toBe(false) // 15h SP
  })

  it('fuso inválido não trava a decisão', () => {
    const s = { de: '21:00', ate: '08:00', fuso: 'Nao/Existe' }
    expect(() => emSilencio(TARDE, s)).not.toThrow()
  })
})

describe('fimDoSilencio', () => {
  it('devolve um instante no futuro', () => {
    const fim = fimDoSilencio(MADRUGADA, prefs().silencio)
    expect(fim.getTime()).toBeGreaterThan(MADRUGADA.getTime())
  })

  it('às 2h da manhã, a espera é de poucas horas', () => {
    const horas = (fimDoSilencio(MADRUGADA, prefs().silencio).getTime() - MADRUGADA.getTime()) / 3.6e6
    expect(horas).toBeGreaterThan(5)
    expect(horas).toBeLessThan(7)
  })

  it('às 22h, a espera atravessa a noite', () => {
    const dezDaNoite = new Date('2026-03-16T01:00:00.000Z')
    const horas = (fimDoSilencio(dezDaNoite, prefs().silencio).getTime() - dezDaNoite.getTime()) / 3.6e6
    expect(horas).toBeGreaterThan(9)
    expect(horas).toBeLessThan(11)
  })
})

describe('podeEnviar — escolhas da pessoa', () => {
  it('canal desligado suprime', () => {
    const d = podeEnviar(lembrete({ canal: 'email' }), prefs({ canais: { email: false, inapp: true, push: false } }), vazio, TARDE)
    expect(d).toEqual({ acao: 'suprimir', motivo: 'canal-desligado' })
  })

  it('tipo desligado suprime', () => {
    const d = podeEnviar(lembrete({ tipo: 'sequencia' }), prefs(), vazio, TARDE)
    expect(d).toEqual({ acao: 'suprimir', motivo: 'tipo-desligado' })
  })

  /**
   * O default que mais importa: cutucão de sequência não sai a menos que a
   * pessoa tenha ligado. É notificação que serve ao produto, não a ela.
   */
  it('sequência vem desligada por padrão', () => {
    expect(prefs().tipos.sequencia).toBe(false)
  })

  it('tipo desconhecido não é silenciado por omissão', () => {
    const d = podeEnviar(lembrete({ tipo: 'algo-novo' }), prefs(), vazio, TARDE)
    expect(d.acao).toBe('enviar')
  })

  it('pausa adia até o fim da pausa, sem descartar', () => {
    const ate = new Date(TARDE.getTime() + 7 * 864e5)
    const d = podeEnviar(lembrete(), prefs({ pausadoAte: ate }), vazio, TARDE)
    expect(d.acao).toBe('adiar')
    if (d.acao === 'adiar') {
      expect(d.motivo).toBe('pausado')
      expect(d.para.getTime()).toBe(ate.getTime())
    }
  })

  it('pausa vencida não bloqueia', () => {
    const ontem = new Date(TARDE.getTime() - 864e5)
    expect(podeEnviar(lembrete(), prefs({ pausadoAte: ontem }), vazio, TARDE).acao).toBe('enviar')
  })
})

describe('podeEnviar — horário', () => {
  /**
   * A regra que mais muda o produto: silêncio **adia**, não suprime. Um
   * lembrete que chega às 8h ainda serve; um descartado às 2h nunca existiu
   * para quem deveria recebê-lo.
   */
  it('horário silencioso adia em vez de suprimir', () => {
    const d = podeEnviar(lembrete(), prefs(), vazio, MADRUGADA)
    expect(d.acao).toBe('adiar')
    if (d.acao === 'adiar') expect(d.motivo).toBe('horario-silencioso')
  })

  it('nem a consulta acorda a pessoa de madrugada', () => {
    const d = podeEnviar(lembrete({ tipo: 'consulta', prioridade: 1 }), prefs(), vazio, MADRUGADA)
    expect(d.acao).toBe('adiar')
  })
})

describe('podeEnviar — volume', () => {
  it('o teto diário adia o que não é urgente', () => {
    const d = podeEnviar(lembrete({ prioridade: 3 }), prefs(), { noDia: 1, naSemana: 1 }, TARDE)
    expect(d.acao).toBe('adiar')
    if (d.acao === 'adiar') expect(d.motivo).toBe('limite-diario')
  })

  it('o teto semanal também adia', () => {
    const d = podeEnviar(lembrete({ prioridade: 3 }), prefs(), { noDia: 0, naSemana: 3 }, TARDE)
    expect(d.acao).toBe('adiar')
    if (d.acao === 'adiar') expect(d.motivo).toBe('limite-semanal')
  })

  /**
   * A única exceção, e ela é estreita de propósito: faltar a uma consulta de
   * pré-natal custa mais que um e-mail a mais. Se a exceção crescesse, viraria
   * a regra e o teto deixaria de significar algo.
   */
  it('a consulta fura o teto', () => {
    const cheio = { noDia: 5, naSemana: 20 }
    expect(podeEnviar(lembrete({ tipo: 'consulta', prioridade: 1 }), prefs(), cheio, TARDE).acao).toBe('enviar')
    expect(podeEnviar(lembrete({ tipo: 'consulta', prioridade: 2 }), prefs(), cheio, TARDE).acao).toBe('enviar')
  })

  it('prioridade 3 em diante NÃO fura', () => {
    const cheio = { noDia: 5, naSemana: 20 }
    expect(podeEnviar(lembrete({ prioridade: 3 }), prefs(), cheio, TARDE).acao).toBe('adiar')
    expect(podeEnviar(lembrete({ prioridade: 5 }), prefs(), cheio, TARDE).acao).toBe('adiar')
  })

  it('a escolha dela vence a prioridade — canal desligado suprime até consulta', () => {
    const d = podeEnviar(
      lembrete({ tipo: 'consulta', prioridade: 1 }),
      prefs({ canais: { email: false, inapp: true, push: false } }),
      vazio,
      TARDE,
    )
    expect(d.acao).toBe('suprimir')
  })
})

describe('deveColapsar', () => {
  it('dois lembretes comuns viram um resumo', () => {
    expect(deveColapsar([{ tipo: 'checklist', prioridade: 3 }, { tipo: 'vacina', prioridade: 3 }])).toBe(true)
  })

  it('um sozinho não colapsa', () => {
    expect(deveColapsar([{ tipo: 'checklist', prioridade: 3 }])).toBe(false)
  })

  /** Consulta tem horário e ação própria — diluí-la num resumo perde o aviso. */
  it('consultas não entram no resumo', () => {
    expect(
      deveColapsar([
        { tipo: 'consulta', prioridade: 1 },
        { tipo: 'consulta', prioridade: 1 },
      ]),
    ).toBe(false)
  })

  it('consulta + um comum não colapsa', () => {
    expect(
      deveColapsar([
        { tipo: 'consulta', prioridade: 1 },
        { tipo: 'checklist', prioridade: 3 },
      ]),
    ).toBe(false)
  })
})
