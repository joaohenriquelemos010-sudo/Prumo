import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { cifrar, decifrar, pareceCifrado, verificarIntegridade, _resetChave } from './cripto.js'

const CHAVE_A = 'a'.repeat(64)
const CHAVE_B = 'b'.repeat(64)
const original = process.env.CAMPO_CHAVE

function usarChave(hex: string | undefined) {
  if (hex === undefined) delete process.env.CAMPO_CHAVE
  else process.env.CAMPO_CHAVE = hex
  _resetChave()
}

/**
 * A chave é memoizada na primeira chamada — `_resetChave` existe para estes
 * testes conseguirem trocá-la. `env.CAMPO_CHAVE` lê do `process.env`, então
 * mexer aqui basta.
 */
beforeEach(() => usarChave(CHAVE_A))
afterAll(() => usarChave(original))

describe('cifrar / decifrar', () => {
  it('vai e volta', () => {
    const cpf = '529.982.247-25'
    const cifrado = cifrar(cpf)
    expect(cifrado).not.toBe(cpf)
    expect(decifrar(cifrado)).toBe(cpf)
  })

  it('o texto cifrado não contém o original em lugar nenhum', () => {
    const cifrado = cifrar('52998224725')
    expect(cifrado).not.toContain('52998224725')
    expect(Buffer.from(cifrado).toString()).not.toContain('52998224725')
  })

  /** IV aleatório: dois CPFs iguais não podem virar o mesmo texto cifrado. */
  it('o mesmo valor cifra diferente a cada vez', () => {
    const a = cifrar('12345678901')
    const b = cifrar('12345678901')
    expect(a).not.toBe(b)
    expect(decifrar(a)).toBe(decifrar(b))
  })

  /**
   * A propriedade que torna a migração segura de rodar duas vezes. Sem ela, um
   * documento salvo de novo empilharia camadas até ninguém conseguir ler.
   */
  it('cifrar um valor já cifrado devolve o mesmo texto', () => {
    const uma = cifrar('12345678901')
    expect(cifrar(uma)).toBe(uma)
    expect(decifrar(cifrar(uma))).toBe('12345678901')
  })

  it('string vazia atravessa sem virar um blob', () => {
    expect(cifrar('')).toBe('')
    expect(decifrar('')).toBe('')
  })

  it('um valor em claro atravessa a decifragem intacto', () => {
    // É assim que documentos gravados antes de a chave existir continuam
    // legíveis enquanto a migração não passa.
    expect(decifrar('529.982.247-25')).toBe('529.982.247-25')
  })

  it('preserva acentos e unicode', () => {
    const v = 'Ção — 日本 🙂'
    expect(decifrar(cifrar(v))).toBe(v)
  })
})

describe('autenticação (o motivo de ser GCM e não CBC)', () => {
  it('adulterar o texto cifrado falha em vez de devolver lixo plausível', () => {
    const partes = cifrar('12345678901').split('.')
    const dados = Buffer.from(partes[3], 'base64')
    dados[0] ^= 0x01
    partes[3] = dados.toString('base64')

    const adulterado = partes.join('.')
    expect(decifrar(adulterado)).toBe('')
    expect(verificarIntegridade(adulterado)).toBe(false)
  })

  it('adulterar a tag de autenticação também falha', () => {
    const partes = cifrar('12345678901').split('.')
    const tag = Buffer.from(partes[2], 'base64')
    tag[0] ^= 0x01
    partes[2] = tag.toString('base64')
    expect(decifrar(partes.join('.'))).toBe('')
  })

  it('a chave errada não abre — e não derruba o processo', () => {
    const cifrado = cifrar('12345678901')
    usarChave(CHAVE_B)
    expect(decifrar(cifrado)).toBe('')
    expect(verificarIntegridade(cifrado)).toBe(false)
  })
})

describe('sem chave configurada', () => {
  it('grava em claro em vez de derrubar o produto', () => {
    usarChave(undefined)
    expect(cifrar('12345678901')).toBe('12345678901')
    expect(decifrar('12345678901')).toBe('12345678901')
  })

  it('um valor cifrado antes é devolvido como está, e não como vazio', () => {
    const cifrado = cifrar('12345678901')
    usarChave(undefined)
    // O dado não se perdeu — só não está acessível. Devolver o blob é mais
    // honesto do que devolver vazio.
    expect(decifrar(cifrado)).toBe(cifrado)
  })
})

describe('chave malformada', () => {
  it('falha alto em vez de gravar em claro silenciosamente', () => {
    usarChave('chave-curta-demais')
    expect(() => cifrar('12345678901')).toThrow(/64 caracteres/)
  })
})

describe('pareceCifrado', () => {
  it('reconhece o formato', () => {
    expect(pareceCifrado(cifrar('12345678901'))).toBe(true)
  })

  it('não confunde texto comum que tem pontos', () => {
    expect(pareceCifrado('529.982.247-25')).toBe(false)
    expect(pareceCifrado('v1.so.tres')).toBe(false)
    expect(pareceCifrado('')).toBe(false)
  })
})
