import { Router } from 'express'
import { isValidObjectId } from 'mongoose'
import { randomBytes } from 'node:crypto'
import { requireAuth } from '../auth'
import { getOrCreateCrianca } from '../services/crianca'
import { Crianca } from '../models/Crianca'
import { Vinculo } from '../models/Vinculo'
import { ConviteVinculo } from '../models/ConviteVinculo'

export const vinculosRouter = Router()

const VALIDADE_MS = 7 * 24 * 60 * 60 * 1000

// POST /api/vinculos/convite — either side generates a share token (link/QR).
vinculosRouter.post('/convite', requireAuth, async (req, res) => {
  const token = randomBytes(16).toString('hex')
  const base = {
    token,
    criadorId: req.user!.id,
    criadorNome: req.user!.nome,
    criadorPapel: req.user!.papel,
    expiraEm: new Date(Date.now() + VALIDADE_MS),
  }

  if (req.user!.papel === 'medico') {
    await ConviteVinculo.create({ ...base, medicoId: req.user!.id })
  } else {
    const crianca = await getOrCreateCrianca(req.user!.id)
    await ConviteVinculo.create({ ...base, crianca: crianca._id })
  }

  res.status(201).json({ token, path: `/vincular/${token}` })
})

// GET /api/vinculos/convite/:token — info for the confirmation screen.
vinculosRouter.get('/convite/:token', requireAuth, async (req, res) => {
  const convite = await ConviteVinculo.findOne({ token: req.params.token })
  if (!convite || convite.usado || convite.expiraEm.getTime() < Date.now()) {
    res.status(404).json({ error: 'Esse convite não é mais válido. Peça um novo.' })
    return
  }
  res.json({
    criadorNome: convite.criadorNome,
    criadorPapel: convite.criadorPapel,
    // 'para-medico' → só um médico aceita; 'para-paciente' → só o paciente aceita.
    aceitaPor: convite.criadorPapel === 'medico' ? 'paciente' : 'medico',
  })
})

// POST /api/vinculos/aceitar/:token — creates the Vínculo (consented connection).
vinculosRouter.post('/aceitar/:token', requireAuth, async (req, res) => {
  const convite = await ConviteVinculo.findOne({ token: req.params.token })
  if (!convite || convite.usado || convite.expiraEm.getTime() < Date.now()) {
    res.status(404).json({ error: 'Esse convite não é mais válido. Peça um novo.' })
    return
  }
  if (convite.criadorId === req.user!.id) {
    res.status(400).json({ error: 'Esse convite foi criado por você — compartilhe com a outra pessoa.' })
    return
  }

  let dados: { crianca: unknown; pacienteId: string; pacienteNome: string; medicoId: string; medicoNome: string }

  if (convite.crianca) {
    // Patient-initiated → the accepter must be a doctor.
    if (req.user!.papel !== 'medico') {
      res.status(400).json({ error: 'Esse convite é para um médico se conectar.' })
      return
    }
    const crianca = await Crianca.findById(convite.crianca)
    if (!crianca) {
      res.status(404).json({ error: 'Paciente não encontrado.' })
      return
    }
    dados = {
      crianca: crianca._id,
      pacienteId: String(crianca.responsavel),
      pacienteNome: convite.criadorNome,
      medicoId: req.user!.id,
      medicoNome: req.user!.nome,
    }
  } else {
    // Doctor-initiated → the accepter must be a patient (mother/pregnant).
    if (req.user!.papel === 'medico') {
      res.status(400).json({ error: 'Esse convite é para um paciente se conectar.' })
      return
    }
    const crianca = await getOrCreateCrianca(req.user!.id)
    dados = {
      crianca: crianca._id,
      pacienteId: req.user!.id,
      pacienteNome: req.user!.nome,
      medicoId: convite.medicoId,
      medicoNome: convite.criadorNome,
    }
  }

  try {
    await Vinculo.create({ ...dados, status: 'ativo' })
  } catch {
    // Unique index → already connected; treat as success (idempotent).
  }
  convite.usado = true
  await convite.save()

  res.status(201).json({ ok: true, medicoNome: dados.medicoNome, pacienteNome: dados.pacienteNome })
})

// GET /api/vinculos — my connections (doctor sees patients, patient sees doctors).
vinculosRouter.get('/', requireAuth, async (req, res) => {
  if (req.user!.papel === 'medico') {
    const vinculos = await Vinculo.find({ medicoId: req.user!.id, status: 'ativo' }).sort({ createdAt: -1 })
    res.json({
      vinculos: vinculos.map((v) => ({ id: String(v._id), crianca: String(v.crianca), nome: v.pacienteNome, papel: 'paciente' })),
    })
    return
  }
  const vinculos = await Vinculo.find({ pacienteId: req.user!.id, status: 'ativo' }).sort({ createdAt: -1 })
  res.json({
    vinculos: vinculos.map((v) => ({ id: String(v._id), nome: v.medicoNome, papel: 'medico' })),
  })
})

// DELETE /api/vinculos/:id — revoke (either party; the patient can always cut it).
vinculosRouter.delete('/:id', requireAuth, async (req, res) => {
  if (!isValidObjectId(req.params.id)) {
    res.status(404).json({ error: 'Vínculo não encontrado.' })
    return
  }
  const vinculo = await Vinculo.findById(req.params.id)
  if (!vinculo) {
    res.status(404).json({ error: 'Vínculo não encontrado.' })
    return
  }
  if (vinculo.pacienteId !== req.user!.id && vinculo.medicoId !== req.user!.id) {
    res.status(403).json({ error: 'Esse vínculo não é seu.' })
    return
  }
  await vinculo.deleteOne()
  res.status(204).end()
})
