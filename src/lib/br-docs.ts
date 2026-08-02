/**
 * Brazilian document validation (client copy — mirrors server/br-docs.ts).
 *
 * CPF uses the real check-digit algorithm. CRM has no national checksum, so we
 * validate the shape (4–6 digits) plus a valid UF. Real CRM verification requires
 * an official council integration; here it stays "pending" until that exists.
 */

export const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] as const

export type UF = (typeof UFS)[number]

export function somenteDigitos(value: string): string {
  return value.replace(/\D/g, '')
}

/** Validates a CPF via its two check digits. Rejects all-equal sequences. */
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

export function formatarCPF(input: string): string {
  const cpf = somenteDigitos(input).slice(0, 11)
  return cpf
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
}

/** CRM: 4–6 digits + a valid UF. Not an official verification. */
export function validarCRM(numero: string, uf: string): boolean {
  const digits = somenteDigitos(numero)
  if (digits.length < 4 || digits.length > 6) return false
  return (UFS as readonly string[]).includes(uf)
}

/**
 * Telefone brasileiro: DDD válido + 8 dígitos (fixo) ou 9 dígitos (celular).
 *
 * O nono dígito não é enfeite — desde 2016 todo celular do país começa com 9
 * depois do DDD, e é essa regra que separa um número real de um dígito a mais
 * digitado sem querer. DDD começa em 11: abaixo disso não existe.
 */
export function validarTelefone(input: string): boolean {
  const digitos = somenteDigitos(input)
  if (digitos.length !== 10 && digitos.length !== 11) return false
  const ddd = Number(digitos.slice(0, 2))
  if (ddd < 11 || ddd > 99) return false
  if (digitos.length === 11) return digitos[2] === '9'
  // Fixo (8 dígitos) nunca começa com 0 nem com 1.
  return Number(digitos[2]) > 1
}

/** `(11) 91234-5678` — formata durante a digitação, aceitando estados parciais. */
export function formatarTelefone(input: string): string {
  const digitos = somenteDigitos(input).slice(0, 11)
  if (digitos.length === 0) return ''
  if (digitos.length <= 2) return `(${digitos}`
  const ddd = digitos.slice(0, 2)
  const resto = digitos.slice(2)
  if (resto.length <= 4) return `(${ddd}) ${resto}`
  // 9 dígitos quebram em 5+4; 8 dígitos, em 4+4.
  const corte = resto.length > 8 ? 5 : 4
  return `(${ddd}) ${resto.slice(0, corte)}-${resto.slice(corte)}`
}

/**
 * Idade em anos completos na data de referência.
 *
 * Devolve `null` quando a string não é uma data: quem chama precisa distinguir
 * "ainda não preencheu" de "preencheu uma data impossível", e um `NaN` silencioso
 * passaria por qualquer comparação numérica como se fosse "não". Aceita tanto
 * `YYYY-MM-DD` (o que `<input type="date">` devolve) quanto ISO completo.
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

/** `YYYY-MM-DD` de hoje no fuso local — para o `max` dos campos de data. */
export function hojeISO(referencia = new Date()): string {
  const local = new Date(referencia.getTime() - referencia.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
}
