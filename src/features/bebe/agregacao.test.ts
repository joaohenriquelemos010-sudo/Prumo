import { describe, it, expect } from 'vitest'
import {
  agruparFetais,
  agruparInfantis,
  delta,
  anexosDoPeriodo,
  TRIMESTRES_GESTACAO,
} from './agregacao'
import type { MedidaFetal } from './tipos'
import type { PontoInfantil } from './CrescimentoInfantil'

/** 22 semanas de gestação medidas de duas em duas — o caso real. */
function medidasFetais(): MedidaFetal[] {
  const semanas = [8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 38]
  return semanas.map((semana, i) => ({
    id: `m${semana}`,
    semana,
    // Uma data por semana, coerente com a ordem — o agrupamento por data
    // depende disso e é o que casa exame com período.
    data: new Date(2026, 0, 1 + i * 14).toISOString(),
    autorNome: 'Dra. Alice',
    dbpMm: null,
    ccMm: null,
    caMm: null,
    cfMm: null,
    pfeG: 100 + i * 180,
    ilaCm: null,
    apresentacao: 'cefalica',
    placenta: '',
    observacao: '',
  }))
}

function pontosInfantis(): PontoInfantil[] {
  return [0, 1, 2, 4, 6, 9, 12, 18, 24].map((meses) => ({
    meses,
    data: new Date(2026, meses, 15).toISOString(),
    pesoKg: 3.2 + meses * 0.35,
    comprimentoCm: 49 + meses * 1.2,
    perimetroCefalicoCm: 34 + meses * 0.5,
    origem: meses === 0 ? ('nascimento' as const) : ('consulta' as const),
    autorNome: meses === 0 ? '' : 'Dr. Bruno',
    percentis: {},
  }))
}

describe('agruparFetais', () => {
  const medidas = medidasFetais()

  it('semana a semana dá um período por medida', () => {
    const p = agruparFetais(medidas, 'semana')
    expect(p).toHaveLength(medidas.length)
    expect(p[0].rotulo).toBe('Semana 8')
    expect(p.every((x) => x.itens.length === 1)).toBe(true)
  })

  it('mensal junta as semanas de quatro em quatro', () => {
    const p = agruparFetais(medidas, 'mes')
    expect(p.length).toBeLessThan(medidas.length)
    // Semanas 10 e 12 caem no 3º mês (9–12).
    const terceiro = p.find((x) => x.rotulo === '3º mês')
    expect(terceiro?.itens.map((m) => m.semana)).toEqual([10, 12])
  })

  /**
   * O teste que justifica os limites estarem escritos à mão. Dividir os dados
   * em três partes iguais daria buckets que mudam de significado toda vez que
   * uma medida nova entra.
   */
  it('trimestre usa os limites obstétricos, não terços dos dados', () => {
    const p = agruparFetais(medidas, 'trimestre')
    expect(p).toHaveLength(3)

    const [primeiro, segundo, terceiro] = p
    expect(primeiro.itens.every((m) => m.semana <= 13)).toBe(true)
    expect(segundo.itens.every((m) => m.semana >= 14 && m.semana <= 27)).toBe(true)
    expect(terceiro.itens.every((m) => m.semana >= 28)).toBe(true)

    // E não são partes iguais: o 2º trimestre tem mais medidas que o 1º.
    expect(segundo.itens.length).toBeGreaterThan(primeiro.itens.length)
  })

  it('os limites dos trimestres cobrem a gestação inteira sem buraco', () => {
    for (let i = 1; i < TRIMESTRES_GESTACAO.length; i++) {
      expect(TRIMESTRES_GESTACAO[i].de).toBe(TRIMESTRES_GESTACAO[i - 1].ate + 1)
    }
    expect(TRIMESTRES_GESTACAO[TRIMESTRES_GESTACAO.length - 1].ate).toBeGreaterThanOrEqual(42)
  })

  it('nenhuma medida se perde em nenhuma granularidade', () => {
    for (const g of ['semana', 'mes', 'trimestre'] as const) {
      const total = agruparFetais(medidas, g).reduce((n, p) => n + p.itens.length, 0)
      expect(total).toBe(medidas.length)
    }
  })

  it('não cria período vazio', () => {
    const esparsas = medidas.filter((m) => m.semana === 12 || m.semana === 36)
    const p = agruparFetais(esparsas, 'semana')
    expect(p).toHaveLength(2)
  })

  it('os períodos saem em ordem cronológica', () => {
    const p = agruparFetais(medidas, 'trimestre')
    expect(p.map((x) => x.de)).toEqual([...p.map((x) => x.de)].sort((a, b) => a - b))
  })

  it('cada período carrega as datas reais que cobre', () => {
    const p = agruparFetais(medidas, 'trimestre')
    expect(p[0].dataInicio).not.toBeNull()
    expect(new Date(p[0].dataInicio!) <= new Date(p[0].dataFim!)).toBe(true)
  })

  it('lista vazia devolve lista vazia, não um período fantasma', () => {
    expect(agruparFetais([], 'semana')).toEqual([])
  })
})

describe('agruparInfantis', () => {
  const pontos = pontosInfantis()

  /**
   * Depois do nascimento não existe "semana": a puericultura e as curvas da OMS
   * são mensais. Pedir semana tem que devolver mês, e não uma tela vazia.
   */
  it('semana cai para mês depois do nascimento', () => {
    expect(agruparInfantis(pontos, 'semana')).toEqual(agruparInfantis(pontos, 'mes'))
  })

  it('o mês zero se chama Nascimento', () => {
    expect(agruparInfantis(pontos, 'mes')[0].rotulo).toBe('Nascimento')
  })

  it('trimestre de vida agrupa de três em três meses', () => {
    const p = agruparInfantis(pontos, 'trimestre')
    const primeiro = p[0]
    expect(primeiro.itens.map((x) => x.meses)).toEqual([0, 1, 2])
    expect(primeiro.rotulo).toBe('1º trimestre de vida')
  })

  it('nenhum ponto se perde', () => {
    for (const g of ['semana', 'mes', 'trimestre'] as const) {
      const total = agruparInfantis(pontos, g).reduce((n, p) => n + p.itens.length, 0)
      expect(total).toBe(pontos.length)
    }
  })
})

describe('delta', () => {
  const medidas = medidasFetais()

  it('é a diferença entre o primeiro e o último valor da série', () => {
    const d = delta(
      medidas,
      (m) => m.pfeG,
      (m) => m.semana,
    )
    expect(d).not.toBeNull()
    expect(d!.de).toBe(8)
    expect(d!.ate).toBe(38)
    expect(d!.valor).toBe(medidas[medidas.length - 1].pfeG! - medidas[0].pfeG!)
  })

  /** Inventar "+0" seria afirmar algo que não se sabe. */
  it('um ponto só não tem delta', () => {
    const d = delta(
      [medidas[0]],
      (m) => m.pfeG,
      (m) => m.semana,
    )
    expect(d).toBeNull()
  })

  it('ignora os pontos sem valor em vez de tratá-los como zero', () => {
    const comBuraco = [
      { ...medidas[0], pfeG: null },
      medidas[1],
      medidas[2],
    ]
    const d = delta(
      comBuraco,
      (m) => m.pfeG,
      (m) => m.semana,
    )
    expect(d!.de).toBe(medidas[1].semana)
    expect(d!.valor).toBe(medidas[2].pfeG! - medidas[1].pfeG!)
  })

  it('funciona fora de ordem — ordena pela posição, não pelo índice', () => {
    const embaralhadas = [medidas[3], medidas[0], medidas[1]]
    const d = delta(
      embaralhadas,
      (m) => m.pfeG,
      (m) => m.semana,
    )
    expect(d!.de).toBe(medidas[0].semana)
    expect(d!.ate).toBe(medidas[3].semana)
  })

  it('delta negativo é um delta válido — perder peso é um fato clínico', () => {
    const caindo = [
      { ...medidas[0], semana: 1, pfeG: 3400 },
      { ...medidas[1], semana: 2, pfeG: 3200 },
    ]
    const d = delta(
      caindo,
      (m) => m.pfeG,
      (m) => m.semana,
    )
    expect(d!.valor).toBe(-200)
  })
})

describe('anexosDoPeriodo', () => {
  const periodo = {
    dataInicio: '2026-03-10T00:00:00.000Z',
    dataFim: '2026-03-20T00:00:00.000Z',
  }

  it('pega o que cai dentro do intervalo', () => {
    const dentro = [{ dataExame: '2026-03-15T00:00:00.000Z' }]
    expect(anexosDoPeriodo(dentro, periodo)).toHaveLength(1)
  })

  /** O exame quase nunca é no dia da consulta: é colhido antes e levado nela. */
  it('a folga alcança o exame colhido dias antes da consulta', () => {
    const antes = [{ dataExame: '2026-03-06T00:00:00.000Z' }]
    expect(anexosDoPeriodo(antes, periodo)).toHaveLength(1)
    expect(anexosDoPeriodo(antes, periodo, 0)).toHaveLength(0)
  })

  it('não pega o que está claramente fora', () => {
    const longe = [{ dataExame: '2026-01-01T00:00:00.000Z' }]
    expect(anexosDoPeriodo(longe, periodo)).toHaveLength(0)
  })

  it('período sem datas não reivindica anexo nenhum', () => {
    const qualquer = [{ dataExame: '2026-03-15T00:00:00.000Z' }]
    expect(anexosDoPeriodo(qualquer, { dataInicio: null, dataFim: null })).toHaveLength(0)
  })

  it('data inválida é descartada em vez de virar NaN dentro do filtro', () => {
    const quebrada = [{ dataExame: 'nao-e-data' }]
    expect(anexosDoPeriodo(quebrada, periodo)).toHaveLength(0)
  })
})
