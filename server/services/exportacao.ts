import { Crianca } from '../models/Crianca.js'
import { Prontuario } from '../models/Prontuario.js'
import { Consulta } from '../models/Consulta.js'
import { Exame } from '../models/Exame.js'
import { Duvida } from '../models/Duvida.js'
import { Vinculo } from '../models/Vinculo.js'
import { ConviteVinculo } from '../models/ConviteVinculo.js'
import { Agendamento } from '../models/Agendamento.js'
import type { UserDoc } from '../models/User.js'
import { serializeConsulta } from '../routes/consultas.js'
import { serializeProntuario } from '../routes/prontuario.js'
import { serializeExame } from '../routes/exames.js'
import { serializeDuvida } from '../routes/caderninho.js'
import type { SessionUser } from '../types.js'

/**
 * Exportação LGPD — uma cópia completa e legível de tudo que o Prumo guarda
 * sobre esta conta.
 *
 * O ponto inteiro deste arquivo é **não montar a resposta à mão**. A versão
 * anterior fazia `.lean()` e devolvia o documento cru, o que contornava toda a
 * divisão de visibilidade: `notasPrivadas` e `avaliacaoPrivada` — que o
 * serializer de consultas esconde com cuidado — saíam para qualquer familiar que
 * exportasse os próprios dados.
 *
 * A correção não é filtrar campos aqui. É passar pelos **mesmos serializers das
 * rotas**, com a mesma sessão assinada: se um campo não pode ser lido em
 * `GET /api/consultas`, ele também não pode ser lido no export, por construção e
 * não por disciplina. Um campo sensível novo herda a proteção sem ninguém
 * lembrar de vir aqui.
 *
 * Por isso os documentos são hidratados em vez de `.lean()` — os serializers
 * esperam `HydratedDocument`, e essa é a forma certa de pagar o preço.
 */
export async function montarExportacao(user: UserDoc, sessao: SessionUser) {
  const userId = sessao.id
  const criancas = await Crianca.find({ responsavel: userId })
  const criancaIds = criancas.map((c) => c._id)

  const [prontuarios, consultas, exames, duvidas, vinculos, convites, agendamentos] =
    await Promise.all([
      Prontuario.find({ crianca: { $in: criancaIds } }),
      Consulta.find({ crianca: { $in: criancaIds } }).sort({ data: 1 }),
      Exame.find({ crianca: { $in: criancaIds } }).sort({ dataExame: 1 }),
      Duvida.find({ crianca: { $in: criancaIds } }).sort({ createdAt: 1 }),
      Vinculo.find({ $or: [{ pacienteId: userId }, { medicoId: userId }] }).lean(),
      ConviteVinculo.find({ $or: [{ criadorId: userId }, { medicoId: userId }] }).lean(),
      Agendamento.find({ $or: [{ crianca: { $in: criancaIds } }, { pacienteId: userId }] })
        .sort({ inicio: 1 })
        .lean(),
    ])

  const daJornada = <T extends { crianca: unknown }>(lista: T[], id: unknown) =>
    lista.filter((x) => String(x.crianca) === String(id))

  return {
    exportadoEm: new Date().toISOString(),
    conta: {
      nome: user.nome,
      email: user.email,
      papel: user.papel,
      crm: user.crm || undefined,
      crmUf: user.crmUf || undefined,
      verificacaoStatus: user.verificacaoStatus,
      criadaEm: (user as unknown as { createdAt?: Date }).createdAt,
    },
    jornadas: criancas.map((c) => {
      const prontuario = prontuarios.find((p) => String(p.crianca) === String(c._id))
      return {
        nome: c.nome,
        momento: c.momento,
        programa: c.programa,
        dpp: c.dpp,
        dataNascimento: c.dataNascimento,
        etapasConcluidas: c.etapasConcluidas,
        vacinasAplicadas: c.vacinasAplicadas,
        prontuario: prontuario ? serializeProntuario(prontuario) : null,
        consultas: daJornada(consultas, c._id).map((x) => serializeConsulta(x, sessao)),
        exames: daJornada(exames, c._id).map(serializeExame),
        duvidas: daJornada(duvidas, c._id).map(serializeDuvida),
      }
    }),
    /**
     * Vínculos e convites saem sem token: o token é uma credencial portadora, e
     * um arquivo exportado circula por e-mail e por pen drive.
     */
    vinculos: vinculos.map((v) => ({
      criancaId: String(v.crianca),
      medicoId: v.medicoId,
      medicoNome: v.medicoNome,
      pacienteId: v.pacienteId,
      pacienteNome: v.pacienteNome,
      status: v.status,
      criadoEm: v.createdAt,
    })),
    convitesEnviados: convites.map((c) => ({
      tipo: c.tipo,
      criadorId: c.criadorId,
      medicoId: c.medicoId,
      usado: c.usado,
      expiraEm: c.expiraEm,
      criadoEm: c.createdAt,
    })),
    agendamentos: agendamentos.map((a) => ({
      profissionalNome: a.medicoNome || a.prestadorNome || '',
      objetivo: a.objetivo,
      modalidade: a.modalidade,
      status: a.status,
      inicio: a.inicio,
      duracaoMin: a.duracaoMin,
      local: a.local,
    })),
  }
}
