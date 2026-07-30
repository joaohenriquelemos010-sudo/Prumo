import { Crianca } from '../../models/Crianca.js'
import { PROGRAMA_PADRAO } from '../../programas/index.js'

/**
 * Carimba `programa` nas jornadas que existiam antes do descritor existir.
 *
 * O Mongoose já aplica o default na hidratação, então a leitura funcionaria sem
 * isto. A migração existe por um motivo só: um índice não enxerga um campo que
 * não está gravado. Sem este backfill, `find({ programa: 'materno-infantil' })`
 * simplesmente não devolveria as jornadas antigas.
 */
export async function up(): Promise<void> {
  await Crianca.updateMany(
    { programa: { $exists: false } },
    { $set: { programa: PROGRAMA_PADRAO } },
  )
}
