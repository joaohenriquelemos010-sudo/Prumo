import { Router } from 'express'
import { requireAuth } from '../auth'
import { resolveCriancaOr403 } from '../services/acesso'
import { vacinaToggleSchema } from '../validation'

export const vacinasRouter = Router()

// GET /api/vacinas — which doses are marked as applied.
vacinasRouter.get('/', requireAuth, async (req, res) => {
  const crianca = await resolveCriancaOr403(req, res)
  if (!crianca) return
  res.json({ vacinasAplicadas: crianca.vacinasAplicadas })
})

// POST /api/vacinas  { vacinaId, aplicada }
vacinasRouter.post('/', requireAuth, async (req, res) => {
  const parsed = vacinaToggleSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Não consegui registrar essa vacina. Tenta de novo?' })
    return
  }
  const { vacinaId, aplicada } = parsed.data
  const crianca = await resolveCriancaOr403(req, res)
  if (!crianca) return

  const set = new Set(crianca.vacinasAplicadas)
  if (aplicada) set.add(vacinaId)
  else set.delete(vacinaId)
  crianca.vacinasAplicadas = [...set]
  await crianca.save()

  res.json({ vacinasAplicadas: crianca.vacinasAplicadas })
})
