/**
 * Brazilian document validation (server copy — mirrors src/lib/br-docs.ts).
 * The server never trusts the client, so it re-validates CPF/CRM here.
 */

export const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] as const

export function somenteDigitos(value: string): string {
  return value.replace(/\D/g, '')
}

export function validarCPF(input: string): boolean {
  const cpf = somenteDigitos(input)
  if (cpf.length !== 11) return false
  if (/^(\d)\1{10}$/.test(cpf)) return false

  const calcDigito = (base: string, pesoInicial: number): number => {
    let soma = 0
    for (let i = 0; i < base.length; i += 1) {
      soma += Number(base[i]) * (pesoInicial - i)
    }
    const resto = (soma * 10) % 11
    return resto === 10 ? 0 : resto
  }

  const d1 = calcDigito(cpf.slice(0, 9), 10)
  if (d1 !== Number(cpf[9])) return false
  const d2 = calcDigito(cpf.slice(0, 10), 11)
  return d2 === Number(cpf[10])
}

export function validarCRM(numero: string, uf: string): boolean {
  const digits = somenteDigitos(numero)
  if (digits.length < 4 || digits.length > 6) return false
  return (UFS as readonly string[]).includes(uf)
}

/**
 * Telefone brasileiro: DDD válido + 8 dígitos (fixo) ou 9 dígitos (celular).
 * O nono dígito começa com 9 em todo o país desde 2016 — é o que separa um
 * número real de um dígito digitado a mais.
 */
export function validarTelefone(input: string): boolean {
  const digitos = somenteDigitos(input)
  if (digitos.length !== 10 && digitos.length !== 11) return false
  const ddd = Number(digitos.slice(0, 2))
  if (ddd < 11 || ddd > 99) return false
  if (digitos.length === 11) return digitos[2] === '9'
  return Number(digitos[2]) > 1
}

/**
 * Idade em anos completos. `null` quando a string não é uma data — um `NaN`
 * silencioso passaria por qualquer comparação numérica como se fosse "não".
 */
export function idadeEm(nascimentoISO: string, referencia = new Date()): number | null {
  if (!nascimentoISO) return null
  const nascimento = new Date(nascimentoISO.includes('T') ? nascimentoISO : `${nascimentoISO}T00:00:00`)
  if (Number.isNaN(nascimento.getTime())) return null
  let anos = referencia.getFullYear() - nascimento.getFullYear()
  const meses = referencia.getMonth() - nascimento.getMonth()
  if (meses < 0 || (meses === 0 && referencia.getDate() < nascimento.getDate())) anos -= 1
  return anos
}
