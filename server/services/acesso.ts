import { isValidObjectId } from 'mongoose'
import type { HydratedDocument } from 'mongoose'
import type { Request, Response } from 'express'
import { Crianca } from '../models/Crianca'
import type { CriancaDoc } from '../models/Crianca'
import { Vinculo } from '../models/Vinculo'
import { getOrCreateCrianca } from './crianca'
import type { SessionUser } from '../types'

/**
 * Resolves which Criança (patient journey) a request may act on.
 *
 * - No `criancaId` → the user's OWN journey (default, unchanged behaviour).
 * - A `criancaId` that belongs to the user → allowed.
 * - A `criancaId` that a DOCTOR has an active Vínculo to → allowed (this is how a
 *   connected doctor reaches the patient's exams/prontuário/consultas).
 * - Otherwise → null (the caller should answer 403).
 */
export async function resolveCrianca(
  user: SessionUser,
  criancaId?: unknown,
): Promise<HydratedDocument<CriancaDoc> | null> {
  const id = typeof criancaId === 'string' ? criancaId : ''
  if (!id) return getOrCreateCrianca(user.id)
  if (!isValidObjectId(id)) return null

  const crianca = await Crianca.findById(id)
  if (!crianca) return null

  // Own journey.
  if (String(crianca.responsavel) === user.id) return crianca

  // Connected doctor.
  if (user.papel === 'medico') {
    const vinculo = await Vinculo.exists({ crianca: crianca._id, medicoId: user.id, status: 'ativo' })
    if (vinculo) return crianca
  }

  return null
}

/**
 * Route helper: resolves the target Criança from `?crianca` (defaulting to the
 * user's own), answering 403 and returning null when access isn't allowed.
 */
export async function resolveCriancaOr403(
  req: Request,
  res: Response,
): Promise<HydratedDocument<CriancaDoc> | null> {
  const crianca = await resolveCrianca(req.user!, req.query.crianca)
  if (!crianca) {
    res.status(403).json({ error: 'Você não tem acesso a esses dados.' })
    return null
  }
  return crianca
}
