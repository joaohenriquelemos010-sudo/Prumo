import { Evolucao } from '../models/Evolucao.js'
import type { EvolucaoDoc, TipoEvolucao } from '../models/Evolucao.js'
import type { HydratedDocument, Types } from 'mongoose'
import { calcularHash, primeiroEloQuebrado } from './evolucao-hash.js'
import type { CorpoDaEvolucao } from './evolucao-hash.js'
import { normalizeTexto } from '../sanitize.js'

/**
 * Escrita e verificação da história clínica.
 *
 * Três operações, e só três: **registrar** (append), **retificar** (append que
 * corrige) e **verificar**. Não há update, não há delete, e isso não é um
 * descuido de escopo — é a propriedade que o prontuário existe para ter.
 */

export interface NovaEvolucao {
  tipo?: TipoEvolucao
  consulta?: Types.ObjectId | null
  autorId: string
  autorNome: string
  autorPapel: string
  autorCrm?: string
  autorEspecialidade?: string
  texto: string
  estruturado?: unknown
  visibilidade?: 'familia' | 'equipe'
  template?: { chave: string; versao: number }
  retificacaoDe?: Types.ObjectId | null
  metadados?: unknown
  /** Só para importar histórico legado; caso contrário é agora. */
  em?: Date
}

const MAX_TENTATIVAS = 3

/**
 * O que entra no hash.
 *
 * `conteudo` vem opcional no tipo inferido do Mongoose (subdocumento aninhado),
 * então os defaults aqui não são zelo: um `undefined` virando `""` de um lado e
 * `null` do outro produziria hashes diferentes para o mesmo documento e
 * quebraria a cadeia sozinha — pior do que não ter cadeia, porque acusaria
 * adulteração onde não houve.
 */
function corpoDe(doc: {
  jornada: unknown
  ordem: number
  tipo: string
  autorId: string
  em: Date
  conteudo?: { texto?: string; estruturado?: unknown } | null
  visibilidade: string
  origem: string
}): CorpoDaEvolucao {
  return {
    jornada: String(doc.jornada),
    ordem: doc.ordem,
    tipo: doc.tipo,
    autorId: doc.autorId,
    em: new Date(doc.em).toISOString(),
    texto: doc.conteudo?.texto ?? '',
    estruturado: doc.conteudo?.estruturado ?? null,
    visibilidade: doc.visibilidade,
    origem: doc.origem,
  }
}

/**
 * Acrescenta uma entrada ao fim da cadeia.
 *
 * A concorrência é resolvida pelo índice único `{jornada, ordem}` em vez de por
 * transação: duas gravações simultâneas leem a mesma última posição, as duas
 * tentam gravar `ordem = n+1`, uma ganha e a outra leva E11000 — relê e tenta de
 * novo. É mais barato que uma transação e funciona igual em réplica única, que é
 * o que um Atlas de plano baixo oferece.
 */
export async function registrar(
  jornada: Types.ObjectId,
  dados: NovaEvolucao,
): Promise<HydratedDocument<EvolucaoDoc>> {
  let ultimoErro: unknown

  for (let tentativa = 0; tentativa < MAX_TENTATIVAS; tentativa++) {
    const ultima = await Evolucao.findOne({ jornada }).sort({ ordem: -1 })
    const ordem = (ultima?.ordem ?? 0) + 1
    const hashAnterior = ultima?.hash ?? ''
    const em = dados.em ?? new Date()

    const base = {
      jornada,
      ordem,
      tipo: dados.tipo ?? 'evolucao',
      consulta: dados.consulta ?? null,
      autorId: dados.autorId,
      autorNome: dados.autorNome,
      autorPapel: dados.autorPapel,
      autorCrm: dados.autorCrm ?? '',
      autorEspecialidade: dados.autorEspecialidade ?? '',
      em,
      template: dados.template ?? { chave: '', versao: 1 },
      conteudo: {
        texto: normalizeTexto(dados.texto ?? '', 6000),
        estruturado: dados.estruturado ?? null,
      },
      visibilidade: dados.visibilidade ?? 'familia',
      origem: 'humano' as const,
      retificacaoDe: dados.retificacaoDe ?? null,
      metadados: dados.metadados ?? null,
    }

    const hash = calcularHash(hashAnterior, corpoDe(base))

    try {
      return await Evolucao.create({ ...base, hash, hashAnterior })
    } catch (err) {
      if ((err as { code?: number }).code !== 11000) throw err
      ultimoErro = err // outra gravação levou esta posição; relê e tenta de novo
    }
  }

  throw ultimoErro ?? new Error('Não foi possível registrar a evolução.')
}

/**
 * Corrige uma entrada anterior — sem apagá-la.
 *
 * Cria a entrada nova primeiro e só então carimba a antiga, com uma guarda em
 * `retificadaPor: null`: se duas pessoas retificarem a mesma entrada ao mesmo
 * tempo, as duas correções ficam registradas (as duas são história), mas o
 * ponteiro da original aponta para a primeira, e não fica alternando.
 */
export async function retificar(
  jornada: Types.ObjectId,
  evolucaoId: Types.ObjectId,
  dados: NovaEvolucao,
): Promise<HydratedDocument<EvolucaoDoc> | null> {
  const original = await Evolucao.findOne({ _id: evolucaoId, jornada })
  if (!original) return null

  const nova = await registrar(jornada, { ...dados, retificacaoDe: original._id })

  await Evolucao.updateOne(
    { _id: original._id, retificadaPor: null },
    { $set: { retificadaPor: nova._id } },
  )

  return nova
}

export interface ResultadoIntegridade {
  total: number
  integra: boolean
  /** Posição (1-based, igual a `ordem`) do primeiro elo quebrado. */
  quebradaEm: number | null
}

/**
 * Recalcula a cadeia inteira e aponta o primeiro elo que não fecha.
 *
 * Rodar isto é o que transforma "prometemos que não adulteramos" em "dá para
 * conferir". Exposto em `GET /api/prontuario/integridade`.
 */
export async function verificarCadeia(jornada: Types.ObjectId): Promise<ResultadoIntegridade> {
  const evolucoes = await Evolucao.find({ jornada }).sort({ ordem: 1 })
  const indice = primeiroEloQuebrado(
    evolucoes.map((e) => ({
      hash: e.hash,
      hashAnterior: e.hashAnterior,
      corpo: corpoDe(e),
    })),
  )

  return {
    total: evolucoes.length,
    integra: indice === null,
    quebradaEm: indice === null ? null : (evolucoes[indice]?.ordem ?? indice + 1),
  }
}

/** A linha do tempo, já filtrada pelo que este leitor pode ver. */
export async function linhaDoTempo(jornada: Types.ObjectId, equipe: boolean) {
  const filtro = equipe ? { jornada } : { jornada, visibilidade: 'familia' }
  const evolucoes = await Evolucao.find(filtro).sort({ em: -1, ordem: -1 }).limit(200)

  return evolucoes.map((e) => ({
    id: String(e._id),
    ordem: e.ordem,
    tipo: e.tipo,
    em: new Date(e.em).toISOString(),
    autorId: e.autorId,
    autorNome: e.autorNome,
    autorPapel: e.autorPapel,
    autorCrm: e.autorCrm,
    autorEspecialidade: e.autorEspecialidade,
    texto: e.conteudo?.texto ?? '',
    estruturado: e.conteudo?.estruturado ?? null,
    consultaId: e.consulta ? String(e.consulta) : '',
    /** Uma entrada retificada continua visível — foi isso que se registrou na hora. */
    retificadaPor: e.retificadaPor ? String(e.retificadaPor) : '',
    retificacaoDe: e.retificacaoDe ? String(e.retificacaoDe) : '',
    ...(equipe ? { visibilidade: e.visibilidade, hash: e.hash.slice(0, 12) } : {}),
  }))
}
