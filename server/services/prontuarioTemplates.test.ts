import { describe, it, expect } from 'vitest'
import { herdar } from './prontuarioTemplates.js'
import {
  templatePorChave,
  camposDe,
  linhaDoTemplate,
  LINHAS,
  TEMPLATES,
} from '../conteudo/prontuario-templates.js'

/**
 * A regra que faz a segunda consulta não repetir a primeira.
 *
 * Errar aqui tem duas formas, e as duas são ruins de maneiras diferentes:
 * herdar de menos faz o médico redigitar a anamnese (e parar de preencher);
 * herdar demais coloca no registro de hoje uma queixa que a paciente relatou em
 * março — um prontuário assinado dizendo algo que não foi dito.
 */

const marco = new Date('2026-03-01T10:00:00Z')
const junho = new Date('2026-06-01T10:00:00Z')

describe('herdar', () => {
  const retorno = templatePorChave('pre-natal-retorno')

  it('traz um campo permanente respondido na primeira consulta', () => {
    const r = herdar(retorno, [
      { estruturado: { tipoSanguineo: 'O+' }, template: 'pre-natal-primeira', em: marco },
    ])
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ campoId: 'tipoSanguineo', valor: 'O+' })
  })

  it('NÃO traz campo não-permanente — queixa de março não é queixa de hoje', () => {
    // `queixasIniciais` existe na anamnese e não é permanente. Pré-preenchê-lo
    // faria o médico assinar que a paciente relatou hoje o que relatou antes.
    const r = herdar(retorno, [
      { estruturado: { queixasIniciais: 'náuseas' }, template: 'pre-natal-primeira', em: marco },
    ])
    expect(r).toHaveLength(0)
  })

  it('não herda o que o formulário de hoje já pergunta', () => {
    // `dum` é permanente na anamnese, mas o retorno ginecológico pergunta de
    // novo — e deve, porque muda. Mostrar como "já respondido" ao lado do campo
    // que pede a mesma coisa é a receita da resposta desatualizada.
    const ginecoRetorno = templatePorChave('ginecologia-retorno')
    const perguntadosHoje = camposDe(ginecoRetorno).map((c) => c.id)
    expect(perguntadosHoje).toContain('dum')

    const r = herdar(ginecoRetorno, [
      { estruturado: { dum: '2026-02-10' }, template: 'ginecologia-primeira', em: marco },
    ])
    expect(r.find((x) => x.campoId === 'dum')).toBeUndefined()
  })

  it('a resposta mais recente ganha', () => {
    const r = herdar(retorno, [
      { estruturado: { tipoSanguineo: 'A+' }, template: 'pre-natal-primeira', em: marco },
      { estruturado: { tipoSanguineo: 'O-' }, template: 'pre-natal-retorno', em: junho },
    ])
    expect(r).toHaveLength(1)
    expect(r[0].valor).toBe('O-')
  })

  it('ignora a ordem em que as consultas chegam — ordena por data', () => {
    const ordemA = herdar(retorno, [
      { estruturado: { tipoSanguineo: 'A+' }, template: '', em: marco },
      { estruturado: { tipoSanguineo: 'O-' }, template: '', em: junho },
    ])
    const ordemB = herdar(retorno, [
      { estruturado: { tipoSanguineo: 'O-' }, template: '', em: junho },
      { estruturado: { tipoSanguineo: 'A+' }, template: '', em: marco },
    ])
    expect(ordemA).toEqual(ordemB)
  })

  it('pula valores vazios e cai na consulta anterior', () => {
    const r = herdar(retorno, [
      { estruturado: { tipoSanguineo: 'O+' }, template: '', em: marco },
      { estruturado: { tipoSanguineo: '   ' }, template: '', em: junho },
    ])
    expect(r).toHaveLength(1)
    expect(r[0].valor).toBe('O+')
  })

  it('converte booleano em Sim/Não — nunca mostra "true" para um médico', () => {
    const comBooleano = herdar(retorno, [
      { estruturado: { cirurgias: true }, template: '', em: marco },
    ])
    expect(comBooleano[0]?.valor).toBe('Sim')
  })

  it('preserva número zero, que é resposta e não ausência', () => {
    // "0 abortos" é um dado clínico. Tratar 0 como vazio apagaria a resposta.
    const r = herdar(retorno, [{ estruturado: { abortos: 0 }, template: '', em: marco }])
    expect(r).toHaveLength(1)
    expect(r[0].valor).toBe('0')
  })

  it('ignora chave órfã — campo removido de uma versão para outra', () => {
    const r = herdar(retorno, [
      { estruturado: { campoQueNaoExisteMais: 'x' }, template: '', em: marco },
    ])
    expect(r).toHaveLength(0)
  })

  it('sem consultas anteriores, não herda nada', () => {
    expect(herdar(retorno, [])).toEqual([])
  })

  it('carrega a data — "isto foi dito há 8 meses" muda como se lê', () => {
    const r = herdar(retorno, [
      { estruturado: { tipoSanguineo: 'O+' }, template: '', em: marco },
    ])
    expect(r[0].em).toBe(marco.toISOString())
  })
})

describe('catálogo de templates', () => {
  it('toda linha de cuidado aponta para templates que existem', () => {
    for (const l of LINHAS) {
      expect(templatePorChave(l.primeira).chave, l.id).toBe(l.primeira)
      expect(templatePorChave(l.retorno).chave, l.id).toBe(l.retorno)
    }
  })

  it('a primeira é `primeira` e o retorno é `retorno`', () => {
    for (const l of LINHAS) {
      expect(templatePorChave(l.primeira).natureza).toBe('primeira')
      expect(templatePorChave(l.retorno).natureza).toBe('retorno')
    }
  })

  it('chave desconhecida cai no SOAP livre em vez de quebrar o atendimento', () => {
    expect(templatePorChave('nao-existe').chave).toBe('soap-generico')
    expect(templatePorChave(null).chave).toBe('soap-generico')
  })

  it('nenhum id de campo se repete dentro do mesmo template', () => {
    // Ids repetidos fariam dois campos gravarem na mesma chave — o segundo
    // apagaria o primeiro em silêncio, dentro do prontuário.
    for (const t of TEMPLATES) {
      const ids = camposDe(t).map((c) => c.id)
      expect(new Set(ids).size, `${t.chave} tem id repetido`).toBe(ids.length)
    }
  })

  it('um mesmo id de campo significa a mesma coisa em todos os templates', () => {
    // A herança é por id, entre templates. Se `dum` fosse "última menstruação"
    // num e "data do ultrassom" noutro, o retorno mostraria o valor errado com
    // o rótulo certo.
    const porId = new Map<string, string>()
    for (const t of TEMPLATES) {
      for (const c of camposDe(t)) {
        const visto = porId.get(c.id)
        if (visto) expect(c.rotulo, `campo ${c.id} em ${t.chave}`).toBe(visto)
        else porId.set(c.id, c.rotulo)
      }
    }
  })

  it('um campo permanente é permanente em todo lugar', () => {
    const permanencia = new Map<string, boolean>()
    for (const t of TEMPLATES) {
      for (const c of camposDe(t)) {
        const visto = permanencia.get(c.id)
        if (visto !== undefined) {
          expect(Boolean(c.permanente), `campo ${c.id} em ${t.chave}`).toBe(visto)
        } else {
          permanencia.set(c.id, Boolean(c.permanente))
        }
      }
    }
  })

  it('campo de seleção sempre tem opções', () => {
    for (const t of TEMPLATES) {
      for (const c of camposDe(t)) {
        if (c.tipo === 'selecao') {
          expect((c.opcoes ?? []).length, `${t.chave}/${c.id}`).toBeGreaterThan(0)
        }
      }
    }
  })

  it('linhaDoTemplate acha a linha pelos dois lados', () => {
    expect(linhaDoTemplate('pre-natal-primeira')?.id).toBe('pre-natal')
    expect(linhaDoTemplate('pre-natal-retorno')?.id).toBe('pre-natal')
    expect(linhaDoTemplate('soap-generico')).toBeNull()
  })
})
