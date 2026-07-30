import { Router } from 'express'
import type { Request, Response } from 'express'
import { isValidObjectId } from 'mongoose'
import type { HydratedDocument } from 'mongoose'
import { requireAuth } from '../auth.js'
import { resolveCrianca, resolveCriancaOr403 } from '../services/acesso.js'
import { Agendamento, STATUS_OCUPAM_SLOT } from '../models/Agendamento.js'
import type { AgendamentoDoc, StatusAgendamento } from '../models/Agendamento.js'
import { Prestador } from '../models/Prestador.js'
import { User } from '../models/User.js'
import { Disponibilidade } from '../models/Disponibilidade.js'
import { agendamentoCreateSchema, agendamentoUpdateSchema } from '../validation.js'
import { normalizeField } from '../sanitize.js'
import { rateLimit } from '../rate-limit.js'
import { slotDisponivel } from '../services/slots.js'
import { ocupadosDoMedico, paraConfig } from './disponibilidade.js'

export const agendamentosRouter = Router()

function serialize(a: HydratedDocument<AgendamentoDoc>) {
  const fim = new Date(new Date(a.inicio).getTime() + a.duracaoMin * 60_000)
  return {
    id: String(a._id),
    origem: a.origem,
    medicoId: a.medicoId,
    profissionalNome: a.origem === 'medico' ? a.medicoNome : a.prestadorNome,
    prestadorId: a.prestador ? String(a.prestador) : '',
    pacienteNome: a.pacienteNome,
    objetivo: a.objetivo,
    modalidade: a.modalidade,
    inicio: new Date(a.inicio).toISOString(),
    fim: fim.toISOString(),
    duracaoMin: a.duracaoMin,
    local: a.local,
    status: a.status,
    motivo: a.motivo,
    mensagem: a.mensagem,
    convenio: a.convenio,
    consultaId: a.consulta ? String(a.consulta) : '',
    criadoEm: a.createdAt.toISOString(),
  }
}

function registrarHistorico(
  a: HydratedDocument<AgendamentoDoc>,
  user: { id: string; nome: string },
  de: string,
  para: string,
  nota = '',
) {
  a.historico.push({
    em: new Date(),
    porId: user.id,
    porNome: user.nome,
    de,
    para,
    nota: normalizeField(nota, 200),
  })
}

/**
 * Who may drive an appointment from one state to the next.
 *
 * The professional owns the outcome — only they confirm, decline, or mark that
 * the visit happened. The family owns their own attendance — they may cancel or
 * move, never confirm on the doctor's behalf. Marketplace listings have no
 * account, so an admin answers for them.
 */
type Ator = 'paciente' | 'profissional' | 'admin'

const TRANSICOES: Record<StatusAgendamento, { para: StatusAgendamento; por: Ator[] }[]> = {
  pendente: [
    { para: 'confirmado', por: ['profissional', 'admin'] },
    { para: 'recusado', por: ['profissional', 'admin'] },
    { para: 'cancelado', por: ['paciente', 'profissional', 'admin'] },
  ],
  confirmado: [
    { para: 'cancelado', por: ['paciente', 'profissional', 'admin'] },
    { para: 'realizado', por: ['profissional', 'admin'] },
    { para: 'faltou', por: ['profissional', 'admin'] },
  ],
  recusado: [],
  cancelado: [],
  realizado: [],
  faltou: [],
}

/** Terminal states can't be rescheduled either. */
const REMARCAVEIS: StatusAgendamento[] = ['pendente', 'confirmado']

/**
 * Resolves who the caller is on this appointment, answering 403 when they are
 * nobody. Deliberately uses `resolveCrianca` (which returns null) rather than the
 * `…Or403` helper: the booked doctor owns the appointment even when they have no
 * vínculo to the journey, so a journey check alone would wrongly lock them out —
 * and would have already written a response.
 */
async function atorOu403(
  req: Request,
  res: Response,
  a: AgendamentoDoc,
): Promise<Ator | null> {
  const user = req.user!
  if (user.papel === 'admin') return 'admin'
  if (user.papel === 'medico' && a.medicoId && a.medicoId === user.id) return 'profissional'

  const crianca = await resolveCrianca(user, String(a.crianca))
  if (crianca) return 'paciente'

  res.status(403).json({ error: 'Você não tem acesso a esse agendamento.' })
  return null
}

agendamentosRouter.param('id', (_req, res, next, id) => {
  if (!isValidObjectId(id)) {
    res.status(404).json({ error: 'Não encontramos esse agendamento.' })
    return
  }
  next()
})

/**
 * GET /api/agendamentos
 *   ?meus=true          → the doctor's own calendar, across every patient
 *   ?crianca=<id>       → one journey's agenda (family, co-parent or linked doctor)
 *   &de=&ate=&status=
 */
agendamentosRouter.get('/', requireAuth, async (req, res) => {
  const filtro: Record<string, unknown> = {}

  if (String(req.query.meus ?? '') === 'true') {
    if (req.user!.papel !== 'medico') {
      res.status(403).json({ error: 'Só profissionais têm agenda própria.' })
      return
    }
    filtro.medicoId = req.user!.id
  } else {
    const crianca = await resolveCriancaOr403(req, res)
    if (!crianca) return
    filtro.crianca = crianca._id
  }

  const de = String(req.query.de ?? '')
  const ate = String(req.query.ate ?? '')
  if (de || ate) {
    const janela: Record<string, Date> = {}
    if (de && !Number.isNaN(Date.parse(de))) janela.$gte = new Date(de)
    if (ate && !Number.isNaN(Date.parse(ate))) janela.$lte = new Date(ate)
    if (Object.keys(janela).length > 0) filtro.inicio = janela
  }

  const status = String(req.query.status ?? '')
  if (status) filtro.status = { $in: status.split(',') }

  const agendamentos = await Agendamento.find(filtro).sort({ inicio: 1 }).limit(300)
  res.json({ agendamentos: agendamentos.map(serialize) })
})

// POST /api/agendamentos — book a real date and time.
agendamentosRouter.post(
  '/',
  requireAuth,
  rateLimit({ key: 'agendamento', limit: 20, windowMs: 60_000 }),
  async (req, res) => {
    const parsed = agendamentoCreateSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Confere os dados.' })
      return
    }
    const crianca = await resolveCriancaOr403(req, res)
    if (!crianca) return

    const d = parsed.data
    const inicio = new Date(d.inicio)
    if (inicio.getTime() < Date.now()) {
      res.status(400).json({ error: 'Esse horário já passou. Escolhe outro?' })
      return
    }

    const base = {
      crianca: crianca._id,
      pacienteId: req.user!.id,
      pacienteNome: req.user!.nome,
      objetivo: d.objetivo,
      modalidade: d.modalidade,
      inicio,
      mensagem: normalizeField(d.mensagem ?? '', 500),
      convenio: normalizeField(d.convenio ?? '', 80),
      status: 'pendente' as const,
    }

    if (d.medicoId) {
      if (!isValidObjectId(d.medicoId)) {
        res.status(404).json({ error: 'Profissional não encontrado.' })
        return
      }
      const medico = await User.findById(d.medicoId)
      if (!medico || medico.papel !== 'medico') {
        res.status(404).json({ error: 'Profissional não encontrado.' })
        return
      }
      const disp = await Disponibilidade.findOne({ medicoId: d.medicoId })
      if (!disp || !disp.ativo) {
        res.status(409).json({ error: 'Esse profissional ainda não abriu a agenda online.' })
        return
      }

      // Never trust the slot the client picked: the list it came from may be
      // seconds old, and two people can want the same 09:00.
      const fim = new Date(inicio.getTime() + disp.duracaoPadraoMin * 60_000)
      const ocupados = await ocupadosDoMedico(
        d.medicoId,
        new Date(inicio.getTime() - 24 * 3600_000),
        new Date(fim.getTime() + 24 * 3600_000),
      )
      if (!slotDisponivel(paraConfig(disp), inicio, ocupados)) {
        res.status(409).json({ error: 'Esse horário acabou de ser preenchido. Escolhe outro?' })
        return
      }

      const agendamento = await Agendamento.create({
        ...base,
        origem: 'medico',
        medicoId: String(medico._id),
        medicoNome: medico.nome,
        duracaoMin: disp.duracaoPadraoMin,
      })
      registrarHistorico(agendamento, req.user!, '', 'pendente', 'Solicitado pela família')
      await agendamento.save()
      res.status(201).json({ agendamento: serialize(agendamento) })
      return
    }

    // Marketplace listing: no account on the other side, so the family proposes a
    // time and an admin answers for the clinic.
    if (!isValidObjectId(d.prestadorId!)) {
      res.status(404).json({ error: 'Profissional não encontrado.' })
      return
    }
    const prestador = await Prestador.findById(d.prestadorId)
    if (!prestador) {
      res.status(404).json({ error: 'Profissional não encontrado.' })
      return
    }

    const agendamento = await Agendamento.create({
      ...base,
      origem: 'marketplace',
      prestador: prestador._id,
      prestadorNome: prestador.nome,
      local: normalizeField(`${prestador.endereco} · ${prestador.cidade}/${prestador.uf}`, 160),
    })
    registrarHistorico(agendamento, req.user!, '', 'pendente', 'Horário proposto pela família')
    await agendamento.save()
    res.status(201).json({ agendamento: serialize(agendamento) })
  },
)

/**
 * PATCH /api/agendamentos/:id — confirm, decline, cancel, reschedule, close out.
 * Every path goes through the transition table above.
 */
agendamentosRouter.patch('/:id', requireAuth, async (req, res) => {
  const parsed = agendamentoUpdateSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Confere os dados.' })
    return
  }

  const agendamento = await Agendamento.findById(req.params.id)
  if (!agendamento) {
    res.status(404).json({ error: 'Não encontramos esse agendamento.' })
    return
  }

  const ator = await atorOu403(req, res, agendamento)
  if (!ator) return

  const d = parsed.data
  const anterior = agendamento.status

  if (d.status) {
    const permitida = TRANSICOES[anterior].find((t) => t.para === d.status)
    if (!permitida) {
      res.status(409).json({
        error: `Não dá para mudar de "${anterior}" para "${d.status}".`,
      })
      return
    }
    if (!permitida.por.includes(ator)) {
      res.status(403).json({ error: 'Essa mudança é de responsabilidade do profissional.' })
      return
    }
    if ((d.status === 'realizado' || d.status === 'faltou') && new Date(agendamento.inicio) > new Date()) {
      res.status(409).json({ error: 'Essa consulta ainda não aconteceu.' })
      return
    }
    agendamento.status = d.status
    if (d.motivo) agendamento.motivo = normalizeField(d.motivo, 200)
  }

  if (d.inicio) {
    if (!REMARCAVEIS.includes(agendamento.status)) {
      res.status(409).json({ error: 'Esse agendamento não pode mais ser remarcado.' })
      return
    }
    const novoInicio = new Date(d.inicio)
    if (novoInicio.getTime() < Date.now()) {
      res.status(400).json({ error: 'Esse horário já passou. Escolhe outro?' })
      return
    }

    if (agendamento.origem === 'medico' && agendamento.medicoId) {
      const disp = await Disponibilidade.findOne({ medicoId: agendamento.medicoId })
      if (!disp || !disp.ativo) {
        res.status(409).json({ error: 'A agenda desse profissional está fechada no momento.' })
        return
      }
      const ocupados = (
        await ocupadosDoMedico(
          agendamento.medicoId,
          new Date(novoInicio.getTime() - 24 * 3600_000),
          new Date(novoInicio.getTime() + 24 * 3600_000),
        )
      ).filter((o) => o.inicio.getTime() !== new Date(agendamento.inicio).getTime())

      if (!slotDisponivel(paraConfig(disp), novoInicio, ocupados)) {
        res.status(409).json({ error: 'Esse horário acabou de ser preenchido. Escolhe outro?' })
        return
      }
    }

    agendamento.inicio = novoInicio
    // Moving a confirmed appointment sends it back for confirmation — the other
    // side agreed to a time, not to any time.
    if (agendamento.status === 'confirmado') agendamento.status = 'pendente'
    registrarHistorico(agendamento, req.user!, anterior, agendamento.status, 'Remarcado')
  }

  if (d.modalidade) agendamento.modalidade = d.modalidade

  if (d.status && d.status !== anterior) {
    registrarHistorico(agendamento, req.user!, anterior, d.status, d.motivo ?? '')
  }

  await agendamento.save()
  res.json({ agendamento: serialize(agendamento) })
})

// DELETE /api/agendamentos/:id — the family cancels. Soft, so the history stays.
agendamentosRouter.delete('/:id', requireAuth, async (req, res) => {
  const agendamento = await Agendamento.findById(req.params.id)
  if (!agendamento) {
    res.status(404).json({ error: 'Não encontramos esse agendamento.' })
    return
  }

  const ator = await atorOu403(req, res, agendamento)
  if (!ator) return

  if (agendamento.status === 'cancelado') {
    res.json({ agendamento: serialize(agendamento) })
    return
  }
  if (!TRANSICOES[agendamento.status].some((t) => t.para === 'cancelado')) {
    res.status(409).json({ error: 'Esse agendamento não pode mais ser cancelado.' })
    return
  }

  const anterior = agendamento.status
  agendamento.status = 'cancelado'
  registrarHistorico(agendamento, req.user!, anterior, 'cancelado')
  await agendamento.save()
  res.json({ agendamento: serialize(agendamento) })
})

export { STATUS_OCUPAM_SLOT }
