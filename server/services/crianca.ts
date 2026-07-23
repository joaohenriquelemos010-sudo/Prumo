import { Crianca } from '../models/Crianca'
import type { CriancaDoc } from '../models/Crianca'
import type { HydratedDocument } from 'mongoose'

/** Returns the user's journey document, creating a default one if needed. */
export async function getOrCreateCrianca(
  userId: string,
): Promise<HydratedDocument<CriancaDoc>> {
  const existing = await Crianca.findOne({ responsavel: userId })
  if (existing) return existing
  return Crianca.create({ responsavel: userId, momento: 'gestante' })
}
