import { Router } from 'express'
import { isValidObjectId } from 'mongoose'
import { requireAuth, requireRole } from '../auth.js'
import { resolveCriancaOr403 } from '../services/acesso.js'
import { Consulta } from '../models/Consulta.js'
import type { ConsultaDoc } from '../models/Consulta.js'
import type { HydratedDocument } from 'mongoose'
import { consultaCreateSchema } from '../validation.js'
import { normalizeField } from '../sanitize.js'

export const consultasRouter = Router()

consultasRouter.param('id', (_req, res, next, id) => {
  if (!isValidObjectId(id)) {
    res.status(404).json({ error: 'Não encontramos essa consulta.' })
    return
  }
  next()
})

function serialize(c: HydratedDocument<ConsultaDoc>) {
  return {
    id: String(c._id),
    autorId: c.autorId,
    autorNome: c.autorNome,
    data: new Date(c.data).toISOString(),
    tipo: c.tipo,
    subjetivo: c.subjetivo,
    objetivo: c.objetivo,
    avaliacao: c.avaliacao,
    plano: c.plano,
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
  res.json({ consultas: consultas.map(serialize) })
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
  const consulta = await Consulta.create({
    crianca: crianca._id,
    autorId: req.user!.id,
    autorNome: req.user!.nome,
    tipo: d.tipo,
    subjetivo: normalizeField(d.subjetivo ?? '', 3000),
    objetivo: normalizeField(d.objetivo ?? '', 3000),
    avaliacao: normalizeField(d.avaliacao ?? '', 3000),
    plano: normalizeField(d.plano ?? '', 3000),
    peso: normalizeField(d.peso ?? '', 20),
    altura: normalizeField(d.altura ?? '', 20),
    pressao: normalizeField(d.pressao ?? '', 20),
  })
  res.status(201).json({ consulta: serialize(consulta) })
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
