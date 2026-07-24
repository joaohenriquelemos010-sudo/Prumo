import { Router } from 'express'
import { isValidObjectId } from 'mongoose'
import { requireAuth } from '../auth.js'
import { getOrCreateCrianca } from '../services/crianca.js'
import { Crianca } from '../models/Crianca.js'
import { User } from '../models/User.js'

/**
 * Família — the co-parent (mãe↔pai) relationships around a journey. Lets a
 * family member see the children they co-parent (for the child selector) and
 * manage the co-responsáveis on their own journey (list + unlink). The link
 * itself is created through the co-parent invite flow (see routes/vinculos.ts).
 */
export const familiaRouter = Router()

async function nomesPorId(ids: string[]): Promise<Map<string, string>> {
  const validos = ids.filter((id) => isValidObjectId(id))
  if (validos.length === 0) return new Map()
  const users = await User.find({ _id: { $in: validos } }).select('nome').lean()
  return new Map(users.map((u) => [String(u._id), u.nome]))
}

// GET /api/familia — the journeys I co-parent (for the selector) and the
// co-responsáveis on my own journey (for the share/connection screen).
familiaRouter.get('/', requireAuth, async (req, res) => {
  const userId = req.user!.id

  const [coParentadas, propria] = await Promise.all([
    Crianca.find({ coResponsaveis: userId }).lean(),
    getOrCreateCrianca(userId),
  ])

  const responsaveisIds = (propria.coResponsaveis ?? []).filter((id) => id !== userId)
  const nomes = await nomesPorId(responsaveisIds)

  res.json({
    minhaCrianca: String(propria._id),
    coParentadas: coParentadas.map((c) => ({
      crianca: String(c._id),
      nome: c.nome || 'Bebê',
    })),
    responsaveis: responsaveisIds.map((id) => ({
      id,
      nome: nomes.get(id) || 'Responsável',
    })),
  })
})

// DELETE /api/familia/:criancaId/coresponsavel/:userId — unlink a co-responsável.
// Allowed to the journey owner (removing the other parent) or to the co-responsável
// themselves (leaving the journey).
familiaRouter.delete('/:criancaId/coresponsavel/:userId', requireAuth, async (req, res) => {
  const { criancaId, userId } = req.params
  if (!isValidObjectId(criancaId)) {
    res.status(404).json({ error: 'Vínculo não encontrado.' })
    return
  }
  const crianca = await Crianca.findById(criancaId)
  if (!crianca) {
    res.status(404).json({ error: 'Vínculo não encontrado.' })
    return
  }
  const ehDono = String(crianca.responsavel) === req.user!.id
  const ehProprio = userId === req.user!.id
  if (!ehDono && !ehProprio) {
    res.status(403).json({ error: 'Esse vínculo não é seu.' })
    return
  }
  crianca.coResponsaveis = (crianca.coResponsaveis ?? []).filter((id) => id !== userId)
  await crianca.save()
  res.status(204).end()
})
