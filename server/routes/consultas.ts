import { Router } from 'express'
import { isValidObjectId } from 'mongoose'
import { requireAuth, requireRole } from '../auth.js'
import { resolveCriancaOr403 } from '../services/acesso.js'
import { Consulta } from '../models/Consulta.js'
import type { ConsultaDoc } from '../models/Consulta.js'
import type { HydratedDocument } from 'mongoose'
import { consultaCreateSchema } from '../validation.js'
import { normalizeField } from '../sanitize.js'
import { avaliarAntropometria } from '../services/alertas.js'
import type { SessionUser } from '../types.js'

export const consultasRouter = Router()

consultasRouter.param('id', (_req, res, next, id) => {
  if (!isValidObjectId(id)) {
    res.status(404).json({ error: 'Não encontramos essa consulta.' })
    return
  }
  next()
})

/**
 * Whether this reader is clinical staff.
 *
 * The whole visibility split hangs on this one line, so it is deliberately
 * narrow: the role comes from the signed session, never from the request body or
 * a query flag. A family member reading their own record is not staff, and there
 * is no parameter they can send to become one.
 */
function ehEquipe(user: SessionUser): boolean {
  return user.papel === 'medico'
}

function serialize(c: HydratedDocument<ConsultaDoc>, user: SessionUser) {
  const equipe = ehEquipe(user)
  const escondeAvaliacao = Boolean(c.avaliacaoPrivada) && !equipe

  return {
    id: String(c._id),
    autorId: c.autorId,
    autorNome: c.autorNome,
    data: new Date(c.data).toISOString(),
    tipo: c.tipo,
    subjetivo: c.subjetivo,
    objetivo: c.objetivo,
    avaliacao: escondeAvaliacao ? '' : c.avaliacao,
    /** Lets the UI explain the gap instead of leaving a silent blank. */
    avaliacaoOculta: escondeAvaliacao,
    plano: c.plano,
    igSemanas: c.igSemanas,
    igDias: c.igDias,
    medidas: c.medidas ?? {},
    checklist: c.checklist ?? [],
    // Only ever leaves the server for clinical staff.
    ...(equipe ? { notasPrivadas: c.notasPrivadas, avaliacaoPrivada: c.avaliacaoPrivada } : {}),
    peso: c.peso,
    altura: c.altura,
    pressao: c.pressao,
  }
}

// GET /api/consultas — the current patient's consultations, newest first.
consultasRouter.get('/', requireAuth, async (req, res) => {
  const crianca = await resolveCriancaOr403(req, res)
  if (!crianca) return
  const consultas = await Consulta.find({ crianca: crianca._id }).sort({ data: -1 })
  res.json({ consultas: consultas.map((c) => serialize(c, req.user!)) })
})

// POST /api/consultas — only doctors record consultations.
consultasRouter.post('/', requireAuth, requireRole('medico'), async (req, res) => {
  const parsed = consultaCreateSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Confere os dados.' })
    return
  }
  const crianca = await resolveCriancaOr403(req, res)
  if (!crianca) return
  const d = parsed.data
  const m = d.medidas ?? {}

  const consulta = await Consulta.create({
    crianca: crianca._id,
    autorId: req.user!.id,
    autorNome: req.user!.nome,
    tipo: d.tipo,
    data: d.data ? new Date(d.data) : new Date(),
    agendamento: d.agendamentoId && isValidObjectId(d.agendamentoId) ? d.agendamentoId : null,
    subjetivo: normalizeField(d.subjetivo ?? '', 3000),
    objetivo: normalizeField(d.objetivo ?? '', 3000),
    avaliacao: normalizeField(d.avaliacao ?? '', 3000),
    plano: normalizeField(d.plano ?? '', 3000),
    notasPrivadas: normalizeField(d.notasPrivadas ?? '', 3000),
    avaliacaoPrivada: d.avaliacaoPrivada ?? false,
    igSemanas: d.igSemanas ?? null,
    igDias: d.igDias ?? null,
    medidas: m,
    checklist: (d.checklist ?? []).map((i) => ({
      id: i.id,
      feito: i.feito,
      observacao: normalizeField(i.observacao ?? '', 300),
    })),
    // Keep the legacy strings readable alongside the older records.
    peso: m.pesoKg ? `${m.pesoKg} kg` : m.pesoG ? `${m.pesoG} g` : normalizeField(d.peso ?? '', 20),
    altura: m.alturaCm
      ? `${m.alturaCm} cm`
      : m.comprimentoCm
        ? `${m.comprimentoCm} cm`
        : normalizeField(d.altura ?? '', 20),
    pressao:
      m.paSistolica && m.paDiastolica
        ? `${m.paSistolica}/${m.paDiastolica}`
        : normalizeField(d.pressao ?? '', 20),
  })

  // Growth outside the expected band is exactly what a busy clinic misses, so the
  // check runs on write rather than waiting for someone to plot the curve.
  await avaliarAntropometria(consulta, crianca).catch(() => {
    /* an alert failure must never cost the doctor their consultation record */
  })

  res.status(201).json({ consulta: serialize(consulta, req.user!) })
})

// DELETE /api/consultas/:id — author only.
consultasRouter.delete('/:id', requireAuth, async (req, res) => {
  const consulta = await Consulta.findById(req.params.id)
  if (!consulta) {
    res.status(404).json({ error: 'Não encontramos essa consulta.' })
    return
  }
  if (consulta.autorId !== req.user!.id) {
    res.status(403).json({ error: 'Você só pode remover as consultas que registrou.' })
    return
  }
  await consulta.deleteOne()
  res.status(204).end()
})
