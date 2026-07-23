import { Router } from 'express'
import { requireAuth } from '../auth'
import { trilhaProgressSchema } from '../validation'
import { getOrCreateCrianca } from '../services/crianca'

export const trilhaRouter = Router()

// GET /api/trilha
trilhaRouter.get('/', requireAuth, async (req, res) => {
  const crianca = await getOrCreateCrianca(req.user!.id)
  res.json({
    etapasConcluidas: crianca.etapasConcluidas,
    momento: crianca.momento,
    nome: crianca.nome,
  })
})

// POST /api/trilha  { etapaId, concluida }
trilhaRouter.post('/', requireAuth, async (req, res) => {
  const parsed = trilhaProgressSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Não consegui registrar essa etapa. Tenta de novo?' })
    return
  }
  const { etapaId, concluida } = parsed.data
  const crianca = await getOrCreateCrianca(req.user!.id)

  const set = new Set(crianca.etapasConcluidas)
  if (concluida) set.add(etapaId)
  else set.delete(etapaId)
  crianca.etapasConcluidas = [...set]
  await crianca.save()

  res.json({ etapasConcluidas: crianca.etapasConcluidas })
})
