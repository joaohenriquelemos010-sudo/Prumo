import type { Types } from 'mongoose'
import { Jornada } from '../models/Jornada.js'
import { Prontuario } from '../models/Prontuario.js'
import { Consulta } from '../models/Consulta.js'
import { Exame } from '../models/Exame.js'
import { MedidaFetal } from '../models/MedidaFetal.js'
import { Evolucao } from '../models/Evolucao.js'
import { verificarCadeia } from './evolucao.js'
import type { EscopoTransferencia } from '../models/Transferencia.js'

/**
 * O pacote clínico — tudo que o próximo médico precisa para continuar o caso.
 *
 * ## Por que os nomes são estes
 *
 * Os campos são batizados como **recursos FHIR**: `paciente` → Patient,
 * `encontros` → Encounter, `observacoes` → Observation, `imunizacoes` →
 * Immunization, `documentos` → DocumentReference, `condicoes` → Condition,
 * `narrativa` → Composition.
 *
 * Não é preciosismo. A RNDS exige HL7 FHIR para interoperar nacionalmente, e
 * essa é a diferença entre, mais tarde, escrever um mapeamento e ter que
 * reescrever o exportador inteiro. Nomear certo hoje custa zero.
 *
 * ## O que NÃO vai
 *
 * `notasPrivadas` e as avaliações marcadas como privadas não entram. Elas são o
 * raciocínio em aberto de um profissional específico, não o registro do caso —
 * e a médica que as escreveu não consentiu em mandá-las para um colega que ela
 * talvez nem conheça. O que o próximo médico recebe é a história clínica, que é
 * o que ele precisa e o que a paciente autorizou.
 */
export interface PacoteClinico {
  meta: {
    geradoEm: string
    versao: number
    jornada: string
    programa: string
    /** Estado da cadeia de evoluções no momento da geração. */
    integridade: { total: number; integra: boolean; quebradaEm: number | null }
  }
  paciente: Record<string, unknown>
  condicoes: unknown[]
  encontros: unknown[]
  observacoes: unknown[]
  imunizacoes: unknown[]
  documentos: unknown[]
  narrativa: unknown[]
}

const VERSAO_PACOTE = 1

export async function montarPacote(
  jornadaId: Types.ObjectId,
  escopo: EscopoTransferencia[],
): Promise<PacoteClinico | null> {
  const jornada = await Jornada.findById(jornadaId)
  if (!jornada) return null

  const quer = (e: EscopoTransferencia) => escopo.includes(e)

  const [prontuario, consultas, exames, medidas, evolucoes, integridade] = await Promise.all([
    quer('prontuario') ? Prontuario.findOne({ crianca: jornadaId }) : null,
    quer('consultas') ? Consulta.find({ crianca: jornadaId, status: 'finalizada' }).sort({ data: 1 }) : [],
    quer('exames') ? Exame.find({ crianca: jornadaId }).sort({ dataExame: 1 }) : [],
    quer('medidas') ? MedidaFetal.find({ crianca: jornadaId }).sort({ semana: 1 }) : [],
    quer('prontuario') ? Evolucao.find({ jornada: jornadaId }).sort({ ordem: 1 }) : [],
    verificarCadeia(jornadaId),
  ])

  return {
    meta: {
      geradoEm: new Date().toISOString(),
      versao: VERSAO_PACOTE,
      jornada: String(jornada._id),
      programa: jornada.programa,
      integridade,
    },

    // → Patient
    paciente: {
      nome: jornada.nome,
      momento: jornada.momento,
      dpp: jornada.dpp ? new Date(jornada.dpp).toISOString() : null,
      dataNascimento: jornada.dataNascimento
        ? new Date(jornada.dataNascimento).toISOString()
        : null,
      tipoSanguineo: prontuario?.tipoSanguineo ?? '',
      alergias: prontuario?.alergias ?? '',
      resumoGestacional: prontuario?.resumoGestacional ?? '',
      resumoNascimento: prontuario?.resumoNascimento?.preenchido
        ? prontuario.resumoNascimento
        : null,
    },

    // → Condition
    condicoes: (prontuario?.condicoes ?? []).map((c) => ({ descricao: c })),

    // → Encounter
    encontros: consultas.map((c) => ({
      id: String(c._id),
      data: new Date(c.data).toISOString(),
      tipo: c.tipo,
      autorNome: c.autorNome,
      igSemanas: c.igSemanas,
      igDias: c.igDias,
      subjetivo: c.subjetivo,
      objetivo: c.objetivo,
      // O raciocínio marcado como privado não é do caso; é do profissional.
      avaliacao: c.avaliacaoPrivada ? '' : c.avaliacao,
      avaliacaoOmitida: Boolean(c.avaliacaoPrivada),
      plano: c.plano,
      medidas: c.medidas ?? {},
      duracaoSegundos: c.duracaoSegundos,
    })),

    // → Observation
    observacoes: [
      ...medidas.map((m) => ({
        tipo: 'biometria-fetal',
        semana: m.semana,
        data: (m as unknown as { createdAt?: Date }).createdAt?.toISOString() ?? null,
        dbpMm: m.dbpMm,
        ccMm: m.ccMm,
        caMm: m.caMm,
        cfMm: m.cfMm,
        pfeG: m.pfeG,
        ilaCm: m.ilaCm,
        percentis: m.percentis ?? {},
        apresentacao: m.apresentacao,
        placenta: m.placenta,
      })),
      ...consultas
        .filter((c) => Object.values(c.medidas ?? {}).some((v) => v !== null && v !== undefined))
        .map((c) => ({
          tipo: 'antropometria',
          data: new Date(c.data).toISOString(),
          encontro: String(c._id),
          ...(c.medidas ?? {}),
        })),
    ],

    // → Immunization
    imunizacoes: quer('vacinas')
      ? (jornada.vacinasAplicadas ?? []).map((id) => ({ dose: id, calendario: 'PNI' }))
      : [],

    // → DocumentReference
    // Só a referência: o binário fica no GridFS e é buscado pelo app, não
    // empacotado num JSON que pode ir parar por e-mail.
    documentos: exames.map((e) => ({
      id: String(e._id),
      nome: e.nome,
      categoria: e.categoria,
      dataExame: new Date(e.dataExame).toISOString(),
      observacoes: e.observacoes,
      arquivoNome: e.arquivoNome,
      mimeType: e.mimeType,
      tamanho: e.tamanho,
      temArquivo: Boolean(e.arquivoId),
    })),

    // → Composition
    narrativa: evolucoes.map((e) => ({
      ordem: e.ordem,
      tipo: e.tipo,
      em: new Date(e.em).toISOString(),
      autorNome: e.autorNome,
      autorCrm: e.autorCrm,
      autorEspecialidade: e.autorEspecialidade,
      texto: e.conteudo?.texto ?? '',
      estruturado: e.conteudo?.estruturado ?? null,
      retificadaPor: e.retificadaPor ? String(e.retificadaPor) : '',
      retificacaoDe: e.retificacaoDe ? String(e.retificacaoDe) : '',
      /** Vai junto para que o receptor possa reconferir a cadeia por conta. */
      hash: e.hash,
      hashAnterior: e.hashAnterior,
    })),
  }
}
