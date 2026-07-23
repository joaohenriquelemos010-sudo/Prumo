import { Router } from 'express'
import { requireAuth } from '../auth'
import { getOrCreateCrianca } from '../services/crianca'
import { Prontuario } from '../models/Prontuario'
import type { ProntuarioDoc } from '../models/Prontuario'
import type { HydratedDocument } from 'mongoose'
import { prontuarioUpdateSchema, prontuarioEventoSchema } from '../validation'
import { normalizeField } from '../sanitize'

export const prontuarioRouter = Router()

async function getOrCreateProntuario(userId: string): Promise<HydratedDocument<ProntuarioDoc>> {
  const crianca = await getOrCreateCrianca(userId)
  const existing = await Prontuario.findOne({ crianca: crianca._id })
  if (existing) return existing
  return Prontuario.create({ crianca: crianca._id })
}

function serialize(p: HydratedDocument<ProntuarioDoc>) {
  return {
    tipoSanguineo: p.tipoSanguineo,
    alergias: p.alergias,
    resumoGestacional: p.resumoGestacional,
    condicoes: p.condicoes,
    eventos: p.eventos
      .map((e) => ({
        id: String(e._id),
        data: e.data ? new Date(e.data).toISOString() : new Date().toISOString(),
        autorId: e.autorId,
        autorNome: e.autorNome,
        autorPapel: e.autorPapel,
        texto: e.texto,
      }))
      .reverse(),
  }
}

// GET /api/prontuario
prontuarioRouter.get('/', requireAuth, async (req, res) => {
  const prontuario = await getOrCreateProntuario(req.user!.id)
  res.json({ prontuario: serialize(prontuario) })
})

// PUT /api/prontuario — update the structured summary.
prontuarioRouter.put('/', requireAuth, async (req, res) => {
  const parsed = prontuarioUpdateSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Confere os dados, por favor.' })
    return
  }
  const prontuario = await getOrCreateProntuario(req.user!.id)
  const { tipoSanguineo, alergias, resumoGestacional, condicoes } = parsed.data
  if (tipoSanguineo !== undefined) prontuario.tipoSanguineo = normalizeField(tipoSanguineo, 8)
  if (alergias !== undefined) prontuario.alergias = normalizeField(alergias, 500)
  if (resumoGestacional !== undefined) prontuario.resumoGestacional = normalizeField(resumoGestacional, 2000)
  if (condicoes !== undefined) prontuario.condicoes = condicoes.map((c) => normalizeField(c, 120)).filter(Boolean)
  await prontuario.save()
  res.json({ prontuario: serialize(prontuario) })
})

// POST /api/prontuario/evento — append a dated note.
prontuarioRouter.post('/evento', requireAuth, async (req, res) => {
  const parsed = prontuarioEventoSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Escreva a anotação.' })
    return
  }
  const prontuario = await getOrCreateProntuario(req.user!.id)
  prontuario.eventos.push({
    data: new Date(),
    autorId: req.user!.id,
    autorNome: req.user!.nome,
    autorPapel: req.user!.papel,
    texto: normalizeField(parsed.data.texto, 2000),
  })
  await prontuario.save()
  res.status(201).json({ prontuario: serialize(prontuario) })
})

// PUT /api/prontuario/evento/:id — edit an annotation (author only).
prontuarioRouter.put('/evento/:id', requireAuth, async (req, res) => {
  const parsed = prontuarioEventoSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Escreva a anotação.' })
    return
  }
  const prontuario = await getOrCreateProntuario(req.user!.id)
  const evento = prontuario.eventos.find((e) => String(e._id) === req.params.id)
  if (!evento) {
    res.status(404).json({ error: 'Não encontramos essa anotação.' })
    return
  }
  if (evento.autorId !== req.user!.id) {
    res.status(403).json({ error: 'Você só pode editar as suas próprias anotações.' })
    return
  }
  evento.texto = normalizeField(parsed.data.texto, 2000)
  await prontuario.save()
  res.json({ prontuario: serialize(prontuario) })
})

// DELETE /api/prontuario/evento/:id — remove an annotation (author only).
prontuarioRouter.delete('/evento/:id', requireAuth, async (req, res) => {
  const prontuario = await getOrCreateProntuario(req.user!.id)
  const evento = prontuario.eventos.find((e) => String(e._id) === req.params.id)
  if (!evento) {
    res.status(404).json({ error: 'Não encontramos essa anotação.' })
    return
  }
  if (evento.autorId !== req.user!.id) {
    res.status(403).json({ error: 'Você só pode remover as suas próprias anotações.' })
    return
  }
  prontuario.eventos.pull({ _id: req.params.id })
  await prontuario.save()
  res.json({ prontuario: serialize(prontuario) })
})
