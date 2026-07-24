import { Router } from 'express'
import { requireAuth, requireRole } from '../auth.js'
import { resolveCriancaOr403 } from '../services/acesso.js'
import { Prontuario } from '../models/Prontuario.js'
import type { ProntuarioDoc } from '../models/Prontuario.js'
import type { HydratedDocument, Types } from 'mongoose'
import { prontuarioUpdateSchema, prontuarioEventoSchema } from '../validation.js'
import { normalizeField } from '../sanitize.js'

export const prontuarioRouter = Router()

async function getOrCreateProntuario(criancaId: Types.ObjectId): Promise<HydratedDocument<ProntuarioDoc>> {
  const existing = await Prontuario.findOne({ crianca: criancaId })
  if (existing) return existing
  return Prontuario.create({ crianca: criancaId })
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
  const crianca = await resolveCriancaOr403(req, res)
  if (!crianca) return
  const prontuario = await getOrCreateProntuario(crianca._id)
  res.json({ prontuario: serialize(prontuario) })
})

// PUT /api/prontuario — update the structured summary (doctor-only).
prontuarioRouter.put('/', requireAuth, requireRole('medico'), async (req, res) => {
  const parsed = prontuarioUpdateSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Confere os dados, por favor.' })
    return
  }
  const crianca = await resolveCriancaOr403(req, res)
  if (!crianca) return
  const prontuario = await getOrCreateProntuario(crianca._id)
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
  const crianca = await resolveCriancaOr403(req, res)
  if (!crianca) return
  const prontuario = await getOrCreateProntuario(crianca._id)
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
  const crianca = await resolveCriancaOr403(req, res)
  if (!crianca) return
  const prontuario = await getOrCreateProntuario(crianca._id)
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
  const crianca = await resolveCriancaOr403(req, res)
  if (!crianca) return
  const prontuario = await getOrCreateProntuario(crianca._id)
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
