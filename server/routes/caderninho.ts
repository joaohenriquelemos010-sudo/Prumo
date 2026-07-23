import { Router } from 'express'
import { isValidObjectId } from 'mongoose'
import { requireAuth, requireRole } from '../auth'
import { getOrCreateCrianca } from '../services/crianca'
import { Duvida } from '../models/Duvida'
import type { DuvidaDoc } from '../models/Duvida'
import type { HydratedDocument } from 'mongoose'
import { duvidaCreateSchema, duvidaUpdateSchema, respostaSchema } from '../validation'
import { normalizeField } from '../sanitize'

export const caderninhoRouter = Router()

// Malformed ids would otherwise throw a Mongoose CastError → 500. Return a clean
// 404 for any non-ObjectId :id before it reaches a handler.
caderninhoRouter.param('id', (_req, res, next, id) => {
  if (!isValidObjectId(id)) {
    res.status(404).json({ error: 'Não encontramos essa dúvida.' })
    return
  }
  next()
})

function serialize(d: HydratedDocument<DuvidaDoc>) {
  return {
    id: String(d._id),
    texto: d.texto,
    autorId: d.autorId,
    autorNome: d.autorNome,
    compartilhada: d.compartilhada,
    respondida: d.respondida,
    respostaTexto: d.respostaTexto,
    respondidaPor: d.respondidaPor,
    respondidaEm: d.respondidaEm ? new Date(d.respondidaEm).toISOString() : null,
    criadaEm: (d as unknown as { createdAt?: Date }).createdAt?.toISOString() ?? new Date().toISOString(),
  }
}

// GET /api/caderninho — the family sees all their questions; the doctor sees the
// shared ones for their (demo) patient.
caderninhoRouter.get('/', requireAuth, async (req, res) => {
  const crianca = await getOrCreateCrianca(req.user!.id)
  const filtro =
    req.user!.papel === 'medico'
      ? { crianca: crianca._id, compartilhada: true }
      : { crianca: crianca._id }
  const duvidas = await Duvida.find(filtro).sort({ createdAt: -1 })
  res.json({ duvidas: duvidas.map(serialize) })
})

// POST /api/caderninho — only the family writes questions.
caderninhoRouter.post('/', requireAuth, requireRole('gestante', 'mae'), async (req, res) => {
  const parsed = duvidaCreateSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Escreva sua dúvida.' })
    return
  }
  const crianca = await getOrCreateCrianca(req.user!.id)
  const duvida = await Duvida.create({
    crianca: crianca._id,
    autorId: req.user!.id,
    autorNome: req.user!.nome,
    texto: normalizeField(parsed.data.texto, 1000),
    compartilhada: parsed.data.compartilhada ?? true,
  })
  res.status(201).json({ duvida: serialize(duvida) })
})

// PUT /api/caderninho/:id — author edits text / share flag.
caderninhoRouter.put('/:id', requireAuth, async (req, res) => {
  const parsed = duvidaUpdateSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Confere os dados.' })
    return
  }
  const duvida = await Duvida.findById(req.params.id)
  if (!duvida) {
    res.status(404).json({ error: 'Não encontramos essa dúvida.' })
    return
  }
  if (duvida.autorId !== req.user!.id) {
    res.status(403).json({ error: 'Você só pode editar as suas próprias dúvidas.' })
    return
  }
  if (parsed.data.texto !== undefined) duvida.texto = normalizeField(parsed.data.texto, 1000)
  if (parsed.data.compartilhada !== undefined) duvida.compartilhada = parsed.data.compartilhada
  await duvida.save()
  res.json({ duvida: serialize(duvida) })
})

// DELETE /api/caderninho/:id — author removes.
caderninhoRouter.delete('/:id', requireAuth, async (req, res) => {
  const duvida = await Duvida.findById(req.params.id)
  if (!duvida) {
    res.status(404).json({ error: 'Não encontramos essa dúvida.' })
    return
  }
  if (duvida.autorId !== req.user!.id) {
    res.status(403).json({ error: 'Você só pode remover as suas próprias dúvidas.' })
    return
  }
  await duvida.deleteOne()
  res.status(204).end()
})

// POST /api/caderninho/:id/resposta — only the doctor answers, and only questions
// belonging to their own patient (scoped by crianca — no cross-patient access).
caderninhoRouter.post('/:id/resposta', requireAuth, requireRole('medico'), async (req, res) => {
  const parsed = respostaSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Escreva a resposta.' })
    return
  }
  const crianca = await getOrCreateCrianca(req.user!.id)
  const duvida = await Duvida.findById(req.params.id)
  if (!duvida || !duvida.compartilhada || String(duvida.crianca) !== String(crianca._id)) {
    res.status(404).json({ error: 'Não encontramos essa dúvida.' })
    return
  }
  duvida.respostaTexto = normalizeField(parsed.data.texto, 1000)
  duvida.respondida = true
  duvida.respondidaPor = req.user!.nome
  duvida.respondidaEm = new Date()
  await duvida.save()
  res.json({ duvida: serialize(duvida) })
})
