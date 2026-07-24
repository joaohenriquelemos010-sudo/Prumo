import { Router } from 'express'
import { requireAuth } from '../auth.js'
import { trilhaProgressSchema } from '../validation.js'
import { resolveCriancaOr403 } from '../services/acesso.js'

export const trilhaRouter = Router()

// GET /api/trilha — the family's own journey, or, with `?crianca`, a journey the
// caller may read (co-parent or a connected doctor).
trilhaRouter.get('/', requireAuth, async (req, res) => {
  const crianca = await resolveCriancaOr403(req, res)
  if (!crianca) return
  res.json({
    etapasConcluidas: crianca.etapasConcluidas,
    momento: crianca.momento,
    nome: crianca.nome,
  })
})

// POST /api/trilha  { etapaId, concluida } — only the family records progress;
// a connected doctor sees the trilha but does not change it.
trilhaRouter.post('/', requireAuth, async (req, res) => {
  const parsed = trilhaProgressSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Não consegui registrar essa etapa. Tenta de novo?' })
    return
  }
  if (req.user!.papel === 'medico') {
    res.status(403).json({ error: 'A trilha é registrada pela família.' })
    return
  }
  const { etapaId, concluida } = parsed.data
  const crianca = await resolveCriancaOr403(req, res)
  if (!crianca) return

  const set = new Set(crianca.etapasConcluidas)
  if (concluida) set.add(etapaId)
  else set.delete(etapaId)
  crianca.etapasConcluidas = [...set]
  await crianca.save()

  res.json({ etapasConcluidas: crianca.etapasConcluidas })
})
