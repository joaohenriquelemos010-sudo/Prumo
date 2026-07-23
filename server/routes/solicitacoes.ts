import { Router } from 'express'
import { isValidObjectId } from 'mongoose'
import { requireAuth } from '../auth'
import { Prestador } from '../models/Prestador'
import { Solicitacao } from '../models/Solicitacao'
import { solicitacaoCreateSchema } from '../validation'
import { normalizeField } from '../sanitize'

export const solicitacoesRouter = Router()

// GET /api/solicitacoes — the family's own requests.
solicitacoesRouter.get('/', requireAuth, async (req, res) => {
  const solicitacoes = await Solicitacao.find({ usuario: req.user!.id }).sort({ createdAt: -1 })
  res.json({
    solicitacoes: solicitacoes.map((s) => ({
      id: String(s._id),
      prestadorNome: s.prestadorNome,
      objetivo: s.objetivo,
      modalidade: s.modalidade,
      status: s.status,
    })),
  })
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

  res.status(201).json({
    solicitacao: {
      id: String(solicitacao._id),
      prestadorNome: solicitacao.prestadorNome,
      objetivo: solicitacao.objetivo,
      modalidade: solicitacao.modalidade,
      status: solicitacao.status,
    },
  })
})
