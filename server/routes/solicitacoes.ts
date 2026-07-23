import { Router } from 'express'
import { isValidObjectId } from 'mongoose'
import type { HydratedDocument } from 'mongoose'
import { requireAuth } from '../auth.js'
import { Prestador } from '../models/Prestador.js'
import { Solicitacao } from '../models/Solicitacao.js'
import type { SolicitacaoDoc } from '../models/Solicitacao.js'
import { solicitacaoCreateSchema } from '../validation.js'
import { normalizeField } from '../sanitize.js'

export const solicitacoesRouter = Router()

function serialize(s: HydratedDocument<SolicitacaoDoc>) {
  return {
    id: String(s._id),
    prestadorNome: s.prestadorNome,
    objetivo: s.objetivo,
    modalidade: s.modalidade,
    status: s.status,
    criadaEm: s.createdAt.toISOString(),
  }
}

solicitacoesRouter.param('id', (_req, res, next, id) => {
  if (!isValidObjectId(id)) {
    res.status(404).json({ error: 'Não encontramos essa solicitação.' })
    return
  }
  next()
})

// GET /api/solicitacoes — all of the family's own requests (current + past).
solicitacoesRouter.get('/', requireAuth, async (req, res) => {
  const solicitacoes = await Solicitacao.find({ usuario: req.user!.id }).sort({ createdAt: -1 })
  res.json({ solicitacoes: solicitacoes.map(serialize) })
})

// POST /api/solicitacoes — request an exam/consultation. Confirmation simulated.
solicitacoesRouter.post('/', requireAuth, async (req, res) => {
  const parsed = solicitacaoCreateSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Confere os dados.' })
    return
  }
  const { prestadorId, objetivo, modalidade, mensagem } = parsed.data
  if (!isValidObjectId(prestadorId)) {
    res.status(404).json({ error: 'Profissional não encontrado.' })
    return
  }
  const prestador = await Prestador.findById(prestadorId)
  if (!prestador) {
    res.status(404).json({ error: 'Profissional não encontrado.' })
    return
  }

  const solicitacao = await Solicitacao.create({
    usuario: req.user!.id,
    usuarioNome: req.user!.nome,
    prestador: prestador._id,
    prestadorNome: prestador.nome,
    objetivo,
    modalidade,
    mensagem: normalizeField(mensagem ?? '', 500),
    status: 'pendente',
  })

  res.status(201).json({ solicitacao: serialize(solicitacao) })
})

// DELETE /api/solicitacoes/:id — the family cancels their own request.
solicitacoesRouter.delete('/:id', requireAuth, async (req, res) => {
  const solicitacao = await Solicitacao.findById(req.params.id)
  if (!solicitacao || solicitacao.usuario !== req.user!.id) {
    res.status(404).json({ error: 'Não encontramos essa solicitação.' })
    return
  }
  if (solicitacao.status === 'cancelada') {
    res.json({ solicitacao: serialize(solicitacao) })
    return
  }
  solicitacao.status = 'cancelada'
  await solicitacao.save()
  res.json({ solicitacao: serialize(solicitacao) })
})
