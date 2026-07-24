import { Router } from 'express'
import { isValidObjectId } from 'mongoose'
import type { HydratedDocument } from 'mongoose'
import { requireAuth, requireRole } from '../auth.js'
import { User } from '../models/User.js'
import { Crianca } from '../models/Crianca.js'
import { Vinculo } from '../models/Vinculo.js'
import { SolicitacaoCompartilhamento } from '../models/SolicitacaoCompartilhamento.js'
import type { SolicitacaoCompartilhamentoDoc } from '../models/SolicitacaoCompartilhamento.js'
import { compartilhamentoCreateSchema } from '../validation.js'

/**
 * Compartilhamentos — doctor→doctor sharing requests. A doctor connected to a
 * patient asks to bring another doctor onto the journey; the child's responsáveis
 * (mãe/pai) approve, and only then is a Vínculo created for the destination
 * doctor. Any one responsável approving is enough.
 */
export const compartilhamentosRouter = Router()

compartilhamentosRouter.param('id', (_req, res, next, id) => {
  if (!isValidObjectId(id)) {
    res.status(404).json({ error: 'Solicitação não encontrada.' })
    return
  }
  next()
})

function ehResponsavel(
  crianca: { responsavel: unknown; coResponsaveis?: string[] },
  userId: string,
): boolean {
  return String(crianca.responsavel) === userId || (crianca.coResponsaveis ?? []).includes(userId)
}

async function serialize(s: HydratedDocument<SolicitacaoCompartilhamentoDoc>, nomes: Map<string, string>) {
  return {
    id: String(s._id),
    criancaNome: nomes.get(String(s.crianca)) || '',
    medicoOrigemNome: s.medicoOrigemNome,
    medicoDestinoNome: s.medicoDestinoNome,
    medicoDestinoEmail: s.medicoDestinoEmail,
    especialidadeDestino: s.especialidadeDestino,
    status: s.status,
    criadaEm: s.createdAt.toISOString(),
  }
}

async function nomesDasCriancas(docs: { crianca: unknown }[]): Promise<Map<string, string>> {
  const ids = [...new Set(docs.map((d) => String(d.crianca)))].filter((id) => isValidObjectId(id))
  if (ids.length === 0) return new Map()
  const criancas = await Crianca.find({ _id: { $in: ids } }).select('nome').lean()
  return new Map(criancas.map((c) => [String(c._id), c.nome || 'Bebê']))
}

// GET /api/compartilhamentos — doctor sees the requests they created ('enviadas');
// a responsável sees the pending requests for their children ('pendentes').
compartilhamentosRouter.get('/', requireAuth, async (req, res) => {
  const userId = req.user!.id

  if (req.user!.papel === 'medico') {
    const enviadasDocs = await SolicitacaoCompartilhamento.find({ medicoOrigemId: userId }).sort({ createdAt: -1 })
    const nomes = await nomesDasCriancas(enviadasDocs)
    const enviadas = await Promise.all(enviadasDocs.map((s) => serialize(s, nomes)))
    res.json({ enviadas, pendentes: [] })
    return
  }

  // Family: pending requests for journeys they own or co-parent.
  const criancas = await Crianca.find({ $or: [{ responsavel: userId }, { coResponsaveis: userId }] })
    .select('_id nome')
    .lean()
  const criancaIds = criancas.map((c) => c._id)
  const pendentesDocs = await SolicitacaoCompartilhamento.find({
    crianca: { $in: criancaIds },
    status: 'pendente',
  }).sort({ createdAt: -1 })
  const nomes = new Map(criancas.map((c) => [String(c._id), c.nome || 'Bebê']))
  const pendentes = await Promise.all(pendentesDocs.map((s) => serialize(s, nomes)))
  res.json({ enviadas: [], pendentes })
})

// POST /api/compartilhamentos { criancaId, email } — a connected doctor requests
// to share the patient with another (registered) doctor.
compartilhamentosRouter.post('/', requireAuth, requireRole('medico'), async (req, res) => {
  const parsed = compartilhamentoCreateSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Confere os dados.' })
    return
  }
  const { criancaId, email } = parsed.data
  if (!isValidObjectId(criancaId)) {
    res.status(404).json({ error: 'Paciente não encontrado.' })
    return
  }

  // The requesting doctor must be actively connected to this patient.
  const temVinculo = await Vinculo.exists({ crianca: criancaId, medicoId: req.user!.id, status: 'ativo' })
  if (!temVinculo) {
    res.status(403).json({ error: 'Você precisa estar conectado a este paciente para compartilhá-lo.' })
    return
  }

  const destino = await User.findOne({ email, papel: 'medico' }).lean()
  if (!destino) {
    res.status(404).json({ error: 'Não encontramos um médico com esse e-mail na Prumo.' })
    return
  }
  if (String(destino._id) === req.user!.id) {
    res.status(400).json({ error: 'Esse é o seu próprio e-mail.' })
    return
  }

  const jaConectado = await Vinculo.exists({ crianca: criancaId, medicoId: String(destino._id), status: 'ativo' })
  if (jaConectado) {
    res.status(409).json({ error: 'Esse médico já está conectado a este paciente.' })
    return
  }

  const jaPendente = await SolicitacaoCompartilhamento.exists({
    crianca: criancaId,
    medicoDestinoId: String(destino._id),
    status: 'pendente',
  })
  if (jaPendente) {
    res.status(409).json({ error: 'Já existe uma solicitação pendente para esse médico.' })
    return
  }

  const solicitacao = await SolicitacaoCompartilhamento.create({
    crianca: criancaId,
    medicoOrigemId: req.user!.id,
    medicoOrigemNome: req.user!.nome,
    medicoDestinoId: String(destino._id),
    medicoDestinoNome: destino.nome,
    medicoDestinoEmail: destino.email,
    especialidadeDestino: destino.especialidade || '',
    status: 'pendente',
  })
  const nomes = await nomesDasCriancas([solicitacao])
  res.status(201).json({ solicitacao: await serialize(solicitacao, nomes) })
})

// POST /api/compartilhamentos/:id/aprovar — a responsável approves → creates the Vínculo.
compartilhamentosRouter.post('/:id/aprovar', requireAuth, async (req, res) => {
  const solicitacao = await SolicitacaoCompartilhamento.findById(req.params.id)
  if (!solicitacao || solicitacao.status !== 'pendente') {
    res.status(404).json({ error: 'Solicitação não encontrada.' })
    return
  }
  const crianca = await Crianca.findById(solicitacao.crianca)
  if (!crianca || !ehResponsavel(crianca, req.user!.id)) {
    res.status(403).json({ error: 'Só um responsável pela criança pode aprovar.' })
    return
  }

  try {
    await Vinculo.create({
      crianca: crianca._id,
      pacienteId: String(crianca.responsavel),
      pacienteNome: crianca.nome || '',
      medicoId: solicitacao.medicoDestinoId,
      medicoNome: solicitacao.medicoDestinoNome,
      status: 'ativo',
    })
  } catch {
    // Unique index → already connected; treat as success (idempotent).
  }

  solicitacao.status = 'aprovada'
  solicitacao.resolvidaPor = req.user!.id
  solicitacao.resolvidaPorNome = req.user!.nome
  await solicitacao.save()
  res.json({ ok: true, status: solicitacao.status })
})

// POST /api/compartilhamentos/:id/recusar — a responsável declines.
compartilhamentosRouter.post('/:id/recusar', requireAuth, async (req, res) => {
  const solicitacao = await SolicitacaoCompartilhamento.findById(req.params.id)
  if (!solicitacao || solicitacao.status !== 'pendente') {
    res.status(404).json({ error: 'Solicitação não encontrada.' })
    return
  }
  const crianca = await Crianca.findById(solicitacao.crianca)
  if (!crianca || !ehResponsavel(crianca, req.user!.id)) {
    res.status(403).json({ error: 'Só um responsável pela criança pode recusar.' })
    return
  }
  solicitacao.status = 'recusada'
  solicitacao.resolvidaPor = req.user!.id
  solicitacao.resolvidaPorNome = req.user!.nome
  await solicitacao.save()
  res.json({ ok: true, status: solicitacao.status })
})
