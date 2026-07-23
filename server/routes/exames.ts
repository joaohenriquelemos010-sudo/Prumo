import { Router } from 'express'
import { isValidObjectId } from 'mongoose'
import multer from 'multer'
import { requireAuth } from '../auth.js'
import { resolveCriancaOr403 } from '../services/acesso.js'
import { Exame } from '../models/Exame.js'
import type { ExameDoc } from '../models/Exame.js'
import type { HydratedDocument } from 'mongoose'
import { exameCreateSchema } from '../validation.js'
import { normalizeField } from '../sanitize.js'
import { uploadBuffer, streamToResponse, deleteFile, toObjectId } from '../storage/gridfs.js'

export const examesRouter = Router()

const MAX_BYTES = 5 * 1024 * 1024 // 5 MB
const TIPOS_ACEITOS = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES },
  fileFilter: (_req, file, cb) => {
    cb(null, TIPOS_ACEITOS.has(file.mimetype))
  },
})

examesRouter.param('id', (_req, res, next, id) => {
  if (!isValidObjectId(id)) {
    res.status(404).json({ error: 'Não encontramos esse exame.' })
    return
  }
  next()
})

function serialize(e: HydratedDocument<ExameDoc>) {
  return {
    id: String(e._id),
    autorId: e.autorId,
    autorNome: e.autorNome,
    nome: e.nome,
    categoria: e.categoria,
    dataExame: new Date(e.dataExame).toISOString(),
    observacoes: e.observacoes,
    temArquivo: Boolean(e.arquivoId),
    arquivoNome: e.arquivoNome,
    mimeType: e.mimeType,
    tamanho: e.tamanho,
  }
}

// GET /api/exames — the current patient's saved exams.
examesRouter.get('/', requireAuth, async (req, res) => {
  const crianca = await resolveCriancaOr403(req, res)
  if (!crianca) return
  const exames = await Exame.find({ crianca: crianca._id }).sort({ dataExame: -1 })
  res.json({ exames: exames.map(serialize) })
})

// POST /api/exames — multipart: metadata fields + optional file.
examesRouter.post('/', requireAuth, upload.single('arquivo'), async (req, res) => {
  const parsed = exameCreateSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Confere os dados do exame.' })
    return
  }
  const crianca = await resolveCriancaOr403(req, res)
  if (!crianca) return
  const d = parsed.data

  let arquivoId = null
  let arquivoNome = ''
  let mimeType = ''
  let tamanho = 0
  if (req.file) {
    if (!TIPOS_ACEITOS.has(req.file.mimetype)) {
      res.status(400).json({ error: 'Formato não aceito. Envie PDF, JPG, PNG ou WEBP.' })
      return
    }
    const safeName = normalizeField(req.file.originalname || 'exame', 120)
    arquivoId = await uploadBuffer(req.file.buffer, safeName, req.file.mimetype)
    arquivoNome = safeName
    mimeType = req.file.mimetype
    tamanho = req.file.size
  }

  const exame = await Exame.create({
    crianca: crianca._id,
    autorId: req.user!.id,
    autorNome: req.user!.nome,
    nome: normalizeField(d.nome, 120),
    categoria: d.categoria,
    dataExame: d.dataExame ? new Date(d.dataExame) : new Date(),
    observacoes: normalizeField(d.observacoes ?? '', 1000),
    arquivoId,
    arquivoNome,
    mimeType,
    tamanho,
  })
  res.status(201).json({ exame: serialize(exame) })
})

// GET /api/exames/:id/arquivo — stream the file (auth + scoped to own patient).
examesRouter.get('/:id/arquivo', requireAuth, async (req, res) => {
  const crianca = await resolveCriancaOr403(req, res)
  if (!crianca) return
  const exame = await Exame.findById(req.params.id)
  if (!exame || String(exame.crianca) !== String(crianca._id) || !exame.arquivoId) {
    res.status(404).json({ error: 'Arquivo não encontrado.' })
    return
  }
  const fileId = toObjectId(exame.arquivoId)
  if (!fileId) {
    res.status(404).json({ error: 'Arquivo não encontrado.' })
    return
  }
  res.setHeader('Content-Type', exame.mimeType || 'application/octet-stream')
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(exame.arquivoNome || 'exame')}"`)
  streamToResponse(fileId, res)
})

// DELETE /api/exames/:id — author only; removes file from GridFS too.
examesRouter.delete('/:id', requireAuth, async (req, res) => {
  const exame = await Exame.findById(req.params.id)
  if (!exame) {
    res.status(404).json({ error: 'Não encontramos esse exame.' })
    return
  }
  if (exame.autorId !== req.user!.id) {
    res.status(403).json({ error: 'Você só pode remover os exames que enviou.' })
    return
  }
  if (exame.arquivoId) {
    const fileId = toObjectId(exame.arquivoId)
    if (fileId) await deleteFile(fileId)
  }
  await exame.deleteOne()
  res.status(204).end()
})
