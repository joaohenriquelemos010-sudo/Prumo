import { Router } from 'express'
import { isValidObjectId } from 'mongoose'
import { requireAuth, requireRole } from '../auth.js'
import { excluirConta } from '../services/conta.js'
import { User } from '../models/User.js'
import { Crianca } from '../models/Crianca.js'
import { Vinculo } from '../models/Vinculo.js'
import { Exame } from '../models/Exame.js'
import { Agendamento } from '../models/Agendamento.js'

/**
 * Admin area — restricted to the platform administrator (papel 'admin'). Lets the
 * admin verify doctors (CRM), browse/remove accounts, and read platform metrics.
 */
export const adminRouter = Router()

adminRouter.use(requireAuth, requireRole('admin'))

// GET /api/admin/medicos — doctors with their verification state and specialty.
adminRouter.get('/medicos', async (_req, res) => {
  const medicos = await User.find({ papel: 'medico' }).sort({ createdAt: -1 }).lean()
  res.json({
    medicos: medicos.map((m) => ({
      id: String(m._id),
      nome: m.nome,
      email: m.email,
      crm: m.crm || '',
      crmUf: m.crmUf || '',
      especialidade: m.especialidade || '',
      verificacaoStatus: m.verificacaoStatus,
      criadoEm: m.createdAt,
    })),
  })
})

// POST /api/admin/medicos/:id/verificar { status: 'verificado' | 'recusado' }
adminRouter.post('/medicos/:id/verificar', async (req, res) => {
  const { id } = req.params
  const status = req.body?.status
  if (!isValidObjectId(id) || (status !== 'verificado' && status !== 'recusado')) {
    res.status(400).json({ error: 'Confere os dados, por favor.' })
    return
  }
  const medico = await User.findOne({ _id: id, papel: 'medico' })
  if (!medico) {
    res.status(404).json({ error: 'Médico não encontrado.' })
    return
  }
  medico.verificacaoStatus = status
  await medico.save()
  res.json({ id, verificacaoStatus: medico.verificacaoStatus })
})

// GET /api/admin/usuarios?page=1&limit=20 — paginated account list.
adminRouter.get('/usuarios', async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1)
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20))
  const [usuarios, total] = await Promise.all([
    User.find()
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    User.countDocuments(),
  ])
  res.json({
    usuarios: usuarios.map((u) => ({
      id: String(u._id),
      nome: u.nome,
      email: u.email,
      papel: u.papel,
      verificacaoStatus: u.verificacaoStatus,
      criadoEm: u.createdAt,
    })),
    total,
    page,
    limit,
  })
})

// DELETE /api/admin/usuarios/:id — remove an account and all its data.
adminRouter.delete('/usuarios/:id', async (req, res) => {
  const { id } = req.params
  if (!isValidObjectId(id)) {
    res.status(404).json({ error: 'Conta não encontrada.' })
    return
  }
  if (id === req.user!.id) {
    res.status(400).json({ error: 'Você não pode excluir a própria conta de administrador por aqui.' })
    return
  }
  const alvo = await User.findById(id).lean()
  if (!alvo) {
    res.status(404).json({ error: 'Conta não encontrada.' })
    return
  }
  if (alvo.papel === 'admin') {
    res.status(400).json({ error: 'Contas de administrador não podem ser excluídas por aqui.' })
    return
  }
  await excluirConta(id)
  res.status(204).end()
})

/**
 * GET /api/admin/agendamentos — the marketplace queue.
 *
 * Seeded `Prestador` listings have no account, so nobody on their side can answer
 * a booking. Until they do, the admin confirms or declines on their behalf — which
 * is what keeps `confirmado` reachable on that path instead of leaving families
 * waiting on a status that can never change.
 */
adminRouter.get('/agendamentos', async (req, res) => {
  const status = String(req.query.status ?? 'pendente')
  const agendamentos = await Agendamento.find({
    origem: 'marketplace',
    ...(status ? { status: { $in: status.split(',') } } : {}),
  })
    .sort({ inicio: 1 })
    .limit(200)

  res.json({
    agendamentos: agendamentos.map((a) => ({
      id: String(a._id),
      origem: a.origem,
      medicoId: a.medicoId,
      profissionalNome: a.prestadorNome,
      prestadorId: a.prestador ? String(a.prestador) : '',
      pacienteNome: a.pacienteNome,
      objetivo: a.objetivo,
      modalidade: a.modalidade,
      inicio: new Date(a.inicio).toISOString(),
      fim: new Date(new Date(a.inicio).getTime() + a.duracaoMin * 60_000).toISOString(),
      duracaoMin: a.duracaoMin,
      local: a.local,
      status: a.status,
      motivo: a.motivo,
      mensagem: a.mensagem,
      convenio: a.convenio,
      consultaId: '',
      criadoEm: a.createdAt.toISOString(),
    })),
  })
})

// GET /api/admin/metricas — platform counts at a glance.
adminRouter.get('/metricas', async (_req, res) => {
  const [porPapel, vinculosAtivos, exames, agendamentos, agendamentosPendentes, criancas] = await Promise.all([
    User.aggregate<{ _id: string; total: number }>([{ $group: { _id: '$papel', total: { $sum: 1 } } }]),
    Vinculo.countDocuments({ status: 'ativo' }),
    Exame.countDocuments(),
    Agendamento.countDocuments(),
    Agendamento.countDocuments({ status: 'pendente' }),
    Crianca.countDocuments(),
  ])
  const usuariosPorPapel: Record<string, number> = {}
  let totalUsuarios = 0
  for (const p of porPapel) {
    usuariosPorPapel[p._id] = p.total
    totalUsuarios += p.total
  }
  const medicosPendentes = await User.countDocuments({ papel: 'medico', verificacaoStatus: 'pendente' })
  res.json({
    totalUsuarios,
    usuariosPorPapel,
    medicosPendentes,
    vinculosAtivos,
    exames,
    agendamentos,
    agendamentosPendentes,
    criancas,
  })
})
