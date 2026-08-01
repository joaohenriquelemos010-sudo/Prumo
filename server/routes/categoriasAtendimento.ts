import { Router } from 'express'
import { isValidObjectId } from 'mongoose'
import type { HydratedDocument } from 'mongoose'
import { requireAuth, requireRole } from '../auth.js'
import { CategoriaAtendimento } from '../models/CategoriaAtendimento.js'
import type { CategoriaAtendimentoDoc } from '../models/CategoriaAtendimento.js'
import { categoriaAtendimentoSchema as validaCategoria } from '../validation.js'
import { normalizeField } from '../sanitize.js'

export const categoriasAtendimentoRouter = Router()

function serialize(c: HydratedDocument<CategoriaAtendimentoDoc>) {
  return {
    id: String(c._id),
    nome: c.nome,
    descricao: c.descricao,
    ativo: c.ativo,
    ordem: c.ordem,
  }
}

/**
 * GET /api/categorias-atendimento — as áreas de atuação do consultório.
 *
 * Diferente dos tipos de consulta, esta lista **não é semeada**: "Gestação" e
 * "Mastologia" descrevem a prática de quem está do outro lado da tela, e chutar
 * isso por especialidade acertaria pouco e atrapalharia sempre — o médico teria
 * de apagar antes de cadastrar.
 */
categoriasAtendimentoRouter.get('/', requireAuth, requireRole('medico'), async (req, res) => {
  const incluirInativas = String(req.query.todos ?? '') === 'true'
  const filtro: Record<string, unknown> = { medicoId: req.user!.id }
  if (!incluirInativas) filtro.ativo = true

  const categorias = await CategoriaAtendimento.find(filtro).sort({ ordem: 1, nome: 1 })
  res.json({ categorias: categorias.map(serialize) })
})

/** POST /api/categorias-atendimento */
categoriasAtendimentoRouter.post('/', requireAuth, requireRole('medico'), async (req, res) => {
  const parsed = validaCategoria.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Confere os dados.' })
    return
  }
  const d = parsed.data
  try {
    const categoria = await CategoriaAtendimento.create({
      medicoId: req.user!.id,
      nome: normalizeField(d.nome, 60),
      descricao: normalizeField(d.descricao ?? '', 200),
      ativo: d.ativo ?? true,
      ordem: d.ordem ?? 99,
    })
    res.status(201).json({ categoria: serialize(categoria) })
  } catch (e) {
    if ((e as { code?: number }).code === 11000) {
      res.status(409).json({ error: 'Você já tem uma área com esse nome.' })
      return
    }
    throw e
  }
})

/** PATCH /api/categorias-atendimento/:id */
categoriasAtendimentoRouter.patch('/:id', requireAuth, requireRole('medico'), async (req, res) => {
  const parsed = validaCategoria.partial().safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Confere os dados.' })
    return
  }
  if (!isValidObjectId(req.params.id)) {
    res.status(404).json({ error: 'Não encontramos essa área de atendimento.' })
    return
  }
  const categoria = await CategoriaAtendimento.findOne({
    _id: req.params.id,
    medicoId: req.user!.id,
  })
  if (!categoria) {
    res.status(404).json({ error: 'Não encontramos essa área de atendimento.' })
    return
  }

  const d = parsed.data
  if (d.nome !== undefined) categoria.nome = normalizeField(d.nome, 60)
  if (d.descricao !== undefined) categoria.descricao = normalizeField(d.descricao, 200)
  if (d.ordem !== undefined) categoria.ordem = d.ordem
  if (d.ativo !== undefined) categoria.ativo = d.ativo

  try {
    await categoria.save()
  } catch (e) {
    if ((e as { code?: number }).code === 11000) {
      res.status(409).json({ error: 'Você já tem uma área com esse nome.' })
      return
    }
    throw e
  }
  res.json({ categoria: serialize(categoria) })
})

/**
 * DELETE /api/categorias-atendimento/:id — desativa, não apaga.
 *
 * Mesma regra do catálogo de tipos: atendimentos antigos apontam para a área, e
 * o histórico clínico não pode perder significado porque alguém arrumou a lista.
 */
categoriasAtendimentoRouter.delete('/:id', requireAuth, requireRole('medico'), async (req, res) => {
  if (!isValidObjectId(req.params.id)) {
    res.status(404).json({ error: 'Não encontramos essa área de atendimento.' })
    return
  }
  const categoria = await CategoriaAtendimento.findOneAndUpdate(
    { _id: req.params.id, medicoId: req.user!.id },
    { $set: { ativo: false } },
    { returnDocument: 'after' },
  )
  if (!categoria) {
    res.status(404).json({ error: 'Não encontramos essa área de atendimento.' })
    return
  }
  res.json({ categoria: serialize(categoria) })
})
