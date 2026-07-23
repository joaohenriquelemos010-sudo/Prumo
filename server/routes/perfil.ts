import { Router } from 'express'
import { requireAuth } from '../auth'
import { getOrCreateCrianca } from '../services/crianca'
import { perfilCriancaSchema } from '../validation'

export const perfilRouter = Router()

function serialize(c: Awaited<ReturnType<typeof getOrCreateCrianca>>) {
  return {
    nome: c.nome,
    momento: c.momento,
    dpp: c.dpp ? c.dpp.toISOString() : null,
    dataNascimento: c.dataNascimento ? c.dataNascimento.toISOString() : null,
  }
}

// GET /api/perfil — the journey profile (dates that drive the SUS schedule).
perfilRouter.get('/', requireAuth, async (req, res) => {
  const crianca = await getOrCreateCrianca(req.user!.id)
  res.json({ perfil: serialize(crianca) })
})

// PUT /api/perfil
perfilRouter.put('/', requireAuth, async (req, res) => {
  const parsed = perfilCriancaSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Confere os dados, por favor.' })
    return
  }
  const { nome, momento, dpp, dataNascimento } = parsed.data
  const crianca = await getOrCreateCrianca(req.user!.id)

  if (nome !== undefined) crianca.nome = nome
  if (momento !== undefined) crianca.momento = momento
  if (dpp !== undefined) crianca.dpp = dpp ? new Date(dpp) : null
  if (dataNascimento !== undefined) crianca.dataNascimento = dataNascimento ? new Date(dataNascimento) : null
  await crianca.save()

  res.json({ perfil: serialize(crianca) })
})
