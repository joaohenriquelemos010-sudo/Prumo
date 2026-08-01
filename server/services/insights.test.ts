import { describe, it, expect } from 'vitest'
import { calcularInsights } from './insights.js'
import type { PacienteBruto } from './insights.js'

/**
 * Um painel de números errados é pior que painel nenhum: ele muda decisão de
 * agenda com confiança injustificada. Por isso cada corte é fixado aqui, e não
 * verificado no olho.
 */

const AGORA = new Date('2026-06-15T12:00:00Z')
const DIA = 24 * 60 * 60 * 1000

function paciente(p: Partial<PacienteBruto> = {}): PacienteBruto {
  return {
    jornada: 'j1',
    nome: 'Paciente',
    momento: 'gestante',
    dpp: null,
    dataNascimento: null,
    temConta: true,
    proximo: null,
    ultimaConsulta: null,
    alertas: 0,
    ...p,
  }
}

/** DPP que coloca a gestante exatamente em `semanas` de gestação em AGORA. */
function dppPara(semanas: number): Date {
  return new Date(AGORA.getTime() + (280 - semanas * 7) * DIA)
}

describe('trimestres', () => {
  // Os trimestres da obstetrícia, não terços do calendário: 1º até 13s6d,
  // 2º de 14 a 27s6d, 3º de 28 em diante. Errar a fronteira muda a
  // periodicidade de consulta que o médico planeja.
  it.each([
    [6, 'primeiro'],
    [13, 'primeiro'],
    [14, 'segundo'],
    [27, 'segundo'],
    [28, 'terceiro'],
    [40, 'terceiro'],
  ])('%i semanas cai no %s trimestre', (semanas, esperado) => {
    const r = calcularInsights([paciente({ dpp: dppPara(semanas) })], AGORA)
    expect(r.gestantes[esperado as 'primeiro' | 'segundo' | 'terceiro']).toBe(1)
    expect(r.gestantes.total).toBe(1)
  })

  it('gestante sem DPP não entra em nenhum trimestre', () => {
    const r = calcularInsights([paciente({ dpp: null })], AGORA)
    expect(r.gestantes.total).toBe(0)
  })
})

describe('partos próximos', () => {
  it('conta quem tem DPP nos próximos 30 dias', () => {
    const r = calcularInsights(
      [
        paciente({ dpp: new Date(AGORA.getTime() + 10 * DIA) }),
        paciente({ dpp: new Date(AGORA.getTime() + 29 * DIA) }),
        paciente({ dpp: new Date(AGORA.getTime() + 45 * DIA) }),
      ],
      AGORA,
    )
    expect(r.partosProximos).toBe(2)
  })

  it('não conta DPP que já passou — aquilo não é mais previsão', () => {
    const r = calcularInsights([paciente({ dpp: new Date(AGORA.getTime() - 2 * DIA) })], AGORA)
    expect(r.partosProximos).toBe(0)
  })
})

describe('faixas de idade da criança', () => {
  const meses = (n: number) => new Date(AGORA.getTime() - n * 30.44 * DIA)

  it('separa até 6 meses, até 2 anos e maiores', () => {
    const r = calcularInsights(
      [
        paciente({ momento: 'ja-nasceu', dataNascimento: meses(2) }),
        paciente({ momento: 'ja-nasceu', dataNascimento: meses(12) }),
        paciente({ momento: 'ja-nasceu', dataNascimento: meses(40) }),
      ],
      AGORA,
    )
    expect(r.criancas).toEqual({ total: 3, ate6meses: 1, ate2anos: 1, maiores: 1 })
  })
})

describe('sem retorno marcado', () => {
  it('agendamento no futuro conta como retorno marcado', () => {
    const r = calcularInsights(
      [paciente({ proximo: new Date(AGORA.getTime() + DIA) })],
      AGORA,
    )
    expect(r.semRetorno).toBe(0)
  })

  it('agendamento no passado NÃO conta — já aconteceu', () => {
    const r = calcularInsights(
      [paciente({ proximo: new Date(AGORA.getTime() - DIA) })],
      AGORA,
    )
    expect(r.semRetorno).toBe(1)
  })
})

describe('em risco de abandono', () => {
  // A gestante que não volta é o desfecho que o pré-natal existe para evitar, e
  // é invisível numa lista ordenada por urgência: quem não tem horário marcado
  // simplesmente não aparece.
  it('90 dias sem consulta e sem retorno entra na lista', () => {
    const r = calcularInsights(
      [paciente({ nome: 'Ana', ultimaConsulta: new Date(AGORA.getTime() - 100 * DIA) })],
      AGORA,
    )
    expect(r.emRisco).toHaveLength(1)
    expect(r.emRisco[0].nome).toBe('Ana')
    expect(r.emRisco[0].diasSemConsulta).toBe(100)
  })

  it('89 dias ainda não é abandono', () => {
    const r = calcularInsights(
      [paciente({ ultimaConsulta: new Date(AGORA.getTime() - 89 * DIA) })],
      AGORA,
    )
    expect(r.emRisco).toHaveLength(0)
  })

  it('quem tem retorno marcado nunca está em risco, por mais antiga que seja a última', () => {
    const r = calcularInsights(
      [
        paciente({
          ultimaConsulta: new Date(AGORA.getTime() - 300 * DIA),
          proximo: new Date(AGORA.getTime() + DIA),
        }),
      ],
      AGORA,
    )
    expect(r.emRisco).toHaveLength(0)
  })

  it('quem sumiu há mais tempo aparece primeiro', () => {
    const r = calcularInsights(
      [
        paciente({ nome: 'Recente', ultimaConsulta: new Date(AGORA.getTime() - 95 * DIA) }),
        paciente({ nome: 'Antiga', ultimaConsulta: new Date(AGORA.getTime() - 400 * DIA) }),
      ],
      AGORA,
    )
    expect(r.emRisco.map((e) => e.nome)).toEqual(['Antiga', 'Recente'])
  })

  it('nunca devolve mais de 20 — é lista para ligar, não relatório', () => {
    const muitas = Array.from({ length: 50 }, (_, i) =>
      paciente({ nome: `P${i}`, ultimaConsulta: new Date(AGORA.getTime() - (100 + i) * DIA) }),
    )
    expect(calcularInsights(muitas, AGORA).emRisco).toHaveLength(20)
  })
})

describe('conta e alertas', () => {
  it('conta quantas ainda não vinculam conta — a métrica do modelo B2B2C', () => {
    const r = calcularInsights(
      [paciente({ temConta: false }), paciente({ temConta: false }), paciente({ temConta: true })],
      AGORA,
    )
    expect(r.semConta).toBe(2)
  })

  it('conta pacientes com alerta, não alertas', () => {
    const r = calcularInsights([paciente({ alertas: 3 }), paciente({ alertas: 0 })], AGORA)
    expect(r.comAlerta).toBe(1)
  })
})

describe('lista vazia', () => {
  it('devolve zeros em vez de explodir', () => {
    const r = calcularInsights([], AGORA)
    expect(r.total).toBe(0)
    expect(r.gestantes.total).toBe(0)
    expect(r.emRisco).toEqual([])
  })
})
