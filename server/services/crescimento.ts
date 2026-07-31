import type { HydratedDocument } from 'mongoose'
import { Consulta } from '../models/Consulta.js'
import { Prontuario } from '../models/Prontuario.js'
import type { CriancaDoc } from '../models/Crianca.js'
import { curvaInfantil, percentilDeZ, zScore } from '../clinico/curvas-pediatricas.js'
import type { MedidaInfantil, Sexo } from '../clinico/curvas-pediatricas.js'

/**
 * The child's growth after birth.
 *
 * Nothing new is written for this: the numbers already exist in the consultations
 * the pediatrician records, plus the birth summary as the month-zero point. This
 * service just gathers them into a series the growth chart can draw — the same
 * job `curvas-fetais` does for the pregnancy, on the other side of the birth.
 */

export type FaseJornada = 'planejando' | 'gestacao' | 'pos-natal'

/** Which half of the journey the page should show. */
export function faseDaJornada(crianca: HydratedDocument<CriancaDoc>): FaseJornada {
  if (crianca.momento === 'ja-nasceu' || crianca.dataNascimento) return 'pos-natal'
  if (crianca.momento === 'gestante' || crianca.dpp) return 'gestacao'
  return 'planejando'
}

export interface PontoInfantil {
  meses: number
  data: string
  pesoKg: number | null
  comprimentoCm: number | null
  perimetroCefalicoCm: number | null
  /** Where the measurement came from, so the family knows who wrote it. */
  origem: 'nascimento' | 'consulta'
  autorNome: string
  /** Clinical reading — only serialised for staff. */
  percentis: Partial<Record<MedidaInfantil, number | null>>
}

/** Whole months between two dates. */
function mesesEntre(nascimento: Date, quando: Date): number {
  const anos = quando.getFullYear() - nascimento.getFullYear()
  const meses = anos * 12 + (quando.getMonth() - nascimento.getMonth())
  return Math.max(0, quando.getDate() < nascimento.getDate() ? meses - 1 : meses)
}

/** Percentile for a measurement, averaged across the two reference curves. */
function percentilMedio(medida: MedidaInfantil, meses: number, valor: number): number | null {
  const sexos: Sexo[] = ['F', 'M']
  const zs = sexos.map((s) => zScore(medida, s, meses, valor)).filter((z): z is number => z !== null)
  if (zs.length === 0) return null
  const media = zs.reduce((a, b) => a + b, 0) / zs.length
  return percentilDeZ(media)
}

/**
 * The child's measurement series, oldest first.
 *
 * Month zero comes from the birth summary when it exists — that is the point the
 * pediatrician anchors the curve to, and it would otherwise be stranded in the
 * prontuário while the chart started at the first visit.
 */
export async function serieInfantil(
  crianca: HydratedDocument<CriancaDoc>,
): Promise<PontoInfantil[]> {
  if (!crianca.dataNascimento) return []
  const nascimento = new Date(crianca.dataNascimento)

  const [consultas, prontuario] = await Promise.all([
    Consulta.find({ crianca: crianca._id, tipo: 'pediatrica' }).sort({ data: 1 }),
    Prontuario.findOne({ crianca: crianca._id }),
  ])

  const pontos: PontoInfantil[] = []

  const nasc = prontuario?.resumoNascimento
  if (nasc?.preenchido) {
    const pesoKg = nasc.pesoNascimentoG ? nasc.pesoNascimentoG / 1000 : null
    pontos.push({
      meses: 0,
      data: nascimento.toISOString(),
      pesoKg,
      comprimentoCm: nasc.comprimentoNascimentoCm ?? null,
      perimetroCefalicoCm: nasc.pcNascimentoCm ?? null,
      origem: 'nascimento',
      autorNome: '',
      percentis: {
        pesoKg: pesoKg ? percentilMedio('pesoKg', 0, pesoKg) : null,
        comprimentoCm: nasc.comprimentoNascimentoCm
          ? percentilMedio('comprimentoCm', 0, nasc.comprimentoNascimentoCm)
          : null,
        perimetroCefalicoCm: nasc.pcNascimentoCm
          ? percentilMedio('perimetroCefalicoCm', 0, nasc.pcNascimentoCm)
          : null,
      },
    })
  }

  for (const c of consultas) {
    const m = c.medidas
    const temAlgo = m?.pesoKg || m?.comprimentoCm || m?.perimetroCefalicoCm
    if (!temAlgo) continue

    const quando = new Date(c.data)
    const meses = mesesEntre(nascimento, quando)
    pontos.push({
      meses,
      data: quando.toISOString(),
      pesoKg: m.pesoKg ?? null,
      comprimentoCm: m.comprimentoCm ?? null,
      perimetroCefalicoCm: m.perimetroCefalicoCm ?? null,
      origem: 'consulta',
      autorNome: c.autorNome,
      percentis: {
        pesoKg: m.pesoKg ? percentilMedio('pesoKg', meses, m.pesoKg) : null,
        comprimentoCm: m.comprimentoCm ? percentilMedio('comprimentoCm', meses, m.comprimentoCm) : null,
        perimetroCefalicoCm: m.perimetroCefalicoCm
          ? percentilMedio('perimetroCefalicoCm', meses, m.perimetroCefalicoCm)
          : null,
      },
    })
  }

  return pontos.sort((a, b) => a.meses - b.meses)
}

/** Reference bands for the three measures the app tracks. */
export function curvasInfantis() {
  return {
    pesoKg: curvaInfantil('pesoKg'),
    comprimentoCm: curvaInfantil('comprimentoCm'),
    perimetroCefalicoCm: curvaInfantil('perimetroCefalicoCm'),
  }
}

/** Age in whole months today — drives the milestones and the check-in period. */
export function idadeEmMeses(crianca: HydratedDocument<CriancaDoc>, agora = new Date()): number {
  if (!crianca.dataNascimento) return 0
  return mesesEntre(new Date(crianca.dataNascimento), agora)
}

/**
 * Os batimentos do bebê, consulta a consulta.
 *
 * `bcfBpm` já é coletado no atendimento e hoje termina numa célula de tabela.
 * É o número que a gestante mais quer ouvir de novo depois da consulta — merece
 * sair daqui como uma série, e não como um dado solto.
 *
 * A semana gestacional vem da DPP, e não da data da consulta relativa ao início
 * da gravidez: é assim que o resto do produto conta, e duas contagens diferentes
 * na mesma tela é como um número passa a não bater com o outro.
 */
export interface PontoBatimento {
  /** Semana gestacional na data da consulta. */
  semana: number
  data: string
  bpm: number
  autorNome: string
}

export async function serieBatimentos(
  crianca: HydratedDocument<CriancaDoc>,
): Promise<PontoBatimento[]> {
  if (!crianca.dpp) return []
  const dpp = new Date(crianca.dpp)

  const consultas = await Consulta.find({
    crianca: crianca._id,
    'medidas.bcfBpm': { $ne: null, $gt: 0 },
  }).sort({ data: 1 })

  return consultas
    .map((c) => {
      const quando = new Date(c.data)
      // 40 semanas na DPP; cada 7 dias antes dela é uma semana a menos.
      const diasAteDpp = Math.round((dpp.getTime() - quando.getTime()) / 86_400_000)
      return {
        semana: Math.max(0, Math.min(42, 40 - Math.floor(diasAteDpp / 7))),
        data: quando.toISOString(),
        bpm: c.medidas!.bcfBpm as number,
        autorNome: c.autorNome,
      }
    })
    .sort((a, b) => a.semana - b.semana)
}
