import { Router } from 'express'
import { requireAuth } from '../auth.js'
import { getOrCreateCrianca } from '../services/crianca.js'
import { resolveCriancaOr403 } from '../services/acesso.js'
import { perfilCriancaSchema } from '../validation.js'
import { normalizeField } from '../sanitize.js'

export const perfilRouter = Router()

/**
 * The card number is the sensitive part of a health plan — it identifies the
 * person to the operator. It is stored `select: false` and only ever leaves the
 * server masked, so a linked doctor sees that a plan exists without gaining the
 * credential itself. See SECURITY.md.
 */
function mascarar(numero: string): string {
  if (!numero) return ''
  return `•••• ${numero.slice(-4)}`
}

function serialize(c: Awaited<ReturnType<typeof getOrCreateCrianca>>) {
  const convenio = c.convenio
  return {
    nome: c.nome,
    momento: c.momento,
    dpp: c.dpp ? c.dpp.toISOString() : null,
    dataNascimento: c.dataNascimento ? c.dataNascimento.toISOString() : null,
    convenio: convenio?.informado
      ? {
          tipo: convenio.tipo,
          operadora: convenio.operadora,
          plano: convenio.plano,
          // `numeroCarteirinha` is not selected by default, so this is normally
          // absent — masked when a caller did select it.
          numeroCarteirinha: mascarar(convenio.numeroCarteirinha ?? ''),
          validade: convenio.validade ? new Date(convenio.validade).toISOString() : null,
        }
      : null,
  }
}

// GET /api/perfil — the journey profile (dates that drive the SUS schedule).
// A linked doctor may read a connected patient's profile via ?crianca=<id>.
perfilRouter.get('/', requireAuth, async (req, res) => {
  const crianca = await resolveCriancaOr403(req, res)
  if (!crianca) return
  res.json({ perfil: serialize(crianca) })
})

// PUT /api/perfil
perfilRouter.put('/', requireAuth, async (req, res) => {
  const parsed = perfilCriancaSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Confere os dados, por favor.' })
    return
  }
  const { nome, momento, dpp, dataNascimento, convenio } = parsed.data
  const crianca = await getOrCreateCrianca(req.user!.id)

  if (nome !== undefined) crianca.nome = nome
  if (momento !== undefined) crianca.momento = momento
  if (dpp !== undefined) crianca.dpp = dpp ? new Date(dpp) : null
  if (dataNascimento !== undefined) crianca.dataNascimento = dataNascimento ? new Date(dataNascimento) : null

  if (convenio !== undefined) {
    crianca.convenio = {
      tipo: convenio.tipo,
      operadora: normalizeField(convenio.operadora ?? '', 80),
      plano: normalizeField(convenio.plano ?? '', 80),
      // Keep the stored number when the client sends the masked placeholder back.
      numeroCarteirinha:
        convenio.numeroCarteirinha && !convenio.numeroCarteirinha.includes('•')
          ? normalizeField(convenio.numeroCarteirinha, 40)
          : (crianca.convenio?.numeroCarteirinha ?? ''),
      validade: convenio.validade ? new Date(convenio.validade) : null,
      informado: true,
    }
  }

  await crianca.save()
  res.json({ perfil: serialize(crianca) })
})
