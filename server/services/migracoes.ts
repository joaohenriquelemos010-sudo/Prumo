import { Agendamento } from '../models/Agendamento.js'
import { Solicitacao } from '../models/Solicitacao.js'
import { Crianca } from '../models/Crianca.js'
import type { StatusAgendamento } from '../models/Agendamento.js'

/**
 * One-shot data migrations, run lazily on first use of the routes that need them
 * (the same trick `ensurePrestadoresSeed` uses). There is no migration runner in
 * this project — Mongoose schemas are the schema — so anything that has to move
 * existing documents lives here and must be safe to call on every request.
 */

let migracaoSolicitacoes: Promise<void> | null = null

const STATUS_ANTIGO_PARA_NOVO: Record<string, StatusAgendamento> = {
  pendente: 'pendente',
  confirmada: 'confirmado',
  cancelada: 'cancelado',
}

/**
 * Carries the old `Solicitacao` records into `Agendamento`.
 *
 * The old model had no date at all, so the agenda displayed `createdAt` as if it
 * were the appointment. We keep that same instant as `inicio` — it is the only
 * time information those records ever had — and mark them `marketplace`, which is
 * what they all were. Nobody loses a request; they just gain a real shape.
 *
 * Idempotent: each source row is stamped `migrada` once it has a counterpart.
 */
export async function migrarSolicitacoes(): Promise<void> {
  if (!migracaoSolicitacoes) {
    migracaoSolicitacoes = (async () => {
      const antigas = await Solicitacao.find({ migrada: { $ne: true } }).limit(500)
      if (antigas.length === 0) return

      for (const antiga of antigas) {
        // The old record pointed at a user, not a journey. Find the journey that
        // user is responsible for; without one there is nothing to scope to.
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
    })().catch((e) => {
      // Never let a migration take the API down — reset so the next call retries.
      migracaoSolicitacoes = null
      throw e
    })
  }
  return migracaoSolicitacoes
}
