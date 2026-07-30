import { Agendamento } from '../../models/Agendamento.js'
import { Solicitacao } from '../../models/Solicitacao.js'
import { Crianca } from '../../models/Crianca.js'
import type { StatusAgendamento } from '../../models/Agendamento.js'

const STATUS_ANTIGO_PARA_NOVO: Record<string, StatusAgendamento> = {
  pendente: 'pendente',
  confirmada: 'confirmado',
  cancelada: 'cancelado',
}

/**
 * Carrega os registros antigos de `Solicitacao` para `Agendamento`.
 *
 * O modelo antigo não tinha data nenhuma, então a agenda exibia `createdAt` como
 * se fosse o horário do atendimento. Mantemos esse mesmo instante como `inicio`
 * — é a única informação temporal que esses registros já tiveram — e marcamos
 * como `marketplace`, que é o que todos eram. Ninguém perde um pedido; eles só
 * ganham uma forma de verdade.
 *
 * Idempotente por documento: cada origem é carimbada `migrada` assim que ganha
 * um par, então rodar de novo é no-op mesmo se o runner cair no meio.
 */
export async function up(): Promise<void> {
  // Em lotes: uma jornada legada com milhares de solicitações não pode estourar
  // o orçamento de tempo de um cold start.
  for (;;) {
    const antigas = await Solicitacao.find({ migrada: { $ne: true } }).limit(500)
    if (antigas.length === 0) return

    for (const antiga of antigas) {
      // O registro antigo apontava para um usuário, não para uma jornada. Acha a
      // jornada da qual esse usuário é responsável; sem ela não há a que escopar.
      const crianca = await Crianca.findOne({ responsavel: antiga.usuario })
      if (!crianca) {
        await Solicitacao.updateOne({ _id: antiga._id }, { $set: { migrada: true } })
        continue
      }

      const jaExiste = await Agendamento.exists({ origemLegado: String(antiga._id) })
      if (!jaExiste) {
        await Agendamento.create({
          crianca: crianca._id,
          pacienteId: antiga.usuario,
          pacienteNome: antiga.usuarioNome,
          prestador: antiga.prestador,
          prestadorNome: antiga.prestadorNome,
          origem: 'marketplace',
          objetivo: antiga.objetivo,
          modalidade: antiga.modalidade,
          inicio: antiga.createdAt,
          mensagem: antiga.mensagem,
          status: STATUS_ANTIGO_PARA_NOVO[antiga.status] ?? 'pendente',
          origemLegado: String(antiga._id),
        })
      }

      await Solicitacao.updateOne({ _id: antiga._id }, { $set: { migrada: true } })
    }
  }
}
