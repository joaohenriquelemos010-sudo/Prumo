import { Router } from 'express'
import type { HydratedDocument } from 'mongoose'
import { requireAuth, requireRole } from '../auth.js'
import { resolveCrianca, resolveCriancaOr403 } from '../services/acesso.js'
import { MedidaFetal } from '../models/MedidaFetal.js'
import type { MedidaFetalDoc } from '../models/MedidaFetal.js'
import { Alerta } from '../models/Alerta.js'
import { medidaFetalSchema, checkinSemanalSchema } from '../validation.js'
import { normalizeField } from '../sanitize.js'
import { avaliarMedidaFetal } from '../services/alertas.js'
import { curvaPfe, ROTULO_MEDIDA, UNIDADE_MEDIDA } from '../clinico/curvas-fetais.js'

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
 * GET /api/bebe — everything the weekly screen needs in one round trip:
 * the measurements, the reference curve behind them, the check-in streak, and
 * whichever alerts this reader is allowed to see.
 */
bebeRouter.get('/', requireAuth, async (req, res) => {
  const crianca = await resolveCriancaOr403(req, res)
  if (!crianca) return
  const papel = req.user!.papel

  const [medidas, alertas] = await Promise.all([
    MedidaFetal.find({ crianca: crianca._id }).sort({ semana: 1 }),
    Alerta.find({
      crianca: crianca._id,
      resolvido: false,
      ...(ehEquipe(papel) ? {} : { paraFamilia: true }),
    }).sort({ createdAt: -1 }),
  ])

  res.json({
    medidas: medidas.map((m) => serialize(m, papel)),
    // The reference band travels with the data so the client draws exactly what
    // the alerts were computed against.
    curva: curvaPfe(),
    rotulos: ROTULO_MEDIDA,
    unidades: UNIDADE_MEDIDA,
    checkins: (crianca.checkins ?? []).map((c) => ({
      semana: c.semana,
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
 * POST /api/bebe/checkin — the family's weekly ritual.
 * Not clinical data: a note, and the streak that makes coming back feel good.
 */
bebeRouter.post('/checkin', requireAuth, async (req, res) => {
  const parsed = checkinSemanalSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Confere os dados.' })
    return
  }
  const crianca = await resolveCriancaOr403(req, res)
  if (!crianca) return
  const { semana, notaFamilia } = parsed.data

  const existente = (crianca.checkins ?? []).find((c) => c.semana === semana)
  if (existente) {
    existente.em = new Date()
    existente.notaFamilia = normalizeField(notaFamilia ?? '', 500)
  } else {
    crianca.checkins.push({
      semana,
      em: new Date(),
      notaFamilia: normalizeField(notaFamilia ?? '', 500),
    })
  }
  await crianca.save()

  res.status(201).json({
    checkins: crianca.checkins.map((c) => ({
      semana: c.semana,
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
