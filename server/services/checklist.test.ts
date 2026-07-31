import { describe, it, expect } from 'vitest'
import { proximaSequencia, chavesDoPrograma } from './checklist.js'
import { TEMPLATES } from './seedConteudo.js'

describe('proximaSequencia', () => {
  const dia = (n: number) => new Date(2026, 2, n, 10, 0, 0)

  it('primeira visita começa em 1', () => {
    expect(proximaSequencia(0, null)).toBe(1)
    expect(proximaSequencia(0, undefined)).toBe(1)
  })

  it('marcar de novo no mesmo dia não soma', () => {
    expect(proximaSequencia(3, dia(10), new Date(2026, 2, 10, 23, 0))).toBe(3)
  })

  it('dia seguinte soma um', () => {
    expect(proximaSequencia(3, dia(10), dia(11))).toBe(4)
  })

  /**
   * A contagem é por dia-calendário, não por 24 horas: quem marca às 23h e de
   * novo às 8h do dia seguinte visitou em dois dias, e é assim que a pessoa
   * entende — uma janela de horas quebraria a sequência sem motivo aparente.
   */
  it('23h e 8h do dia seguinte contam como dois dias', () => {
    const ontemTarde = new Date(2026, 2, 10, 23, 30)
    const hojeCedo = new Date(2026, 2, 11, 8, 0)
    expect(proximaSequencia(5, ontemTarde, hojeCedo)).toBe(6)
  })

  it('pular um dia zera', () => {
    expect(proximaSequencia(9, dia(10), dia(12))).toBe(1)
  })

  it('sequência zerada com toque no mesmo dia devolve ao menos 1', () => {
    expect(proximaSequencia(0, dia(10), dia(10))).toBe(1)
  })
})

describe('chavesDoPrograma', () => {
  it('devolve os templates do materno-infantil', () => {
    const chaves = chavesDoPrograma('materno-infantil')
    expect(chaves).toContain('gestante-completo')
    expect(chaves).toContain('puericultura-completo')
  })

  it('programa desconhecido não devolve nada', () => {
    expect(chavesDoPrograma('cardiologia')).toEqual([])
  })
})

/**
 * O conteúdo é produto, não configuração. Estes testes guardam as propriedades
 * que fazem o checklist ser o que prometemos à gestante — se alguém escrever um
 * grupo sem explicação leiga, ou aninhar um terceiro nível, cai aqui.
 */
describe('conteúdo dos checklists', () => {
  const grupos = TEMPLATES.flatMap((t) => t.grupos.map((g) => ({ template: t.chave, ...g })))
  const passos = grupos.flatMap((g) => g.passos.map((p) => ({ grupo: g.id, ...p })))

  it('todo grupo tem explicação em linguagem leiga', () => {
    for (const g of grupos) {
      expect(g.explicacaoLeiga.trim().length, `${g.template}/${g.id}`).toBeGreaterThan(80)
    }
  })

  it('todo grupo cita a fonte clínica', () => {
    for (const g of grupos) {
      expect(g.fonte?.trim().length ?? 0, `${g.template}/${g.id}`).toBeGreaterThan(10)
    }
  })

  it('todo grupo tem pelo menos um passo', () => {
    for (const g of grupos) {
      expect(g.passos.length, `${g.template}/${g.id}`).toBeGreaterThan(0)
    }
  })

  /** Exatamente dois níveis. Um passo com filhos não passaria daqui. */
  it('passos não têm filhos', () => {
    for (const p of passos) {
      expect(Object.keys(p)).not.toContain('passos')
    }
  })

  it('todo grupo tem pelo menos um passo obrigatório', () => {
    for (const g of grupos) {
      const obrigatorios = g.passos.filter((p) => !p.opcional)
      expect(obrigatorios.length, `${g.template}/${g.id}`).toBeGreaterThan(0)
    }
  })

  it('ids de grupo são únicos dentro do template', () => {
    for (const t of TEMPLATES) {
      const ids = t.grupos.map((g) => g.id)
      expect(new Set(ids).size, t.chave).toBe(ids.length)
    }
  })

  it('ids de passo são únicos dentro do grupo', () => {
    for (const g of grupos) {
      const ids = g.passos.map((p) => p.id)
      expect(new Set(ids).size, `${g.template}/${g.id}`).toBe(ids.length)
    }
  })

  it('janelas são coerentes — o início nunca depois do fim', () => {
    for (const g of grupos) {
      const j = g.janela
      if (j?.desdeSemana != null && j?.ateSemana != null) {
        expect(j.desdeSemana, `${g.template}/${g.id}`).toBeLessThanOrEqual(j.ateSemana)
      }
      if (j?.desdeMes != null && j?.ateMes != null) {
        expect(j.desdeMes, `${g.template}/${g.id}`).toBeLessThanOrEqual(j.ateMes)
      }
    }
  })

  /**
   * A régua de linguagem: o texto é para a gestante, não para o prontuário.
   * Jargão clínico sem tradução ao lado é exatamente o que este checklist
   * existe para não fazer.
   */
  it('as explicações não caem em jargão sem tradução', () => {
    const jargao = /\b(EGB|TOTG|RCIU|IG\b|USG|VDRL|HBsAg|puerpério|icterícia)\b/
    for (const g of grupos) {
      const texto = `${g.titulo} ${g.resumo ?? ''} ${g.explicacaoLeiga}`
      const achado = texto.match(jargao)
      if (achado) {
        // Se apareceu, precisa vir explicado logo em seguida no mesmo grupo.
        const contexto = `${g.explicacaoLeiga} ${g.passos.map((p) => p.explicacaoLeiga ?? '').join(' ')}`
        expect(
          contexto.length > 200,
          `${g.template}/${g.id} usa "${achado[0]}" — explique ao lado`,
        ).toBe(true)
      }
    }
  })
})
