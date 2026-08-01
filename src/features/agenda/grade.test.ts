import { describe, it, expect } from 'vitest'
import {
  distribuirColunas,
  diasDaSemana,
  faixaDeHoras,
  horaParaMinuto,
  inicioDaSemana,
  linhasDeHora,
  minutoDoDia,
  minutoParaHora,
  posicao,
  posicionar,
  semanaDoAno,
  semanaExibida,
} from './grade'

/**
 * Calendário é a tela em que o defeito não parece defeito: um evento desenhado
 * meia hora acima do lugar continua sendo um retângulo bonito, e ninguém percebe
 * até alguém perder a consulta. Daí a matemática ficar separada da pintura, e
 * ser conferida valor a valor.
 *
 * As datas são construídas com `new Date(ano, mês, dia, hora)` de propósito —
 * esse construtor é local, que é o mesmo relógio que a grade usa.
 */

const evento = (id: string, hora: number, minuto = 0, duracaoMin = 30) => ({
  id,
  inicio: new Date(2026, 6, 27, hora, minuto).toISOString(),
  duracaoMin,
})

describe('conversões de hora', () => {
  it('lê HH:MM', () => {
    expect(horaParaMinuto('09:00')).toBe(540)
    expect(horaParaMinuto('00:00')).toBe(0)
    expect(horaParaMinuto('23:59')).toBe(1439)
    expect(horaParaMinuto(' 7:30 ')).toBe(450)
  })

  it('recusa o que não é hora, em vez de devolver NaN', () => {
    // NaN se propagaria pela geometria inteira e viraria um bloco invisível.
    expect(horaParaMinuto('')).toBeNull()
    expect(horaParaMinuto('abc')).toBeNull()
    expect(horaParaMinuto('25:00')).toBeNull()
    expect(horaParaMinuto('10:75')).toBeNull()
  })

  it('volta para HH:MM com zero à esquerda', () => {
    expect(minutoParaHora(540)).toBe('09:00')
    expect(minutoParaHora(0)).toBe('00:00')
    expect(minutoParaHora(1439)).toBe('23:59')
  })

  it('minutoDoDia lê o relógio local', () => {
    expect(minutoDoDia(new Date(2026, 6, 27, 14, 30).toISOString())).toBe(870)
  })
})

describe('faixaDeHoras', () => {
  it('o horário de trabalho ALARGA o padrão, nunca o estreita', () => {
    // 08:00–18:00 cabe dentro do padrão 07:00–19:00, então a faixa não muda: o
    // médico que atende das 8 às 18 ainda quer ver as 7 e as 18 na tela.
    expect(faixaDeHoras([], [{ inicio: '08:00', fim: '18:00' }])).toEqual({ de: 420, ate: 1140 })
  })

  it('expediente mais largo que o padrão manda', () => {
    expect(faixaDeHoras([], [{ inicio: '06:00', fim: '22:00' }])).toEqual({ de: 360, ate: 1320 })
  })

  it('cresce para caber um atendimento fora do expediente', () => {
    // O balcão às 20h precisa aparecer: senão a agenda deixa de ser o registro
    // do dia e vira o registro do que estava planejado.
    const f = faixaDeHoras([evento('a', 20)], [{ inicio: '08:00', fim: '18:00' }])
    expect(f.ate).toBe(21 * 60)
  })

  it('cresce para trás também', () => {
    const f = faixaDeHoras([evento('a', 6, 30)], [{ inicio: '08:00', fim: '18:00' }])
    expect(f.de).toBe(6 * 60)
  })

  /*
   * A regressão que apareceu na tela: um médico recém-cadastrado, sem expediente
   * configurado, com um único atendimento tarde da noite. A faixa desabava para
   * uma hora e o dia de trabalho inteiro saía da tela. Nada quebrava — a agenda
   * só ficava inútil, e parecia quebrada.
   */
  it('um atendimento às 23:30 NÃO encolhe a grade para uma faixa de uma hora', () => {
    const f = faixaDeHoras([evento('a', 23, 30)], [])
    expect(f.de).toBe(420)
    expect(f.ate).toBe(24 * 60)
  })

  it('um atendimento de madrugada mantém o dia de trabalho visível', () => {
    const f = faixaDeHoras([evento('a', 5, 0)], [])
    expect(f).toEqual({ de: 300, ate: 1140 })
  })

  it('a faixa nunca fica menor que o padrão, aconteça o que acontecer', () => {
    for (const h of [0, 3, 9, 14, 21, 23]) {
      const f = faixaDeHoras([evento('x', h)], [])
      expect(f.de, `evento às ${h}h`).toBeLessThanOrEqual(420)
      expect(f.ate, `evento às ${h}h`).toBeGreaterThanOrEqual(1140)
    }
  })

  it('arredonda para a hora cheia — grade começando 07:23 não ajuda o olho', () => {
    const f = faixaDeHoras([evento('a', 7, 23)], [])
    expect(f.de % 60).toBe(0)
    expect(f.ate % 60).toBe(0)
  })

  it('sem nada configurado e sem eventos, é o padrão', () => {
    expect(faixaDeHoras([], [])).toEqual({ de: 420, ate: 1140 })
  })

  it('ignora horários malformados em vez de estourar a faixa', () => {
    expect(faixaDeHoras([], [{ inicio: 'xx', fim: 'yy' }])).toEqual({ de: 420, ate: 1140 })
  })

  it('ignora data inválida em vez de propagar NaN pela geometria', () => {
    expect(faixaDeHoras([{ id: 'x', inicio: 'não é data', duracaoMin: 30 }], [])).toEqual({
      de: 420,
      ate: 1140,
    })
  })

  it('nunca passa da meia-noite', () => {
    const f = faixaDeHoras([evento('a', 23, 30, 120)], [])
    expect(f.ate).toBeLessThanOrEqual(24 * 60)
  })
})

describe('posicao', () => {
  const faixa = { de: 7 * 60, ate: 19 * 60 } // 12 horas

  it('coloca o começo da faixa no topo', () => {
    expect(posicao(evento('a', 7), faixa).topo).toBe(0)
  })

  it('coloca o meio no meio', () => {
    expect(posicao(evento('a', 13), faixa).topo).toBeCloseTo(50, 5)
  })

  it('a altura é proporcional à duração', () => {
    // 1 hora em 12 → 1/12 da altura.
    expect(posicao(evento('a', 9, 0, 60), faixa).altura).toBeCloseTo(100 / 12, 5)
  })

  it('corta o que passa do fim da faixa em vez de escapar do container', () => {
    const p = posicao(evento('a', 18, 0, 180), faixa)
    expect(p.topo + p.altura).toBeLessThanOrEqual(100.001)
  })

  it('dá altura mínima a uma consulta curta — ilegível é o mesmo que ausente', () => {
    expect(posicao(evento('a', 9, 0, 5), faixa).altura).toBeGreaterThanOrEqual(1.5)
  })
})

describe('distribuirColunas', () => {
  it('eventos que não se tocam ocupam a largura inteira', () => {
    const r = distribuirColunas([evento('a', 9), evento('b', 10), evento('c', 11)])
    expect(r.every((x) => x.colunas === 1 && x.coluna === 0)).toBe(true)
  })

  it('dois no mesmo horário dividem a largura', () => {
    // O pior defeito possível numa agenda é o segundo sumir atrás do primeiro:
    // o esquecido fica invisível.
    const r = distribuirColunas([evento('a', 9), evento('b', 9)])
    expect(r.map((x) => x.colunas)).toEqual([2, 2])
    expect(new Set(r.map((x) => x.coluna))).toEqual(new Set([0, 1]))
  })

  it('sobreposição parcial também divide', () => {
    const r = distribuirColunas([evento('a', 9, 0, 60), evento('b', 9, 30, 60)])
    expect(r.every((x) => x.colunas === 2)).toBe(true)
  })

  it('encostar exatamente no fim NÃO é sobreposição', () => {
    // 09:00–09:30 e 09:30–10:00 são consecutivos, não simultâneos. Dividir a
    // largura aqui desperdiçaria metade da agenda de um consultório cheio.
    const r = distribuirColunas([evento('a', 9, 0, 30), evento('b', 9, 30, 30)])
    expect(r.every((x) => x.colunas === 1)).toBe(true)
  })

  it('reaproveita a coluna que já vagou', () => {
    // a: 9–11 (coluna 0), b: 9–10 (coluna 1), c: 10–11 cabe de volta na 1.
    const r = distribuirColunas([
      evento('a', 9, 0, 120),
      evento('b', 9, 0, 60),
      evento('c', 10, 0, 60),
    ])
    const porId = Object.fromEntries(r.map((x) => [x.evento.id, x]))
    expect(porId.c.coluna).toBe(1)
    expect(porId.a.colunas).toBe(2)
  })

  it('três simultâneos viram três colunas', () => {
    const r = distribuirColunas([evento('a', 9), evento('b', 9), evento('c', 9)])
    expect(r.every((x) => x.colunas === 3)).toBe(true)
  })

  it('grupos separados não contaminam a largura um do outro', () => {
    const r = distribuirColunas([
      evento('a', 9),
      evento('b', 9), // grupo 1 — dois
      evento('c', 15), // grupo 2 — sozinho
    ])
    const porId = Object.fromEntries(r.map((x) => [x.evento.id, x]))
    expect(porId.a.colunas).toBe(2)
    expect(porId.c.colunas).toBe(1)
  })

  it('não perde nem duplica evento', () => {
    const entrada = [evento('a', 9), evento('b', 9), evento('c', 10), evento('d', 16)]
    const r = distribuirColunas(entrada)
    expect(r).toHaveLength(4)
    expect(new Set(r.map((x) => x.evento.id))).toEqual(new Set(['a', 'b', 'c', 'd']))
  })

  it('a ordem da entrada não muda o resultado', () => {
    const a = distribuirColunas([evento('a', 9), evento('b', 9, 30), evento('c', 10)])
    const b = distribuirColunas([evento('c', 10), evento('a', 9), evento('b', 9, 30)])
    const chave = (r: ReturnType<typeof distribuirColunas>) =>
      r.map((x) => `${x.evento.id}:${x.coluna}/${x.colunas}`).sort()
    expect(chave(a)).toEqual(chave(b))
  })

  it('lista vazia devolve lista vazia', () => {
    expect(distribuirColunas([])).toEqual([])
  })
})

describe('posicionar', () => {
  it('junta as duas coisas', () => {
    const r = posicionar([evento('a', 9), evento('b', 9)], { de: 420, ate: 1140 })
    expect(r).toHaveLength(2)
    expect(r[0].colunas).toBe(2)
    expect(r[0].posicao.altura).toBeGreaterThan(0)
  })
})

describe('linhasDeHora', () => {
  it('marca cada hora cheia, incluindo as pontas', () => {
    expect(linhasDeHora({ de: 420, ate: 600 })).toEqual([420, 480, 540, 600])
  })
})

describe('semana', () => {
  it('começa no domingo', () => {
    // 2026-07-29 é uma quarta-feira.
    const i = inicioDaSemana(new Date(2026, 6, 29))
    expect(i.getDay()).toBe(0)
    expect(i.getDate()).toBe(26)
  })

  it('domingo é o próprio começo', () => {
    const i = inicioDaSemana(new Date(2026, 6, 26))
    expect(i.getDate()).toBe(26)
  })

  it('devolve sete dias em sequência', () => {
    const dias = diasDaSemana(inicioDaSemana(new Date(2026, 6, 29)))
    expect(dias).toHaveLength(7)
    expect(dias.map((d) => d.getDate())).toEqual([26, 27, 28, 29, 30, 31, 1])
  })

  it('atravessa a virada do mês sem repetir dia', () => {
    const dias = diasDaSemana(inicioDaSemana(new Date(2026, 6, 31)))
    expect(dias.map((d) => d.getMonth())).toEqual([6, 6, 6, 6, 6, 6, 7])
  })

  it('o rótulo usa a semana da FAIXA, não a do domingo que abre a grade', () => {
    // A grade começa no domingo, a ISO começa na segunda. O domingo 26/07/2026
    // é da semana 30; os outros seis dias na tela são a 31 — e 31 é o número
    // certo para essa tela. Usar `dias[0]` mostrava a semana anterior o ano
    // inteiro.
    const dias = diasDaSemana(inicioDaSemana(new Date(2026, 6, 29)))
    expect(dias[0].getDate()).toBe(26)
    expect(semanaDoAno(dias[0])).toBe(30)
    expect(semanaExibida(dias)).toBe(31)
  })

  it('na visão de um dia só, a semana é a daquele dia', () => {
    expect(semanaExibida([new Date(2026, 6, 27)])).toBe(31)
  })

  it('numera a semana pela regra ISO', () => {
    // A semana de 27/07/2026 é a 31ª — o mesmo número do cabeçalho do desenho.
    expect(semanaDoAno(new Date(2026, 6, 27))).toBe(31)
  })

  it('a virada do ano segue ISO, não a contagem ingênua', () => {
    // 1º/01/2027 é uma sexta: pela ISO ainda pertence à semana 53 de 2026.
    expect(semanaDoAno(new Date(2027, 0, 1))).toBe(53)
  })
})
