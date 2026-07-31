import { Router } from 'express'
import type { HydratedDocument } from 'mongoose'
import { requireAuth, requireRole } from '../auth.js'
import { resolveCrianca, resolveCriancaOr403 } from '../services/acesso.js'
import { MedidaFetal } from '../models/MedidaFetal.js'
import type { MedidaFetalDoc } from '../models/MedidaFetal.js'
import { Alerta } from '../models/Alerta.js'
import { medidaFetalSchema, checkinSchema } from '../validation.js'
import { normalizeField } from '../sanitize.js'
import { avaliarMedidaFetal } from '../services/alertas.js'
import { curvaPfe, ROTULO_MEDIDA, UNIDADE_MEDIDA } from '../clinico/curvas-fetais.js'
import {
  curvasInfantis,
  faseDaJornada,
  idadeEmMeses,
  serieInfantil,
  serieBatimentos,
} from '../services/crescimento.js'

export const bebeRouter = Router()

/**
 * Fetal measurements and the family's weekly check-in.
 *
 * The obstetrician writes the biometry; the family reads a warm version of it and
 * logs their own note for the week. The split is enforced here, in `serialize`:
 * `notasPrivadas` never leaves for a non-clinical reader.
 */
function ehEquipe(papel: string): boolean {
  return papel === 'medico'
}

function serialize(m: HydratedDocument<MedidaFetalDoc>, papel: string) {
  const equipe = ehEquipe(papel)
  return {
    id: String(m._id),
    semana: m.semana,
    data: new Date(m.data).toISOString(),
    autorNome: m.autorNome,
    dbpMm: m.dbpMm,
    ccMm: m.ccMm,
    caMm: m.caMm,
    cfMm: m.cfMm,
    pfeG: m.pfeG,
    ilaCm: m.ilaCm,
    apresentacao: m.apresentacao,
    placenta: m.placenta,
    observacao: m.observacao,
    // Percentiles are a clinical reading, not a family one. "P1" is the number
    // that frightens, and the family's chart doesn't need it — position on the
    // curve comes from the value plus the reference band. Don't ship what the
    // screen must not show.
    ...(equipe ? { percentis: m.percentis ?? {}, notasPrivadas: m.notasPrivadas } : {}),
  }
}

/**
 * GET /api/bebe — everything the growth screen needs in one round trip.
 *
 * The journey has two halves and this route answers for both. Before birth it is
 * fetal biometry against the Hadlock band; after birth it is the child's weight,
 * length and head circumference against the WHO curves, built from the
 * consultations the pediatrician already records plus the birth summary as month
 * zero. `fase` tells the client which story to tell.
 */
bebeRouter.get('/', requireAuth, async (req, res) => {
  const crianca = await resolveCriancaOr403(req, res)
  if (!crianca) return
  const papel = req.user!.papel
  const fase = faseDaJornada(crianca)

  const [medidas, alertas, infantis, batimentos] = await Promise.all([
    MedidaFetal.find({ crianca: crianca._id }).sort({ semana: 1 }),
    Alerta.find({
      crianca: crianca._id,
      resolvido: false,
      ...(ehEquipe(papel) ? {} : { paraFamilia: true }),
    }).sort({ createdAt: -1 }),
    fase === 'pos-natal' ? serieInfantil(crianca) : Promise.resolve([]),
    fase === 'gestacao' ? serieBatimentos(crianca) : Promise.resolve([]),
  ])

  res.json({
    fase,
    idadeMeses: fase === 'pos-natal' ? idadeEmMeses(crianca) : null,
    medidas: medidas.map((m) => serialize(m, papel)),
    // The reference band travels with the data so the client draws exactly what
    // the alerts were computed against.
    curva: curvaPfe(),
    rotulos: ROTULO_MEDIDA,
    unidades: UNIDADE_MEDIDA,
    // Same contract on the postnatal side: percentiles are a clinical reading.
    medidasInfantis: infantis.map((p) => ({
      meses: p.meses,
      data: p.data,
      pesoKg: p.pesoKg,
      comprimentoCm: p.comprimentoCm,
      perimetroCefalicoCm: p.perimetroCefalicoCm,
      origem: p.origem,
      autorNome: p.autorNome,
      ...(ehEquipe(papel) ? { percentis: p.percentis } : {}),
    })),
    curvasInfantis: fase === 'pos-natal' ? curvasInfantis() : null,
    /**
     * Não é leitura clínica reservada: um batimento por consulta é exatamente o
     * que a gestante quer rever, e a faixa de normalidade (110–160) viaja junto
     * no cliente para que o número chegue com o contexto que o torna tranquilo
     * em vez de assustador.
     */
    batimentos,
    checkins: (crianca.checkins ?? []).map((c) => ({
      // `semana` is the legacy key from when this page only covered pregnancy.
      periodo: c.periodo ?? c.semana,
      fase: c.fase || 'gestacao',
      em: new Date(c.em).toISOString(),
      notaFamilia: c.notaFamilia,
    })),
    alertas: alertas.map((a) => ({
      id: String(a._id),
      severidade: a.severidade,
      // The family gets the gentle sentence; the clinician gets the finding.
      titulo: ehEquipe(papel) ? a.titulo : 'Vale conversar na próxima consulta',
      detalhe: ehEquipe(papel) ? a.detalhe : a.mensagemFamilia,
      condutaSugerida: ehEquipe(papel) ? a.condutaSugerida : '',
      fonte: ehEquipe(papel) ? a.fonte : '',
      origem: a.origem,
      criadoEm: a.createdAt.toISOString(),
    })),
  })
})

/**
 * PUT /api/bebe/medidas — the obstetrician records a week.
 * Upserts by week: a re-measure corrects the record instead of duplicating it.
 */
bebeRouter.put('/medidas', requireAuth, requireRole('medico'), async (req, res) => {
  const parsed = medidaFetalSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Confere as medidas.' })
    return
  }
  const crianca = await resolveCriancaOr403(req, res)
  if (!crianca) return
  const d = parsed.data

  const medida = await MedidaFetal.findOneAndUpdate(
    { crianca: crianca._id, semana: d.semana },
    {
      $set: {
        crianca: crianca._id,
        semana: d.semana,
        data: d.data ? new Date(d.data) : new Date(),
        autorId: req.user!.id,
        autorNome: req.user!.nome,
        autorPapel: req.user!.papel,
        dbpMm: d.dbpMm ?? null,
        ccMm: d.ccMm ?? null,
        caMm: d.caMm ?? null,
        cfMm: d.cfMm ?? null,
        pfeG: d.pfeG ?? null,
        ilaCm: d.ilaCm ?? null,
        apresentacao: d.apresentacao ?? 'indefinida',
        placenta: normalizeField(d.placenta ?? '', 120),
        observacao: normalizeField(d.observacao ?? '', 500),
        notasPrivadas: normalizeField(d.notasPrivadas ?? '', 1000),
      },
    },
    { upsert: true, new: true },
  )

  await avaliarMedidaFetal(medida)
  res.json({ medida: serialize(medida, req.user!.papel) })
})

/**
 * POST /api/bebe/checkin — the family's ritual, weekly in pregnancy and monthly
 * after birth. Not clinical data: a note, and the streak that makes coming back
 * feel good.
 */
bebeRouter.post('/checkin', requireAuth, async (req, res) => {
  const parsed = checkinSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Confere os dados.' })
    return
  }
  const crianca = await resolveCriancaOr403(req, res)
  if (!crianca) return
  const { periodo, fase, notaFamilia } = parsed.data

  // Keyed by (fase, periodo): week 20 of the pregnancy is not month 20 of the child.
  const existente = (crianca.checkins ?? []).find(
    (c) => (c.periodo ?? c.semana) === periodo && (c.fase || 'gestacao') === fase,
  )
  if (existente) {
    existente.em = new Date()
    existente.notaFamilia = normalizeField(notaFamilia ?? '', 500)
  } else {
    crianca.checkins.push({
      fase,
      periodo,
      semana: null,
      em: new Date(),
      notaFamilia: normalizeField(notaFamilia ?? '', 500),
    })
  }
  await crianca.save()

  res.status(201).json({
    checkins: crianca.checkins.map((c) => ({
      periodo: c.periodo ?? c.semana,
      fase: c.fase || 'gestacao',
      em: new Date(c.em).toISOString(),
      notaFamilia: c.notaFamilia,
    })),
  })
})

/** PATCH /api/bebe/alertas/:id — the clinician closes a finding. */
bebeRouter.patch('/alertas/:id', requireAuth, requireRole('medico'), async (req, res) => {
  const alerta = await Alerta.findById(req.params.id).catch(() => null)
  if (!alerta) {
    res.status(404).json({ error: 'Não encontramos esse alerta.' })
    return
  }
  // Same scoping as everything else clinical: reachable only through the journey.
  const crianca = await resolveCrianca(req.user!, String(alerta.crianca))
  if (!crianca) {
    res.status(403).json({ error: 'Você não tem acesso a esse alerta.' })
    return
  }

  alerta.resolvido = true
  alerta.resolvidoPor = req.user!.id
  alerta.resolvidoEm = new Date()
  await alerta.save()
  res.json({ ok: true })
})
