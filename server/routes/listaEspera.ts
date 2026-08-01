import { Router } from 'express'
import { isValidObjectId } from 'mongoose'
import type { HydratedDocument } from 'mongoose'
import { requireAuth, requireRole } from '../auth.js'
import { ListaEspera } from '../models/ListaEspera.js'
import type { ListaEsperaDoc } from '../models/ListaEspera.js'
import { TipoAtendimento } from '../models/TipoAtendimento.js'
import { resolveJornada } from '../services/jornada.js'
import { listaEsperaSchema, listaEsperaPatchSchema } from '../validation.js'
import { normalizeField } from '../sanitize.js'

export const listaEsperaRouter = Router()

function serialize(e: HydratedDocument<ListaEsperaDoc>) {
  const iso = (d?: Date | null) => (d ? new Date(d).toISOString() : null)
  return {
    id: String(e._id),
    jornada: e.jornada ? String(e.jornada) : null,
    nome: e.nome,
    telefone: e.telefone,
    tipoAtendimento: e.tipoAtendimento ? String(e.tipoAtendimento) : null,
    tipoNome: e.tipoNome,
    prioridade: e.prioridade,
    disponibilidade: e.disponibilidade,
    observacao: e.observacao,
    estado: e.estado,
    chamadoEm: iso(e.chamadoEm),
    esperandoDesde: iso((e as unknown as { createdAt?: Date }).createdAt),
  }
}

/**
 * GET /api/lista-espera — a fila, na ordem de chamar.
 *
 * Urgente primeiro, e dentro da mesma prioridade quem espera há mais tempo. É a
 * ordem que a secretária usaria no papel, e é a única que não precisa ser
 * explicada.
 */
listaEsperaRouter.get('/', requireAuth, requireRole('medico'), async (req, res) => {
  const estado = String(req.query.estado ?? 'aguardando')
  const filtro: Record<string, unknown> = { medicoId: req.user!.id }
  if (estado !== 'todos') filtro.estado = estado

  const fila = await ListaEspera.find(filtro)
    .sort({ prioridade: 1, createdAt: 1 })
    .limit(200)
  res.json({ fila: fila.map(serialize) })
})

/** POST /api/lista-espera — entra na fila. */
listaEsperaRouter.post('/', requireAuth, requireRole('medico'), async (req, res) => {
  const parsed = listaEsperaSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Confere os dados.' })
    return
  }
  const d = parsed.data

  // Jornada é opcional, mas quando vem tem que ser uma a que este médico alcança
  // — senão a lista de espera viraria uma forma de anexar qualquer paciente.
  let jornada = null
  if (d.jornadaId) {
    const j = await resolveJornada(req.user!, d.jornadaId)
    if (!j) {
      res.status(403).json({ error: 'Você não tem acesso a essa paciente.' })
      return
    }
    jornada = j._id
  }

  const tipo = d.tipoAtendimentoId
    ? await TipoAtendimento.findOne({ _id: d.tipoAtendimentoId, medicoId: req.user!.id })
    : null

  const item = await ListaEspera.create({
    medicoId: req.user!.id,
    jornada,
    nome: normalizeField(d.nome, 80),
    telefone: normalizeField(d.telefone ?? '', 20),
    tipoAtendimento: tipo?._id ?? null,
    tipoNome: tipo?.nome ?? '',
    prioridade: d.prioridade ?? 3,
    disponibilidade: normalizeField(d.disponibilidade ?? '', 160),
    observacao: normalizeField(d.observacao ?? '', 300),
  })

  res.status(201).json({ item: serialize(item) })
})

/** PATCH /api/lista-espera/:id — chamar, agendar, desistir, reordenar. */
listaEsperaRouter.patch('/:id', requireAuth, requireRole('medico'), async (req, res) => {
  const parsed = listaEsperaPatchSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Confere os dados.' })
    return
  }
  if (!isValidObjectId(req.params.id)) {
    res.status(404).json({ error: 'Não encontramos esse item.' })
    return
  }
  const item = await ListaEspera.findOne({ _id: req.params.id, medicoId: req.user!.id })
  if (!item) {
    res.status(404).json({ error: 'Não encontramos esse item.' })
    return
  }

  const d = parsed.data
  if (d.prioridade !== undefined) item.prioridade = d.prioridade
  if (d.disponibilidade !== undefined) item.disponibilidade = normalizeField(d.disponibilidade, 160)
  if (d.observacao !== undefined) item.observacao = normalizeField(d.observacao, 300)
  if (d.estado !== undefined) {
    item.estado = d.estado
    // Carimbar a transição é o que permite responder "chamei quando?" depois —
    // a pergunta que aparece quando alguém reclama que não foi avisada.
    if (d.estado === 'chamado') item.chamadoEm = new Date()
    if (d.estado === 'agendado' || d.estado === 'desistiu') item.resolvidoEm = new Date()
  }

  await item.save()
  res.json({ item: serialize(item) })
})

/** DELETE /api/lista-espera/:id — sai da fila de vez. */
listaEsperaRouter.delete('/:id', requireAuth, requireRole('medico'), async (req, res) => {
  if (!isValidObjectId(req.params.id)) {
    res.status(404).json({ error: 'Não encontramos esse item.' })
    return
  }
  const r = await ListaEspera.deleteOne({ _id: req.params.id, medicoId: req.user!.id })
  if (r.deletedCount === 0) {
    res.status(404).json({ error: 'Não encontramos esse item.' })
    return
  }
  res.status(204).end()
})
