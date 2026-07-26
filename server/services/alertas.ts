import type { HydratedDocument } from 'mongoose'
import { Alerta } from '../models/Alerta.js'
import type { Severidade } from '../models/Alerta.js'
import type { MedidaFetalDoc } from '../models/MedidaFetal.js'
import type { ConsultaDoc } from '../models/Consulta.js'
import type { CriancaDoc } from '../models/Crianca.js'
import { percentilAproximado } from '../clinico/curvas-fetais.js'
import type { MedidaFetalChave } from '../clinico/curvas-fetais.js'
import { zScore } from '../clinico/curvas-pediatricas.js'
import type { MedidaInfantil, Sexo } from '../clinico/curvas-pediatricas.js'

/**
 * Pattern checking — "está normal para a idade?", answered automatically.
 *
 * Every measurement written is compared to the reference band for its week or
 * month. What falls outside raises an `Alerta` for the clinician, on the spot,
 * instead of waiting for someone to notice a drifting curve two visits later.
 *
 * Two rules hold throughout:
 *  - Alerts are for the doctor by default. Only a couple are gentle enough to
 *    show the family, and those are phrased as "worth mentioning next visit".
 *  - Nothing here is a diagnosis. Each alert carries the threshold that fired it
 *    and its source, so the clinician judges rather than obeys.
 */

const FONTE_FETAL = 'Hadlock (1991) e referências de biometria fetal — FEBRASGO.'
const FONTE_OMS = 'OMS — Padrões de Crescimento Infantil (2006); Caderneta da Criança.'

interface Achado {
  regra: string
  severidade: Severidade
  titulo: string
  detalhe: string
  condutaSugerida: string
  fonte: string
  paraFamilia?: boolean
  mensagemFamilia?: string
}

/** Upserts by (crianca, referenciaId, regra), so re-saving never piles up copies. */
async function registrar(
  criancaId: unknown,
  origem: 'medida-fetal' | 'antropometria',
  referenciaId: string,
  achados: Achado[],
): Promise<void> {
  for (const a of achados) {
    await Alerta.updateOne(
      { crianca: criancaId, referenciaId, regra: a.regra },
      {
        $set: {
          crianca: criancaId,
          origem,
          referenciaId,
          regra: a.regra,
          severidade: a.severidade,
          titulo: a.titulo,
          detalhe: a.detalhe,
          condutaSugerida: a.condutaSugerida,
          fonte: a.fonte,
          paraFamilia: a.paraFamilia ?? false,
          mensagemFamilia: a.mensagemFamilia ?? '',
        },
      },
      { upsert: true },
    )
  }

  // A measurement that came back into range should stop shouting: clear the
  // rules that no longer fire for this same source document.
  const regrasAtivas = achados.map((a) => a.regra)
  await Alerta.deleteMany({
    crianca: criancaId,
    referenciaId,
    regra: { $nin: regrasAtivas },
    resolvido: false,
  })
}

/* ----------------------------- fetal biometry ---------------------------- */

/** Recomputes percentiles, stores them, and raises what falls outside the band. */
export async function avaliarMedidaFetal(
  medida: HydratedDocument<MedidaFetalDoc>,
): Promise<void> {
  const semana = medida.semana
  const chaves: MedidaFetalChave[] = ['pfeG', 'ccMm', 'caMm', 'cfMm', 'dbpMm']

  const percentis: Record<string, number | null> = {}
  for (const chave of chaves) {
    const valor = medida[chave]
    percentis[chave] = typeof valor === 'number' && valor > 0 ? percentilAproximado(chave, semana, valor) : null
  }
  medida.percentis = percentis as typeof medida.percentis
  await medida.save()

  const achados: Achado[] = []
  const pfe = percentis.pfeG
  const cc = percentis.ccMm
  const ca = percentis.caMm

  if (pfe != null && pfe < 3) {
    achados.push({
      regra: 'pfe-abaixo-p3',
      severidade: 'urgente',
      titulo: `Peso fetal estimado abaixo do percentil 3 (${semana} semanas)`,
      detalhe: `O PFE está no percentil ${pfe} para ${semana} semanas — abaixo do P3.`,
      condutaSugerida:
        'Avaliar restrição de crescimento fetal: Doppler de artéria umbilical e cerebral média, revisão da idade gestacional e reavaliação em curto intervalo.',
      fonte: FONTE_FETAL,
    })
  } else if (pfe != null && pfe < 10) {
    achados.push({
      regra: 'pfe-abaixo-p10',
      severidade: 'atencao',
      titulo: `Peso fetal estimado abaixo do percentil 10 (${semana} semanas)`,
      detalhe: `O PFE está no percentil ${pfe} para ${semana} semanas.`,
      condutaSugerida:
        'Considerar feto pequeno para a idade gestacional. Confirmar a datação, avaliar Doppler e acompanhar o crescimento em intervalo mais curto.',
      fonte: FONTE_FETAL,
      paraFamilia: true,
      mensagemFamilia:
        'Sua obstetra vai querer acompanhar o crescimento do bebê mais de perto nas próximas semanas. Vale conversar sobre isso na próxima consulta.',
    })
  } else if (pfe != null && pfe > 97) {
    achados.push({
      regra: 'pfe-acima-p97',
      severidade: 'atencao',
      titulo: `Peso fetal estimado acima do percentil 97 (${semana} semanas)`,
      detalhe: `O PFE está no percentil ${pfe} para ${semana} semanas.`,
      condutaSugerida:
        'Investigar macrossomia: rastreio de diabetes gestacional, revisão da datação e planejamento da via de parto.',
      fonte: FONTE_FETAL,
    })
  } else if (pfe != null && pfe > 90) {
    achados.push({
      regra: 'pfe-acima-p90',
      severidade: 'info',
      titulo: `Peso fetal estimado acima do percentil 90 (${semana} semanas)`,
      detalhe: `O PFE está no percentil ${pfe} para ${semana} semanas.`,
      condutaSugerida: 'Acompanhar a curva e revisar o rastreio de diabetes gestacional.',
      fonte: FONTE_FETAL,
    })
  }

  if (cc != null && cc < 3) {
    achados.push({
      regra: 'cc-abaixo-p3',
      severidade: 'urgente',
      titulo: `Circunferência cefálica abaixo do percentil 3 (${semana} semanas)`,
      detalhe: `A CC está no percentil ${cc} para ${semana} semanas.`,
      condutaSugerida:
        'Investigar microcefalia: avaliação morfológica detalhada, rastreio de infecções congênitas e reavaliação seriada.',
      fonte: FONTE_FETAL,
    })
  } else if (cc != null && cc > 97) {
    achados.push({
      regra: 'cc-acima-p97',
      severidade: 'atencao',
      titulo: `Circunferência cefálica acima do percentil 97 (${semana} semanas)`,
      detalhe: `A CC está no percentil ${cc} para ${semana} semanas.`,
      condutaSugerida: 'Avaliar macrocefalia e ventriculomegalia na morfológica.',
      fonte: FONTE_FETAL,
    })
  }

  if (ca != null && ca < 3) {
    achados.push({
      regra: 'ca-abaixo-p3',
      severidade: 'atencao',
      titulo: `Circunferência abdominal abaixo do percentil 3 (${semana} semanas)`,
      detalhe: `A CA está no percentil ${ca} para ${semana} semanas — o parâmetro que mais cedo sinaliza restrição.`,
      condutaSugerida: 'Avaliar restrição de crescimento e função placentária.',
      fonte: FONTE_FETAL,
    })
  }

  const ila = medida.ilaCm
  if (typeof ila === 'number' && ila > 0) {
    if (ila < 5) {
      achados.push({
        regra: 'oligoamnio',
        severidade: 'urgente',
        titulo: 'Índice de líquido amniótico reduzido',
        detalhe: `ILA de ${ila} cm — abaixo de 5 cm caracteriza oligoâmnio.`,
        condutaSugerida:
          'Investigar causa (rotura de membranas, insuficiência placentária), avaliar vitalidade fetal e definir conduta.',
        fonte: FONTE_FETAL,
      })
    } else if (ila > 24) {
      achados.push({
        regra: 'polidramnio',
        severidade: 'atencao',
        titulo: 'Índice de líquido amniótico aumentado',
        detalhe: `ILA de ${ila} cm — acima de 24 cm caracteriza polidrâmnio.`,
        condutaSugerida:
          'Investigar diabetes gestacional, malformações e infecções congênitas.',
        fonte: FONTE_FETAL,
      })
    }
  }

  await registrar(medida.crianca, 'medida-fetal', String(medida._id), achados)
}

/* --------------------------- child anthropometry -------------------------- */

/** Age in whole months at the consultation date. */
function idadeEmMeses(nascimento: Date, quando: Date): number {
  const anos = quando.getFullYear() - nascimento.getFullYear()
  const meses = quando.getMonth() - nascimento.getMonth()
  const total = anos * 12 + meses
  return quando.getDate() < nascimento.getDate() ? total - 1 : total
}

const ROTULO: Record<MedidaInfantil, string> = {
  pesoKg: 'Peso',
  comprimentoCm: 'Comprimento',
  perimetroCefalicoCm: 'Perímetro cefálico',
}

const CONDUTA: Record<MedidaInfantil, { baixo: string; alto: string }> = {
  pesoKg: {
    baixo: 'Avaliar aleitamento e ingestão, investigar causas de baixo ganho e reavaliar em intervalo curto.',
    alto: 'Avaliar padrão alimentar e orientar sobre ganho de peso acelerado.',
  },
  comprimentoCm: {
    baixo: 'Avaliar velocidade de crescimento, estado nutricional e alvo genético.',
    alto: 'Comparar com o alvo genético; em geral, variação constitucional.',
  },
  perimetroCefalicoCm: {
    baixo: 'Investigar microcefalia: avaliar o desenvolvimento neuropsicomotor e considerar propedêutica complementar.',
    alto: 'Investigar macrocefalia: avaliar sinais de hipertensão intracraniana e o perímetro cefálico dos pais.',
  },
}

/**
 * The paediatric counterpart — "is this head size normal for the age?", which is
 * exactly the question a growth chart answers and a busy visit skips.
 */
export async function avaliarAntropometria(
  consulta: HydratedDocument<ConsultaDoc>,
  crianca: HydratedDocument<CriancaDoc>,
): Promise<void> {
  if (consulta.tipo !== 'pediatrica') return
  if (!crianca.dataNascimento) return

  const meses = idadeEmMeses(new Date(crianca.dataNascimento), new Date(consulta.data))
  if (meses < 0 || meses > 24) return

  // The journey does not record the child's sex, and guessing would be worse than
  // a slightly wider band: evaluate against both and only alert when BOTH agree
  // the value is out of range.
  const sexos: Sexo[] = ['F', 'M']
  const m = consulta.medidas ?? {}
  const valores: Partial<Record<MedidaInfantil, number>> = {
    pesoKg: typeof m.pesoKg === 'number' && m.pesoKg > 0 ? m.pesoKg : undefined,
    comprimentoCm:
      typeof m.comprimentoCm === 'number' && m.comprimentoCm > 0 ? m.comprimentoCm : undefined,
    perimetroCefalicoCm:
      typeof m.perimetroCefalicoCm === 'number' && m.perimetroCefalicoCm > 0
        ? m.perimetroCefalicoCm
        : undefined,
  }

  const achados: Achado[] = []

  for (const chave of Object.keys(valores) as MedidaInfantil[]) {
    const valor = valores[chave]
    if (valor === undefined) continue

    const zs = sexos
      .map((s) => zScore(chave, s, meses, valor))
      .filter((z): z is number => z !== null)
    if (zs.length === 0) continue

    const menor = Math.min(...zs)
    const maior = Math.max(...zs)

    if (maior < -2) {
      achados.push({
        regra: `${chave}-z-baixo`,
        severidade: maior < -3 ? 'urgente' : 'atencao',
        titulo: `${ROTULO[chave]} abaixo do esperado para ${meses} ${meses === 1 ? 'mês' : 'meses'}`,
        detalhe: `Escore-z ${maior.toFixed(1)} — abaixo de −2 desvios da mediana da OMS.`,
        condutaSugerida: CONDUTA[chave].baixo,
        fonte: FONTE_OMS,
      })
    } else if (menor > 2) {
      achados.push({
        regra: `${chave}-z-alto`,
        severidade: menor > 3 ? 'atencao' : 'info',
        titulo: `${ROTULO[chave]} acima do esperado para ${meses} ${meses === 1 ? 'mês' : 'meses'}`,
        detalhe: `Escore-z ${menor.toFixed(1)} — acima de +2 desvios da mediana da OMS.`,
        condutaSugerida: CONDUTA[chave].alto,
        fonte: FONTE_OMS,
      })
    }
  }

  await registrar(crianca._id, 'antropometria', String(consulta._id), achados)
}
