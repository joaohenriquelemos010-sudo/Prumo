import { Router } from 'express'
import { isValidObjectId } from 'mongoose'
import type { HydratedDocument } from 'mongoose'
import { requireAuth, requireRole } from '../auth.js'
import { TipoAtendimento, padroesPara } from '../models/TipoAtendimento.js'
import type { TipoAtendimentoDoc } from '../models/TipoAtendimento.js'
import { User } from '../models/User.js'
import { TEMPLATES, templatePorChave } from '../conteudo/prontuario-templates.js'
import { tipoAtendimentoSchema as validaTipo } from '../validation.js'
import { normalizeField } from '../sanitize.js'

export const tiposAtendimentoRouter = Router()

function serialize(t: HydratedDocument<TipoAtendimentoDoc>) {
  const template = templatePorChave(t.template)
  return {
    id: String(t._id),
    nome: t.nome,
    duracaoMin: t.duracaoMin,
    cor: t.cor,
    template: t.template,
    templateRotulo: template.rotulo,
    templateNatureza: template.natureza,
    procedimento: t.procedimento,
    ativo: t.ativo,
    ordem: t.ordem,
    observacaoPadrao: t.observacaoPadrao,
  }
}

/**
 * Provisiona os tipos padrão na primeira vez que o médico olha a lista.
 *
 * Configuração em branco é a forma mais confiável de um recurso não ser usado —
 * quem abre a agenda quer marcar uma consulta, não desenhar um catálogo. Semear
 * na leitura (e não no cadastro) faz isto valer também para quem já tinha conta
 * antes de o recurso existir, sem migração.
 */
async function semear(medicoId: string): Promise<void> {
  const existe = await TipoAtendimento.exists({ medicoId })
  if (existe) return

  const medico = await User.findById(medicoId).select('especialidade')
  const padroes = padroesPara(medico?.especialidade)

  await TipoAtendimento.insertMany(
    padroes.map((p, i) => ({ ...p, medicoId, ordem: i, procedimento: p.procedimento ?? false })),
    // Dois cold starts simultâneos disputam o mesmo `insertMany`; o índice único
    // recusa o segundo, e isso é o resultado certo, não um erro a propagar.
    { ordered: false },
  ).catch(() => {
    /* já semeado por outra requisição */
  })
}

/** GET /api/tipos-atendimento — o catálogo do consultório. */
tiposAtendimentoRouter.get('/', requireAuth, requireRole('medico'), async (req, res) => {
  await semear(req.user!.id)
  const incluirInativos = String(req.query.todos ?? '') === 'true'
  const filtro: Record<string, unknown> = { medicoId: req.user!.id }
  if (!incluirInativos) filtro.ativo = true

  const tipos = await TipoAtendimento.find(filtro).sort({ ordem: 1, nome: 1 })
  res.json({
    tipos: tipos.map(serialize),
    /** Os formulários disponíveis, para o médico ligar um tipo a um deles. */
    templates: TEMPLATES.map((t) => ({
      chave: t.chave,
      rotulo: t.rotulo,
      natureza: t.natureza,
      quando: t.quando,
      campos: t.secoes.reduce((n, s) => n + s.campos.length, 0),
    })),
  })
})

/** POST /api/tipos-atendimento */
tiposAtendimentoRouter.post('/', requireAuth, requireRole('medico'), async (req, res) => {
  const parsed = validaTipo.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Confere os dados.' })
    return
  }
  const d = parsed.data
  try {
    const tipo = await TipoAtendimento.create({
      medicoId: req.user!.id,
      nome: normalizeField(d.nome, 60),
      duracaoMin: d.duracaoMin,
      cor: d.cor,
      template: d.template,
      procedimento: d.procedimento ?? false,
      observacaoPadrao: normalizeField(d.observacaoPadrao ?? '', 300),
      ordem: d.ordem ?? 99,
    })
    res.status(201).json({ tipo: serialize(tipo) })
  } catch (e) {
    // O índice único é a mensagem: dois tipos com o mesmo nome seriam
    // indistinguíveis na agenda, que é onde eles precisam ser escolhidos rápido.
    if ((e as { code?: number }).code === 11000) {
      res.status(409).json({ error: 'Você já tem um tipo com esse nome.' })
      return
    }
    throw e
  }
})

/** PATCH /api/tipos-atendimento/:id */
tiposAtendimentoRouter.patch('/:id', requireAuth, requireRole('medico'), async (req, res) => {
  const parsed = validaTipo.partial().safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Confere os dados.' })
    return
  }
  if (!isValidObjectId(req.params.id)) {
    res.status(404).json({ error: 'Não encontramos esse tipo.' })
    return
  }
  const tipo = await TipoAtendimento.findOne({ _id: req.params.id, medicoId: req.user!.id })
  if (!tipo) {
    res.status(404).json({ error: 'Não encontramos esse tipo.' })
    return
  }

  const d = parsed.data
  if (d.nome !== undefined) tipo.nome = normalizeField(d.nome, 60)
  if (d.duracaoMin !== undefined) tipo.duracaoMin = d.duracaoMin
  if (d.cor !== undefined) tipo.cor = d.cor
  if (d.template !== undefined) tipo.template = d.template
  if (d.procedimento !== undefined) tipo.procedimento = d.procedimento
  if (d.observacaoPadrao !== undefined) tipo.observacaoPadrao = normalizeField(d.observacaoPadrao, 300)
  if (d.ordem !== undefined) tipo.ordem = d.ordem
  if (d.ativo !== undefined) tipo.ativo = d.ativo

  try {
    await tipo.save()
  } catch (e) {
    if ((e as { code?: number }).code === 11000) {
      res.status(409).json({ error: 'Você já tem um tipo com esse nome.' })
      return
    }
    throw e
  }
  res.json({ tipo: serialize(tipo) })
})

/**
 * DELETE /api/tipos-atendimento/:id — desativa, não apaga.
 *
 * Atendimentos antigos apontam para o tipo. Apagar de verdade deixaria consultas
 * do ano passado sem dizer o que foram — o histórico clínico não pode perder
 * significado porque alguém arrumou o catálogo.
 */
tiposAtendimentoRouter.delete('/:id', requireAuth, requireRole('medico'), async (req, res) => {
  if (!isValidObjectId(req.params.id)) {
    res.status(404).json({ error: 'Não encontramos esse tipo.' })
    return
  }
  const tipo = await TipoAtendimento.findOneAndUpdate(
    { _id: req.params.id, medicoId: req.user!.id },
    { $set: { ativo: false } },
    { returnDocument: 'after' },
  )
  if (!tipo) {
    res.status(404).json({ error: 'Não encontramos esse tipo.' })
    return
  }
  res.json({ tipo: serialize(tipo) })
})
