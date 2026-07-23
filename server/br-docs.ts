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
