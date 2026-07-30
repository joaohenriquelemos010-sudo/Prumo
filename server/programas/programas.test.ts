import { describe, it, expect } from 'vitest'
import { REGISTRO, PROGRAMA_PADRAO, programaPorId, faseAtiva } from './index.js'
import { REGISTRO as REGISTRO_CLIENTE } from '../../src/features/programas/index.js'

/**
 * O descritor de programa vive duas vezes — uma no servidor, uma no cliente —
 * porque compartilhar através do split de tsconfig custaria mais do que copiar.
 * Este arquivo é o que torna a cópia segura: se os dois deixarem de concordar,
 * o teste falha antes de a divergência virar bug.
 */
describe('registro de programas', () => {
  it('servidor e cliente têm os mesmos programas', () => {
    expect(Object.keys(REGISTRO).sort()).toEqual(Object.keys(REGISTRO_CLIENTE).sort())
  })

  it.each(Object.keys(REGISTRO))('%s tem a mesma forma nos dois lados', (id) => {
    const servidor = REGISTRO[id]!
    const cliente = REGISTRO_CLIENTE[id]!

    expect(cliente.rotulo).toBe(servidor.rotulo)
    expect(cliente.especialidades).toEqual(servidor.especialidades)
    expect(cliente.vocabulario).toEqual(servidor.vocabulario)
    expect(cliente.templatesProntuario).toEqual(servidor.templatesProntuario)
    expect(cliente.templatesChecklist).toEqual(servidor.templatesChecklist)
    expect(cliente.medidas).toEqual(servidor.medidas)
    expect(cliente.curvas).toBe(servidor.curvas)
    expect(cliente.painel).toEqual(servidor.painel)

    // As fases do cliente não carregam o predicado, só a identidade.
    expect(cliente.fases.map((f) => f.id)).toEqual(servidor.fases.map((f) => f.id))
    expect(cliente.fases.map((f) => f.rotulo)).toEqual(servidor.fases.map((f) => f.rotulo))
  })

  it('id desconhecido cai no padrão em vez de quebrar', () => {
    expect(programaPorId('cardiologia-que-ainda-nao-existe').id).toBe(PROGRAMA_PADRAO)
    expect(programaPorId(undefined).id).toBe(PROGRAMA_PADRAO)
    expect(programaPorId(null).id).toBe(PROGRAMA_PADRAO)
  })
})

describe('fases do materno-infantil', () => {
  const programa = programaPorId('materno-infantil')

  it.each([
    ['planejando', 'planejando'],
    ['gestante', 'gestacao'],
    ['ja-nasceu', 'pos-natal'],
  ])('momento %s ativa a fase %s', (momento, faseEsperada) => {
    expect(faseAtiva(programa, { momento })?.id).toBe(faseEsperada)
  })

  it('momento desconhecido não ativa fase nenhuma', () => {
    expect(faseAtiva(programa, { momento: 'outra-coisa' })).toBeNull()
  })
})
