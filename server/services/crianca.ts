import { Crianca } from '../models/Crianca.js'
import type { CriancaDoc } from '../models/Crianca.js'
import type { HydratedDocument } from 'mongoose'
import { PROGRAMA_PADRAO } from '../programas/index.js'

/**
 * A jornada do usuário dentro de um programa, criando uma padrão se não houver.
 *
 * O `programa` entra na busca, não só na criação: uma pessoa pode um dia carregar
 * uma jornada materno-infantil e outra de, digamos, cardiologia, e elas não podem
 * se confundir. Hoje só existe um programa, então o comportamento é idêntico ao
 * de antes — mas o dia em que existirem dois não exige tocar nesta função.
 */
export async function getOrCreateJornada(
  userId: string,
  programa: string = PROGRAMA_PADRAO,
): Promise<HydratedDocument<CriancaDoc>> {
  /**
   * Jornadas anteriores ao descritor não têm o campo gravado até a migração 002
   * rodar. Sem este `$exists: false`, uma delas não casaria com o filtro e
   * ganharia uma jornada duplicada — corrupção silenciosa e cara de desfazer.
   * O runner é awaited na conexão, então a janela é minúscula; mas "minúscula"
   * não é "inexistente", e o custo de fechá-la é uma cláusula.
   */
  const filtro =
    programa === PROGRAMA_PADRAO
      ? { responsavel: userId, $or: [{ programa }, { programa: { $exists: false } }] }
      : { responsavel: userId, programa }

  const existing = await Crianca.findOne(filtro)
  if (existing) return existing
  return Crianca.create({ responsavel: userId, momento: 'gestante', programa })
}

/** Nome antigo, mantido para as rotas que ainda o usam. */
export const getOrCreateCrianca = getOrCreateJornada
