import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from 'node:crypto'
import { env } from '../env.js'

/**
 * Criptografia de campo — AES-256-GCM, para o punhado de campos que valem
 * dinheiro no mercado paralelo mesmo isolados do resto: CPF e número de
 * carteirinha.
 *
 * ## Por que GCM e não CBC
 *
 * GCM é autenticado: adulterar o texto cifrado faz a decifragem **falhar** em
 * vez de devolver lixo plausível. Num campo que alimenta cobrança e
 * identificação, um byte trocado sem ninguém perceber é pior do que um erro.
 *
 * ## O formato
 *
 * `v1.<iv-base64>.<tag-base64>.<cifrado-base64>`
 *
 * O prefixo de versão não é enfeite: é o que permite trocar o algoritmo depois
 * sem adivinhar o que está gravado. E o formato ser reconhecível é o que torna
 * a migração idempotente — cifrar duas vezes é impossível, porque `cifrar()`
 * reconhece o que já está cifrado e devolve como está.
 *
 * ## O que esta camada NÃO resolve
 *
 * Ela protege contra vazamento de **dump de banco** e contra quem lê a coleção
 * sem passar pela aplicação. Não protege contra a aplicação comprometida — o
 * servidor precisa decifrar para usar, então quem executa código no servidor lê
 * tudo. É a proteção certa para a ameaça certa, e vale dizer isso em voz alta
 * em vez de deixar a criptografia dar uma sensação maior do que a garantia.
 */

const VERSAO = 'v1'
const ALGORITMO = 'aes-256-gcm'

let chaveCache: Buffer | null | undefined

/** A chave, ou `null` quando não configurada. Avisa **uma vez**. */
function chave(): Buffer | null {
  if (chaveCache !== undefined) return chaveCache

  /**
   * Lido do `process.env` a cada resolução, e não uma vez no import do `env`.
   * As duas fontes concordam no boot (`env.CAMPO_CHAVE` é justamente esse
   * valor); a indireção existe para que os testes consigam exercitar chave
   * ausente, chave errada e chave malformada no mesmo processo. Em produção o
   * valor não muda depois do boot.
   */
  const bruta = (process.env.CAMPO_CHAVE ?? env.CAMPO_CHAVE).trim()
  if (!bruta) {
    console.warn(
      '[cripto] CAMPO_CHAVE ausente: CPF e carteirinha serão gravados em claro. ' +
        'Defina a variável para ligar a criptografia de campo.',
    )
    chaveCache = null
    return null
  }

  if (!/^[0-9a-fA-F]{64}$/.test(bruta)) {
    // Chave malformada é erro de configuração, não motivo para gravar em claro
    // sem ninguém saber. Falha alto, e no boot.
    throw new Error('CAMPO_CHAVE deve ser hexadecimal de 64 caracteres (32 bytes).')
  }

  chaveCache = Buffer.from(bruta, 'hex')
  return chaveCache
}

/** Só para os testes: esquece a chave memoizada. */
export function _resetChave(): void {
  chaveCache = undefined
}

export function pareceCifrado(valor: string): boolean {
  return (
    typeof valor === 'string' && valor.startsWith(`${VERSAO}.`) && valor.split('.').length === 4
  )
}

/**
 * Cifra. Sem chave configurada, devolve o valor como está — o produto continua
 * funcionando e a lacuna já foi avisada no boot.
 */
export function cifrar(valor: string): string {
  if (!valor) return valor
  // Idempotente: reprocessar um campo já cifrado (migração que roda duas vezes,
  // documento salvo de novo) não pode empilhar camadas.
  if (pareceCifrado(valor)) return valor

  const k = chave()
  if (!k) return valor

  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGORITMO, k, iv)
  const cifrado = Buffer.concat([cipher.update(valor, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()

  return [VERSAO, iv.toString('base64'), tag.toString('base64'), cifrado.toString('base64')].join(
    '.',
  )
}

/**
 * Decifra. Um valor que não está no formato volta como está — é assim que
 * documentos antigos, gravados antes de a chave existir, continuam legíveis
 * enquanto a migração não passa.
 */
export function decifrar(valor: string): string {
  if (!valor || !pareceCifrado(valor)) return valor

  const k = chave()
  if (!k) return valor

  try {
    const [, ivB64, tagB64, dadosB64] = valor.split('.')
    const decipher = createDecipheriv(ALGORITMO, k, Buffer.from(ivB64, 'base64'))
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'))
    return Buffer.concat([
      decipher.update(Buffer.from(dadosB64, 'base64')),
      decipher.final(),
    ]).toString('utf8')
  } catch {
    /**
     * Chegou aqui por adulteração ou por chave trocada. Devolve string vazia em
     * vez de lançar: uma listagem de pacientes não pode virar 500 porque um
     * campo opcional não abriu. Quem precisa distinguir os dois casos usa
     * `verificarIntegridade`.
     */
    return ''
  }
}

/** Este texto cifrado abre com a chave atual? Usado por diagnóstico. */
export function verificarIntegridade(valor: string): boolean {
  if (!pareceCifrado(valor)) return true
  return decifrar(valor) !== ''
}

/** Comparação em tempo constante, para segredos curtos fora do bcrypt. */
export function comparaSegredo(a: string, b: string): boolean {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ba.length !== bb.length) return false
  return timingSafeEqual(ba, bb)
}

/** Getter/setter do Mongoose, para aplicar num caminho do schema. */
export const campoCifrado = {
  set: (v: string) => cifrar(v ?? ''),
  get: (v: string) => decifrar(v ?? ''),
}
