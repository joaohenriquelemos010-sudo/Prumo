/**
 * Força de senha — o medidor que aparece embaixo do campo no cadastro.
 *
 * Duas coisas diferentes vivem aqui de propósito:
 *
 * - `senhaAceitavel` é a **regra**, e é a mesma que o servidor aplica em
 *   `registerSchema` (8+ caracteres, com letra e número). Regra é binária: ou a
 *   senha entra, ou não entra.
 * - `forcaSenha` é o **conselho**. Ele nunca bloqueia nada. Um medidor que
 *   reprova é só mais uma parede entre a pessoa e a conta dela; um medidor que
 *   informa deixa ela decidir com o que sabe.
 *
 * Não há verificação de vazamento aqui (HIBP k-anonymity seria o caminho): isso
 * é uma chamada de rede no meio da digitação, e pertence ao servidor.
 */

export type NivelSenha = 0 | 1 | 2 | 3 | 4

export interface ForcaSenha {
  /** 0 (vazia) a 4 (forte). Alimenta o medidor de 4 barrinhas. */
  nivel: NivelSenha
  rotulo: string
  /** A dica mais útil no estado atual — uma só, nunca uma lista de cobranças. */
  dica: string
}

const TEM_LETRA = /\p{L}/u
const TEM_NUMERO = /\d/
const TEM_MAIUSCULA = /\p{Lu}/u
const TEM_MINUSCULA = /\p{Ll}/u
const TEM_SIMBOLO = /[^\p{L}\d\s]/u

/** A regra que o servidor também aplica. Mantenha as duas juntas se mudar. */
export function senhaAceitavel(senha: string): boolean {
  return senha.length >= 8 && TEM_LETRA.test(senha) && TEM_NUMERO.test(senha)
}

export function forcaSenha(senha: string): ForcaSenha {
  if (!senha) return { nivel: 0, rotulo: 'Sua senha', dica: 'Pelo menos 8 caracteres, com letra e número.' }

  let pontos = 0
  if (senha.length >= 8) pontos += 1
  if (senha.length >= 12) pontos += 1
  if (TEM_LETRA.test(senha) && TEM_NUMERO.test(senha)) pontos += 1
  if (TEM_MAIUSCULA.test(senha) && TEM_MINUSCULA.test(senha)) pontos += 1
  if (TEM_SIMBOLO.test(senha)) pontos += 1

  const nivel = Math.min(4, pontos) as NivelSenha

  return { nivel, rotulo: ROTULOS[nivel], dica: dicaPara(senha) }
}

const ROTULOS: Record<NivelSenha, string> = {
  0: 'Muito fraca',
  1: 'Fraca',
  2: 'Razoável',
  3: 'Boa',
  4: 'Forte',
}

/**
 * Uma dica por vez, na ordem em que elas destravam a senha: primeiro o que
 * impede o cadastro, depois o que só a melhora.
 */
function dicaPara(senha: string): string {
  if (senha.length < 8) return `Faltam ${8 - senha.length} caractere${8 - senha.length === 1 ? '' : 's'}.`
  if (!TEM_LETRA.test(senha)) return 'Inclua ao menos uma letra.'
  if (!TEM_NUMERO.test(senha)) return 'Inclua ao menos um número.'
  if (senha.length < 12) return 'Senhas mais longas são bem mais difíceis de quebrar.'
  if (!TEM_SIMBOLO.test(senha)) return 'Um símbolo (!, ?, #) deixa ainda mais segura.'
  return 'Essa senha protege bem sua conta.'
}
