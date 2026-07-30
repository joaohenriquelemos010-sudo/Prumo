import { isValidObjectId } from 'mongoose'
import type { HydratedDocument } from 'mongoose'
import type { Request, Response } from 'express'
import { Jornada } from '../models/Jornada.js'
import type { JornadaDoc } from '../models/Jornada.js'
import { Vinculo } from '../models/Vinculo.js'
import { getOrCreateJornada } from './crianca.js'
import { programaPorId, PROGRAMA_PADRAO } from '../programas/index.js'
import type { Programa } from '../programas/index.js'
import type { SessionUser } from '../types.js'

/**
 * Resolve em qual jornada (o registro contínuo de uma paciente) uma requisição
 * pode agir. Este é o primitivo de autorização do produto inteiro — toda rota
 * clínica passa por aqui.
 *
 * - Sem id → a jornada do PRÓPRIO usuário (padrão).
 * - Id que pertence ao usuário → liberado.
 * - Id de que o usuário é CO-RESPONSÁVEL (o outro pai/mãe) → liberado.
 * - Id a que um MÉDICO tem Vínculo ativo → liberado. É assim que a médica
 *   conectada alcança exames/prontuário/consultas da paciente.
 * - Caso contrário → null, e quem chamou responde 403.
 */
export async function resolveJornada(
  user: SessionUser,
  jornadaId?: unknown,
): Promise<HydratedDocument<JornadaDoc> | null> {
  const id = typeof jornadaId === 'string' ? jornadaId : ''
  if (!id) return getOrCreateJornada(user.id)
  if (!isValidObjectId(id)) return null

  const jornada = await Jornada.findById(id)
  if (!jornada) return null

  // Jornada própria.
  if (String(jornada.responsavel) === user.id) return jornada

  // O outro responsável — acesso completo.
  if (jornada.coResponsaveis?.includes(user.id)) return jornada

  // Médico conectado.
  if (user.papel === 'medico') {
    const vinculo = await Vinculo.exists({ crianca: jornada._id, medicoId: user.id, status: 'ativo' })
    if (vinculo) return jornada
  }

  return null
}

/**
 * Helper de rota: resolve a jornada alvo, respondendo 403 e devolvendo null
 * quando o acesso não é permitido.
 *
 * Aceita `?jornada=` **e** `?crianca=`, para sempre. O cliente antigo manda
 * `crianca`; o novo manda `jornada`; nenhum dos dois precisa saber do outro. Um
 * parâmetro de query é contrato público — depreciar sai mais caro do que aceitar
 * os dois nomes por tempo indeterminado.
 */
export async function resolveJornadaOr403(
  req: Request,
  res: Response,
): Promise<HydratedDocument<JornadaDoc> | null> {
  const jornada = await resolveJornada(req.user!, req.query.jornada ?? req.query.crianca)
  if (!jornada) {
    res.status(403).json({ error: 'Você não tem acesso a esses dados.' })
    return null
  }
  return jornada
}

/** O descritor de programa de uma jornada. Nunca falha: id desconhecido cai no padrão. */
export function programaDe(jornada: Pick<JornadaDoc, 'programa'> | null | undefined): Programa {
  return programaPorId(jornada?.programa ?? PROGRAMA_PADRAO)
}
