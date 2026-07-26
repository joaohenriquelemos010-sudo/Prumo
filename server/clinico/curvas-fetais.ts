/**
 * Fetal biometry reference ranges by gestational week.
 *
 * Estimated fetal weight follows Hadlock (1991), the curve Brazilian obstetric
 * practice reads by default; the head, abdomen and femur bands follow the same
 * body of reference data. Values are rounded to the precision a report actually
 * shows — this drives "is this within the expected band?", not a research paper.
 *
 * Lives server-side on purpose: the API returns the bands alongside the
 * measurements, so the browser renders what it is given and there is one source
 * of clinical truth rather than two that can drift.
 */

export interface FaixaPercentil {
  p3: number
  p10: number
  p50: number
  p90: number
  p97: number
}

export type MedidaFetalChave = 'pfeG' | 'ccMm' | 'caMm' | 'cfMm' | 'dbpMm'

type TabelaPorSemana = Record<number, FaixaPercentil>

/** Peso fetal estimado, em gramas (Hadlock). */
const PFE_G: TabelaPorSemana = {
  14: { p3: 70, p10: 77, p50: 93, p90: 109, p97: 117 },
  15: { p3: 88, p10: 97, p50: 117, p90: 137, p97: 147 },
  16: { p3: 110, p10: 121, p50: 146, p90: 171, p97: 183 },
  17: { p3: 136, p10: 150, p50: 181, p90: 212, p97: 227 },
  18: { p3: 167, p10: 185, p50: 223, p90: 261, p97: 280 },
  19: { p3: 205, p10: 227, p50: 273, p90: 319, p97: 342 },
  20: { p3: 248, p10: 275, p50: 331, p90: 387, p97: 415 },
  21: { p3: 299, p10: 331, p50: 399, p90: 467, p97: 500 },
  22: { p3: 359, p10: 398, p50: 478, p90: 559, p97: 599 },
  23: { p3: 426, p10: 471, p50: 568, p90: 665, p97: 712 },
  24: { p3: 503, p10: 556, p50: 670, p90: 784, p97: 840 },
  25: { p3: 589, p10: 652, p50: 785, p90: 918, p97: 984 },
  26: { p3: 685, p10: 758, p50: 913, p90: 1068, p97: 1145 },
  27: { p3: 791, p10: 876, p50: 1055, p90: 1234, p97: 1323 },
  28: { p3: 908, p10: 1004, p50: 1210, p90: 1416, p97: 1518 },
  29: { p3: 1034, p10: 1145, p50: 1379, p90: 1613, p97: 1729 },
  30: { p3: 1169, p10: 1294, p50: 1559, p90: 1824, p97: 1955 },
  31: { p3: 1313, p10: 1453, p50: 1751, p90: 2049, p97: 2196 },
  32: { p3: 1465, p10: 1621, p50: 1953, p90: 2285, p97: 2449 },
  33: { p3: 1622, p10: 1794, p50: 2162, p90: 2530, p97: 2712 },
  34: { p3: 1783, p10: 1973, p50: 2377, p90: 2781, p97: 2981 },
  35: { p3: 1946, p10: 2154, p50: 2595, p90: 3036, p97: 3254 },
  36: { p3: 2110, p10: 2335, p50: 2813, p90: 3291, p97: 3528 },
  37: { p3: 2271, p10: 2513, p50: 3028, p90: 3543, p97: 3798 },
  38: { p3: 2427, p10: 2686, p50: 3236, p90: 3786, p97: 4058 },
  39: { p3: 2576, p10: 2851, p50: 3435, p90: 4019, p97: 4308 },
  40: { p3: 2714, p10: 3004, p50: 3619, p90: 4234, p97: 4539 },
}

/** Circunferência cefálica, em milímetros. */
const CC_MM: TabelaPorSemana = {
  14: { p3: 91, p10: 95, p50: 103, p90: 111, p97: 115 },
  16: { p3: 118, p10: 123, p50: 133, p90: 143, p97: 148 },
  18: { p3: 145, p10: 151, p50: 163, p90: 175, p97: 181 },
  20: { p3: 168, p10: 175, p50: 189, p90: 203, p97: 210 },
  22: { p3: 192, p10: 200, p50: 216, p90: 232, p97: 240 },
  24: { p3: 214, p10: 223, p50: 241, p90: 259, p97: 268 },
  26: { p3: 236, p10: 246, p50: 266, p90: 286, p97: 296 },
  28: { p3: 256, p10: 267, p50: 288, p90: 309, p97: 320 },
  30: { p3: 274, p10: 286, p50: 309, p90: 332, p97: 344 },
  32: { p3: 289, p10: 301, p50: 325, p90: 349, p97: 361 },
  34: { p3: 303, p10: 316, p50: 341, p90: 366, p97: 379 },
  36: { p3: 314, p10: 327, p50: 353, p90: 379, p97: 392 },
  38: { p3: 323, p10: 337, p50: 364, p90: 391, p97: 404 },
  40: { p3: 330, p10: 344, p50: 371, p90: 398, p97: 412 },
}

/** Circunferência abdominal, em milímetros. */
const CA_MM: TabelaPorSemana = {
  14: { p3: 72, p10: 76, p50: 85, p90: 94, p97: 98 },
  16: { p3: 94, p10: 99, p50: 110, p90: 121, p97: 126 },
  18: { p3: 116, p10: 122, p50: 135, p90: 148, p97: 154 },
  20: { p3: 138, p10: 145, p50: 160, p90: 175, p97: 182 },
  22: { p3: 160, p10: 168, p50: 185, p90: 202, p97: 210 },
  24: { p3: 182, p10: 191, p50: 210, p90: 229, p97: 238 },
  26: { p3: 204, p10: 214, p50: 235, p90: 256, p97: 266 },
  28: { p3: 226, p10: 237, p50: 260, p90: 283, p97: 294 },
  30: { p3: 248, p10: 260, p50: 285, p90: 310, p97: 322 },
  32: { p3: 269, p10: 282, p50: 309, p90: 336, p97: 349 },
  34: { p3: 290, p10: 304, p50: 333, p90: 362, p97: 376 },
  36: { p3: 310, p10: 325, p50: 356, p90: 387, p97: 402 },
  38: { p3: 330, p10: 346, p50: 379, p90: 412, p97: 428 },
  40: { p3: 348, p10: 365, p50: 400, p90: 435, p97: 452 },
}

/** Comprimento do fêmur, em milímetros. */
const CF_MM: TabelaPorSemana = {
  14: { p3: 12, p10: 13, p50: 15, p90: 17, p97: 18 },
  16: { p3: 18, p10: 19, p50: 21, p90: 23, p97: 24 },
  18: { p3: 24, p10: 25, p50: 27, p90: 29, p97: 31 },
  20: { p3: 29, p10: 30, p50: 33, p90: 36, p97: 37 },
  22: { p3: 34, p10: 36, p50: 39, p90: 42, p97: 44 },
  24: { p3: 40, p10: 41, p50: 45, p90: 49, p97: 50 },
  26: { p3: 45, p10: 46, p50: 50, p90: 54, p97: 56 },
  28: { p3: 49, p10: 51, p50: 55, p90: 59, p97: 61 },
  30: { p3: 54, p10: 56, p50: 60, p90: 64, p97: 67 },
  32: { p3: 58, p10: 60, p50: 65, p90: 70, p97: 72 },
  34: { p3: 62, p10: 64, p50: 69, p90: 74, p97: 77 },
  36: { p3: 66, p10: 68, p50: 73, p90: 78, p97: 81 },
  38: { p3: 69, p10: 71, p50: 76, p90: 81, p97: 84 },
  40: { p3: 72, p10: 74, p50: 79, p90: 84, p97: 87 },
}

/** Diâmetro biparietal, em milímetros. */
const DBP_MM: TabelaPorSemana = {
  14: { p3: 25, p10: 26, p50: 28, p90: 30, p97: 31 },
  16: { p3: 32, p10: 33, p50: 36, p90: 39, p97: 40 },
  18: { p3: 39, p10: 41, p50: 44, p90: 47, p97: 49 },
  20: { p3: 45, p10: 47, p50: 51, p90: 55, p97: 57 },
  22: { p3: 52, p10: 54, p50: 58, p90: 62, p97: 64 },
  24: { p3: 58, p10: 60, p50: 65, p90: 70, p97: 72 },
  26: { p3: 64, p10: 66, p50: 71, p90: 76, p97: 79 },
  28: { p3: 70, p10: 72, p50: 78, p90: 84, p97: 87 },
  30: { p3: 75, p10: 78, p50: 84, p90: 90, p97: 93 },
  32: { p3: 80, p10: 83, p50: 89, p90: 95, p97: 99 },
  34: { p3: 84, p10: 87, p50: 94, p90: 101, p97: 104 },
  36: { p3: 88, p10: 91, p50: 98, p90: 105, p97: 109 },
  38: { p3: 91, p10: 94, p50: 101, p90: 108, p97: 112 },
  40: { p3: 93, p10: 97, p50: 104, p90: 111, p97: 115 },
}

const TABELAS: Record<MedidaFetalChave, TabelaPorSemana> = {
  pfeG: PFE_G,
  ccMm: CC_MM,
  caMm: CA_MM,
  cfMm: CF_MM,
  dbpMm: DBP_MM,
}

export const ROTULO_MEDIDA: Record<MedidaFetalChave, string> = {
  pfeG: 'Peso fetal estimado',
  ccMm: 'Circunferência cefálica',
  caMm: 'Circunferência abdominal',
  cfMm: 'Comprimento do fêmur',
  dbpMm: 'Diâmetro biparietal',
}

export const UNIDADE_MEDIDA: Record<MedidaFetalChave, string> = {
  pfeG: 'g',
  ccMm: 'mm',
  caMm: 'mm',
  cfMm: 'mm',
  dbpMm: 'mm',
}

/**
 * The band for a given week, interpolating between the tabulated weeks so an
 * odd week between two even ones still gets a sensible reference instead of none.
 */
export function faixaPara(chave: MedidaFetalChave, semana: number): FaixaPercentil | null {
  const tabela = TABELAS[chave]
  const semanas = Object.keys(tabela)
    .map(Number)
    .sort((a, b) => a - b)
  if (semanas.length === 0) return null

  const min = semanas[0]
  const max = semanas[semanas.length - 1]
  if (semana < min || semana > max) return null
  if (tabela[semana]) return tabela[semana]

  const antes = [...semanas].reverse().find((s) => s < semana)!
  const depois = semanas.find((s) => s > semana)!
  const t = (semana - antes) / (depois - antes)
  const a = tabela[antes]
  const b = tabela[depois]
  const entre = (x: number, y: number) => Math.round(x + (y - x) * t)

  return {
    p3: entre(a.p3, b.p3),
    p10: entre(a.p10, b.p10),
    p50: entre(a.p50, b.p50),
    p90: entre(a.p90, b.p90),
    p97: entre(a.p97, b.p97),
  }
}

/**
 * Approximate percentile for a value, by piecewise interpolation across the five
 * tabulated points. Clamped to 1–99: the tables don't resolve the tails, and
 * printing "P0.4" would imply a precision that isn't there.
 */
export function percentilAproximado(chave: MedidaFetalChave, semana: number, valor: number): number | null {
  const faixa = faixaPara(chave, semana)
  if (!faixa) return null

  const pontos: [number, number][] = [
    [faixa.p3, 3],
    [faixa.p10, 10],
    [faixa.p50, 50],
    [faixa.p90, 90],
    [faixa.p97, 97],
  ]

  if (valor <= pontos[0][0]) return 1
  if (valor >= pontos[pontos.length - 1][0]) return 99

  for (let i = 0; i < pontos.length - 1; i++) {
    const [v1, p1] = pontos[i]
    const [v2, p2] = pontos[i + 1]
    if (valor >= v1 && valor <= v2) {
      const t = v2 === v1 ? 0 : (valor - v1) / (v2 - v1)
      return Math.round(p1 + (p2 - p1) * t)
    }
  }
  return null
}

/** Every band for a week — what the API ships so the client can draw the chart. */
export function faixasDaSemana(semana: number): Partial<Record<MedidaFetalChave, FaixaPercentil>> {
  const saida: Partial<Record<MedidaFetalChave, FaixaPercentil>> = {}
  for (const chave of Object.keys(TABELAS) as MedidaFetalChave[]) {
    const faixa = faixaPara(chave, semana)
    if (faixa) saida[chave] = faixa
  }
  return saida
}

/** The whole PFE curve, for plotting the band behind the baby's points. */
export function curvaPfe(): { semana: number; faixa: FaixaPercentil }[] {
  return Object.keys(PFE_G)
    .map(Number)
    .sort((a, b) => a - b)
    .map((semana) => ({ semana, faixa: PFE_G[semana] }))
}
