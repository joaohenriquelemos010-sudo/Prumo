import { Agendamento } from '../../models/Agendamento.js'

/**
 * Carimba `cobertura` nos agendamentos anteriores ao campo existir.
 *
 * Antes disso, a única informação sobre pagamento era `convenio` — uma string
 * que, quando preenchida, significa "foi por convênio", e quando vazia não
 * significa nada em particular. A leitura já funcionaria pelo default do
 * Mongoose, mas o financeiro filtra **por índice**, e um índice não enxerga
 * campo que não está gravado: sem este backfill, todo atendimento antigo
 * simplesmente sumiria do relatório por cobertura.
 *
 * `sus` não é inferido de propósito. Não há dado antigo que o distinga de
 * particular, e chutar aqui significaria inventar faturamento — melhor um
 * "particular" honesto e corrigível que um número errado com cara de certo.
 */
export async function up(): Promise<void> {
  await Agendamento.updateMany(
    { cobertura: { $exists: false }, convenio: { $nin: ['', null] } },
    { $set: { cobertura: 'convenio' } },
  )
  await Agendamento.updateMany(
    { cobertura: { $exists: false } },
    { $set: { cobertura: 'particular' } },
  )
}
