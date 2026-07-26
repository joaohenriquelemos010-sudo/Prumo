/**
 * WHO child growth standards, 0–24 months, as LMS parameters.
 *
 * Source: World Health Organization Child Growth Standards (2006), the reference
 * the Caderneta da Criança is built on. LMS lets one small table answer any
 * measurement: z = ((value/M)^L − 1) / (L·S).
 *
 * Tabulated every other month and interpolated in between — enough resolution to
 * answer "is this within the expected band?", which is what the alerts need.
 * Sexes differ meaningfully, so both are carried.
 */

export interface LMS {
  l: number
  m: number
  s: number
}

export type Sexo = 'F' | 'M'
export type MedidaInfantil = 'pesoKg' | 'comprimentoCm' | 'perimetroCefalicoCm'

type TabelaLMS = Record<number, LMS>

/** Peso para idade — meninos (kg). */
const PESO_M: TabelaLMS = {
  0: { l: 0.3487, m: 3.3464, s: 0.14602 },
  2: { l: 0.2297, m: 5.5675, s: 0.13395 },
  4: { l: 0.1738, m: 7.0023, s: 0.12988 },
  6: { l: 0.1553, m: 7.934, s: 0.12712 },
  9: { l: 0.1477, m: 8.9014, s: 0.12409 },
  12: { l: 0.1395, m: 9.6479, s: 0.12237 },
  18: { l: 0.1188, m: 10.9385, s: 0.12081 },
  24: { l: 0.0903, m: 12.1515, s: 0.12112 },
}

/** Peso para idade — meninas (kg). */
const PESO_F: TabelaLMS = {
  0: { l: 0.3809, m: 3.2322, s: 0.14171 },
  2: { l: 0.197, m: 5.1282, s: 0.13724 },
  4: { l: 0.1738, m: 6.4237, s: 0.13 },
  6: { l: 0.1553, m: 7.297, s: 0.12619 },
  9: { l: 0.1477, m: 8.2254, s: 0.12376 },
  12: { l: 0.1395, m: 8.9481, s: 0.12274 },
  18: { l: 0.1188, m: 10.2315, s: 0.12379 },
  24: { l: 0.0903, m: 11.4775, s: 0.1258 },
}

/** Comprimento para idade — meninos (cm). */
const COMPRIMENTO_M: TabelaLMS = {
  0: { l: 1, m: 49.8842, s: 0.03795 },
  2: { l: 1, m: 58.4249, s: 0.03471 },
  4: { l: 1, m: 63.886, s: 0.03395 },
  6: { l: 1, m: 67.6236, s: 0.03395 },
  9: { l: 1, m: 72.2496, s: 0.0342 },
  12: { l: 1, m: 75.7488, s: 0.03456 },
  18: { l: 1, m: 82.2587, s: 0.0355 },
  24: { l: 1, m: 87.1161, s: 0.03694 },
}

/** Comprimento para idade — meninas (cm). */
const COMPRIMENTO_F: TabelaLMS = {
  0: { l: 1, m: 49.1477, s: 0.0379 },
  2: { l: 1, m: 57.0673, s: 0.03636 },
  4: { l: 1, m: 62.0899, s: 0.03568 },
  6: { l: 1, m: 65.7311, s: 0.036 },
  9: { l: 1, m: 70.1435, s: 0.03649 },
  12: { l: 1, m: 74.0155, s: 0.03721 },
  18: { l: 1, m: 80.7079, s: 0.0384 },
  24: { l: 1, m: 85.7153, s: 0.0398 },
}

/** Perímetro cefálico para idade — meninos (cm). */
const PC_M: TabelaLMS = {
  0: { l: 1, m: 34.4618, s: 0.03686 },
  2: { l: 1, m: 39.1349, s: 0.03 },
  4: { l: 1, m: 41.3301, s: 0.02871 },
  6: { l: 1, m: 43.3306, s: 0.02812 },
  9: { l: 1, m: 45.0334, s: 0.02784 },
  12: { l: 1, m: 46.0561, s: 0.02786 },
  18: { l: 1, m: 47.4377, s: 0.028 },
  24: { l: 1, m: 48.2891, s: 0.02818 },
}

/** Perímetro cefálico para idade — meninas (cm). */
const PC_F: TabelaLMS = {
  0: { l: 1, m: 33.8787, s: 0.03496 },
  2: { l: 1, m: 38.2521, s: 0.03028 },
  4: { l: 1, m: 40.2842, s: 0.02912 },
  6: { l: 1, m: 42.1995, s: 0.02867 },
  9: { l: 1, m: 43.8944, s: 0.02852 },
  12: { l: 1, m: 44.8884, s: 0.02862 },
  18: { l: 1, m: 46.2521, s: 0.02887 },
  24: { l: 1, m: 47.1583, s: 0.02912 },
}

const TABELAS: Record<MedidaInfantil, Record<Sexo, TabelaLMS>> = {
  pesoKg: { M: PESO_M, F: PESO_F },
  comprimentoCm: { M: COMPRIMENTO_M, F: COMPRIMENTO_F },
  perimetroCefalicoCm: { M: PC_M, F: PC_F },
}

export const ROTULO_INFANTIL: Record<MedidaInfantil, string> = {
  pesoKg: 'Peso',
  comprimentoCm: 'Comprimento',
  perimetroCefalicoCm: 'Perímetro cefálico',
}

function lmsPara(medida: MedidaInfantil, sexo: Sexo, meses: number): LMS | null {
  const tabela = TABELAS[medida][sexo]
  const idades = Object.keys(tabela)
    .map(Number)
    .sort((a, b) => a - b)
  if (meses < idades[0] || meses > idades[idades.length - 1]) return null
  if (tabela[meses]) return tabela[meses]

  const antes = [...idades].reverse().find((i) => i < meses)!
  const depois = idades.find((i) => i > meses)!
  const t = (meses - antes) / (depois - antes)
  const a = tabela[antes]
  const b = tabela[depois]
  return {
    l: a.l + (b.l - a.l) * t,
    m: a.m + (b.m - a.m) * t,
    s: a.s + (b.s - a.s) * t,
  }
}

/** z-score for a measurement. Null when outside the tabulated age range. */
export function zScore(
  medida: MedidaInfantil,
  sexo: Sexo,
  meses: number,
  valor: number,
): number | null {
  const lms = lmsPara(medida, sexo, meses)
  if (!lms || valor <= 0) return null
  const { l, m, s } = lms
  const z = l === 0 ? Math.log(valor / m) / s : (Math.pow(valor / m, l) - 1) / (l * s)
  return Math.round(z * 100) / 100
}

/** Percentile from a z-score, via the normal CDF (Abramowitz & Stegun 26.2.17). */
export function percentilDeZ(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z))
  const d = 0.3989423 * Math.exp((-z * z) / 2)
  let p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))))
  p = z > 0 ? 1 - p : p
  return Math.max(1, Math.min(99, Math.round(p * 100)))
}
