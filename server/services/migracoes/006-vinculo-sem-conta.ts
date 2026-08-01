import { Vinculo } from '../../models/Vinculo.js'
import { Agendamento } from '../../models/Agendamento.js'

/**
 * Prepara o terreno para as jornadas sem conta.
 *
 * `Vinculo.pacienteId` e `Agendamento.pacienteId` deixaram de ser obrigatórios:
 * uma paciente cadastrada no consultório tem vínculo e atendimento antes de ter
 * conta. Este backfill não muda comportamento de leitura — grava a string vazia
 * onde o campo simplesmente não existe — mas faz os dois documentos casarem com
 * os filtros que a vinculação usa depois (`{ pacienteId: '' }`).
 *
 * Sem ele, um registro antigo sem o campo ficaria invisível para o `updateMany`
 * da vinculação e a paciente entraria sem enxergar os próprios agendamentos.
 */
export async function up(): Promise<void> {
  await Promise.all([
    Vinculo.updateMany({ pacienteId: { $exists: false } }, { $set: { pacienteId: '' } }),
    Agendamento.updateMany({ pacienteId: { $exists: false } }, { $set: { pacienteId: '' } }),
  ])
}
