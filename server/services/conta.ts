import { Crianca } from '../models/Crianca.js'
import { Prontuario } from '../models/Prontuario.js'
import { Consulta } from '../models/Consulta.js'
import { Exame } from '../models/Exame.js'
import { Duvida } from '../models/Duvida.js'
import { Vinculo } from '../models/Vinculo.js'
import { ConviteVinculo } from '../models/ConviteVinculo.js'
import { Solicitacao } from '../models/Solicitacao.js'
import { SolicitacaoCompartilhamento } from '../models/SolicitacaoCompartilhamento.js'
import { User } from '../models/User.js'
import { deleteFile, toObjectId } from '../storage/gridfs.js'

/**
 * Permanently deletes an account and every record tied to it: journeys, clinical
 * records, uploaded exam files, connections, invites and requests. Also detaches
 * the account from any journey it co-parents. Irreversible. Shared by the account
 * owner's own deletion (LGPD erasure) and by the admin removing an account.
 */
export async function excluirConta(userId: string): Promise<void> {
  const criancas = await Crianca.find({ responsavel: userId }).select('_id').lean()
  const criancaIds = criancas.map((c) => c._id)

  const exames = await Exame.find({ crianca: { $in: criancaIds }, arquivoId: { $ne: null } })
    .select('arquivoId')
    .lean()
  await Promise.all(
    exames.map((e) => {
      const fileId = toObjectId(e.arquivoId)
      return fileId ? deleteFile(fileId) : Promise.resolve()
    }),
  )

  await Promise.all([
    Prontuario.deleteMany({ crianca: { $in: criancaIds } }),
    Consulta.deleteMany({ crianca: { $in: criancaIds } }),
    Exame.deleteMany({ crianca: { $in: criancaIds } }),
    Duvida.deleteMany({ crianca: { $in: criancaIds } }),
    Vinculo.deleteMany({ $or: [{ crianca: { $in: criancaIds } }, { pacienteId: userId }, { medicoId: userId }] }),
    ConviteVinculo.deleteMany({ $or: [{ crianca: { $in: criancaIds } }, { criadorId: userId }, { medicoId: userId }] }),
    Solicitacao.deleteMany({ usuario: userId }),
    SolicitacaoCompartilhamento.deleteMany({
      $or: [{ crianca: { $in: criancaIds } }, { medicoOrigemId: userId }, { medicoDestinoId: userId }],
    }),
    // Detach this account from any journey it co-parents.
    Crianca.updateMany({ coResponsaveis: userId }, { $pull: { coResponsaveis: userId } }),
  ])
  await Crianca.deleteMany({ responsavel: userId })
  await User.deleteOne({ _id: userId })
}
